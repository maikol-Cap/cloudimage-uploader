# Account Model Specification

## Purpose

Defines the `Account` data type that represents a user-configured upload destination, the settings model that holds a collection of accounts, and the one-time migration path from the legacy `apiKey` field. Each account binds a user-chosen name, a provider type, and provider-specific credentials into one unit of configuration.

## Requirements

### Requirement: Account Type Shape

The system MUST define an `Account` type with the following fields: `id` (a unique string, generated on creation), `name` (a user-chosen label), `provider` (a discriminated literal `"imgbb" | "r2" | "b2"`), and provider-specific credential fields stored as flat optional properties on the same object.

#### Scenario: ImgBB account shape

- GIVEN a user creates an ImgBB account
- WHEN the account is saved
- THEN `provider` equals `"imgbb"`
- AND `imgbbApiKey` is a non-empty string
- AND no R2 or B2 credential fields are populated

#### Scenario: R2 account shape

- GIVEN a user creates an R2 account
- WHEN the account is saved
- THEN `provider` equals `"r2"`
- AND `r2AccountId`, `r2AccessKeyId`, `r2SecretAccessKey`, and `r2Bucket` are non-empty strings
- AND `r2CustomDomain` is an optional string

#### Scenario: B2 account shape

- GIVEN a user creates a B2 account
- WHEN the account is saved
- THEN `provider` equals `"b2"`
- AND `b2ApplicationKeyId`, `b2ApplicationKey`, `b2BucketId`, and `b2BucketName` are non-empty strings

### Requirement: Settings Model — Accounts Array

`CloudImagePluginSettings` MUST include an `accounts: Account[]` field that holds all configured accounts. The field SHALL default to an empty array for new installations.

#### Scenario: Empty accounts on fresh install

- GIVEN the plugin is installed for the first time
- WHEN settings are loaded
- THEN `accounts` is an empty array `[]`

### Requirement: Settings Model — Last Used Account

`CloudImagePluginSettings` MUST include a `lastUsedAccountId: string | null` field that tracks which account the user last selected for upload. The field SHALL default to `null` when no account has been selected.

#### Scenario: Last used account persisted across sessions

- GIVEN the user selects account `"abc-123"` in the upload modal
- WHEN Obsidian restarts and the plugin loads
- THEN `lastUsedAccountId` is `"abc-123"`

### Requirement: One-Time Migration from Legacy apiKey

On first plugin load after the multi-provider upgrade, the system MUST detect the presence of a non-empty `apiKey` field in settings. When found, the system SHALL create a single ImgBB Account, append it to `accounts[]`, set `lastUsedAccountId` to the new account's ID, and delete the `apiKey` field. This migration SHALL run exactly once.

#### Scenario: Migration of existing apiKey

- GIVEN the plugin settings contain `apiKey: "abc123def456"`
- AND `accounts` is `undefined` or `[]`
- WHEN the plugin loads
- THEN an Account is created with `name: "ImgBB"`, `provider: "imgbb"`, and `imgbbApiKey: "abc123def456"`
- AND the account is added to `accounts[]`
- AND `lastUsedAccountId` equals the new account's `id`
- AND `apiKey` is removed from settings

#### Scenario: Empty apiKey — no migration needed

- GIVEN the plugin settings contain `apiKey: ""`
- AND `accounts` is `undefined` or `[]`
- WHEN the plugin loads
- THEN no Account is created
- AND `apiKey` is removed from settings

#### Scenario: Migration already completed

- GIVEN the plugin settings contain `accounts` with at least one entry
- AND `apiKey` field is absent
- WHEN the plugin loads
- THEN no migration logic executes

### Requirement: UploadedImage.deleteUrl Becomes Optional

The `deleteUrl` field on `UploadedImage` MUST be declared as optional (`deleteUrl?: string`). ImgBB uploads SHALL set `deleteUrl`; R2 and B2 uploads SHALL omit it.

#### Scenario: ImgBB upload sets deleteUrl

- GIVEN the user uploads an image to an ImgBB account
- WHEN the upload succeeds and the history entry is created
- THEN `deleteUrl` is a non-empty string

#### Scenario: R2 upload omits deleteUrl

- GIVEN the user uploads an image to an R2 account
- WHEN the upload succeeds and the history entry is created
- THEN `deleteUrl` is `undefined`

#### Scenario: B2 upload omits deleteUrl

- GIVEN the user uploads an image to a B2 account
- WHEN the upload succeeds and the history entry is created
- THEN `deleteUrl` is `undefined`

#### Scenario: History rendering handles missing deleteUrl

- GIVEN a history entry has `deleteUrl: undefined`
- WHEN the history list is rendered
- THEN the entry displays correctly with its URL and filename
- AND no error is thrown

### Requirement: Credential Field Validation per Provider

When saving an account, the system MUST validate that all required credential fields for the account's provider type are non-empty. Optional fields (such as `r2CustomDomain`) MAY be empty.

#### Scenario: ImgBB validation — missing apiKey

- GIVEN a user attempts to save an ImgBB account
- WHEN `imgbbApiKey` is empty
- THEN the save is rejected with a validation error

#### Scenario: R2 validation — missing required field

- GIVEN a user attempts to save an R2 account
- WHEN any of `r2AccountId`, `r2AccessKeyId`, `r2SecretAccessKey`, or `r2Bucket` is empty
- THEN the save is rejected with a validation error naming the missing field

#### Scenario: R2 validation — custom domain optional

- GIVEN a user saves an R2 account
- WHEN `r2CustomDomain` is empty
- THEN the save is accepted and the field is stored as `undefined`

#### Scenario: B2 validation — missing required field

- GIVEN a user attempts to save a B2 account
- WHEN any of `b2ApplicationKeyId`, `b2ApplicationKey`, `b2BucketId`, or `b2BucketName` is empty
- THEN the save is rejected with a validation error naming the missing field

### Requirement: Account ID Uniqueness

Each Account MUST have a unique `id` generated at creation time. The system SHALL use `crypto.randomUUID()` to generate IDs.

#### Scenario: Two accounts have distinct IDs

- GIVEN two accounts are created
- WHEN their IDs are compared
- THEN they are different
