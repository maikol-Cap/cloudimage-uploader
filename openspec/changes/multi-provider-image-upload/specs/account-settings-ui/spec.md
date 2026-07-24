# Account Settings UI Specification

## Purpose

Defines how the plugin settings tab renders, creates, edits, and deletes upload accounts. The UI uses card-based account listings with provider-specific forms, inline editing, test connection feedback, and a guided empty state.

## Requirements

### Requirement: Account List Rendering

The settings tab MUST render each configured account as a card. Each card SHALL display:

- The account `name`.
- A provider badge (`"ImgBB"`, `"R2"`, or `"B2"`).
- Key account info relevant to the provider type (e.g., bucket name for R2/B2, API domain for ImgBB).
- Action buttons: Edit, Delete, Test Connection.

#### Scenario: Multiple accounts rendered

- GIVEN the user has two accounts: "ImgBB Personal" and "R2 Work"
- WHEN the settings tab is opened
- THEN two account cards are displayed
- AND each card shows its name, provider badge, and key info

#### Scenario: ImgBB card shows API domain

- GIVEN an ImgBB account named "ImgBB Personal"
- WHEN the card is rendered
- THEN the key info shows the API endpoint or a shortened representation (e.g., `"api.imgbb.com"`)

#### Scenario: R2 card shows bucket name

- GIVEN an R2 account named "R2 Work" with `r2Bucket: "my-images"`
- WHEN the card is rendered
- THEN the key info shows `"my-images"`

#### Scenario: B2 card shows bucket name

- GIVEN a B2 account named "B2 Archive" with `b2BucketName: "archive-bucket"`
- WHEN the card is rendered
- THEN the key info shows `"archive-bucket"`

### Requirement: Empty State

When no accounts are configured, the system MUST display an empty state message guiding the user to create their first account. The message SHALL include a `"+ Add Account"` button.

#### Scenario: Empty state on fresh install

- GIVEN no accounts exist in settings
- WHEN the settings tab is opened
- THEN a message is displayed (e.g., "No upload accounts configured. Add one to start uploading images.")
- AND an `"+ Add Account"` button is visible

#### Scenario: Empty state after deleting last account

- GIVEN the user deletes the last remaining account
- WHEN the account list re-renders
- THEN the empty state message appears

### Requirement: Add Account Flow

The settings tab MUST provide an `"+ Add Account"` button. When clicked, the system SHALL open an account creation form with the following steps:

1. Choose provider type (ImgBB / Cloudflare R2 / Backblaze B2).
2. Fill provider-specific credential fields.
3. Enter an account name (defaults to the provider name if left empty).
4. Save the account.

The form SHALL validate required fields before saving.

#### Scenario: Creating an ImgBB account

- GIVEN the user clicks `"+ Add Account"`
- AND selects "ImgBB" as the provider type
- AND enters an API key `"abc123"`
- AND leaves the name field empty
- WHEN the user clicks Save
- THEN a new ImgBB account is created with name `"ImgBB"` and `imgbbApiKey: "abc123"`
- AND the account appears in the account list

#### Scenario: Creating an R2 account with a custom name

- GIVEN the user clicks `"+ Add Account"`
- AND selects "Cloudflare R2"
- AND fills all required R2 fields plus an optional custom domain
- AND enters the name "Blog Images"
- WHEN the user clicks Save
- THEN a new R2 account with name `"Blog Images"` is created
- AND the account appears in the account list

#### Scenario: Creating a B2 account

- GIVEN the user clicks `"+ Add Account"`
- AND selects "Backblaze B2"
- AND fills all required B2 fields
- AND enters the name "B2 Backup"
- WHEN the user clicks Save
- THEN a new B2 account is created
- AND the account appears in the account list

#### Scenario: Validation blocks save with missing required fields

- GIVEN the user is in the Add Account form for R2
- AND the `r2Bucket` field is empty
- WHEN the user clicks Save
- THEN a validation error is displayed
- AND no account is created

### Requirement: Provider-Specific Form Fields

The account creation/edit form MUST dynamically render credential fields based on the selected provider type. Switching provider types SHALL reset all credential fields to empty.

#### Scenario: ImgBB form fields

- GIVEN "ImgBB" is selected as the provider type
- WHEN the form renders
- THEN only the API Key field is shown

#### Scenario: R2 form fields

- GIVEN "Cloudflare R2" is selected as the provider type
- WHEN the form renders
- THEN fields for Account ID, Access Key ID, Secret Access Key, Bucket, and Custom Domain (optional) are shown

#### Scenario: B2 form fields

- GIVEN "Backblaze B2" is selected as the provider type
- WHEN the form renders
- THEN fields for Application Key ID, Application Key, Bucket ID, and Bucket Name are shown

#### Scenario: Switching provider resets fields

- GIVEN the user is in the Add Account form and has filled R2 fields
- WHEN the user switches the provider type to "ImgBB"
- THEN all credential fields are cleared

### Requirement: Edit Account — Inline Form

Each account card MUST provide an Edit button. When clicked, the system SHALL replace the card's display with an inline form pre-populated with the account's current values. The provider type SHALL remain visible but locked (read-only during edit). Saving the form MUST update the account in place.

#### Scenario: Editing an account name

- GIVEN an account named "ImgBB Personal"
- WHEN the user clicks Edit, changes the name to "ImgBB Work", and saves
- THEN the card updates to show "ImgBB Work"
- AND the account in `settings.accounts` reflects the new name

#### Scenario: Editing credentials

- GIVEN an R2 account
- WHEN the user clicks Edit, changes the bucket field, and saves
- THEN the account's `r2Bucket` is updated
- AND the key info on the card reflects the new bucket name

#### Scenario: Cancel edit

- GIVEN the user is editing an account
- WHEN the user clicks Cancel
- THEN the form closes
- AND no changes are saved
- AND the card shows the original values

### Requirement: Delete Account with Confirmation

Each account card MUST provide a Delete button. When clicked, the system SHALL display a confirmation dialog before removing the account. If the deleted account was the `lastUsedAccountId`, the system SHALL update `lastUsedAccountId` to the first remaining account (or `null` if none remain).

#### Scenario: Confirm delete

- GIVEN the user clicks Delete on an account
- WHEN the confirmation dialog appears and the user confirms
- THEN the account is removed from `settings.accounts`
- AND the card disappears from the list

#### Scenario: Cancel delete

- GIVEN the user clicks Delete on an account
- WHEN the confirmation dialog appears and the user cancels
- THEN the account remains unchanged

#### Scenario: Deleting last-used account updates reference

- GIVEN `lastUsedAccountId` points to account `"abc-123"`
- AND accounts `["abc-123", "def-456"]` exist
- WHEN the user deletes account `"abc-123"`
- THEN `lastUsedAccountId` is updated to `"def-456"`

#### Scenario: Deleting the only account

- GIVEN only one account `"abc-123"` exists and `lastUsedAccountId` is `"abc-123"`
- WHEN the user deletes that account
- THEN `lastUsedAccountId` is set to `null`
- AND the empty state is shown

### Requirement: Test Connection Button per Account

Each account card MUST provide a Test Connection button. When clicked, the system SHALL call the provider's `testConnection()` method with the account's credentials. During the test, the button SHALL show a loading state. On completion, the system SHALL display a success or failure message near the button.

#### Scenario: Test connection succeeds

- GIVEN valid credentials for an ImgBB account
- WHEN the user clicks Test Connection
- THEN the button shows a loading state
- AND after the test completes, a success indicator is displayed (e.g., green checkmark and "Connection successful")

#### Scenario: Test connection fails

- GIVEN invalid credentials for an R2 account
- WHEN the user clicks Test Connection
- THEN the button shows a loading state
- AND after the test completes, a failure indicator is displayed with the error message

#### Scenario: Test connection while already testing

- GIVEN a Test Connection is in progress for an account
- WHEN the user clicks Test Connection again
- THEN no additional request is sent (the button is disabled during the test)

### Requirement: Add Account Button Visibility

The `"+ Add Account"` button SHALL always be visible in the settings tab, both when accounts exist and in the empty state.

#### Scenario: Add button with existing accounts

- GIVEN the user has one or more accounts
- WHEN the settings tab is open
- THEN the `"+ Add Account"` button is visible below the account list

### Requirement: Credential Fields as Password Inputs

Sensitive credential fields (API keys, secret keys, application keys) MUST be rendered as password-type inputs that mask their values by default. The system SHALL provide a toggle to reveal/hide each field.

#### Scenario: Secret field is masked

- GIVEN an R2 account with a Secret Access Key
- WHEN the account card is displayed (not in edit mode)
- THEN the Secret Access Key is masked (e.g., `"••••••••"`)

#### Scenario: Reveal toggle in edit mode

- GIVEN the user is editing an account
- WHEN the user clicks the reveal toggle on the Secret Access Key field
- THEN the field shows the plaintext value

### Requirement: Saving Settings

Changes to accounts (add, edit, delete) MUST persist to Obsidian's `data.json` via the standard `this.plugin.saveData(settings)` mechanism.

#### Scenario: Settings persist across Obsidian restart

- GIVEN the user creates an account and saves settings
- WHEN Obsidian is restarted
- THEN the account is still present in the account list
