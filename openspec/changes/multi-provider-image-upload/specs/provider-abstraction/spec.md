# Provider Abstraction Specification

## Purpose

Defines the `ImageUploadProvider` interface that every upload provider must implement, the shared `UploadResult` type, the `ProviderRegistry` that resolves accounts to providers at runtime, and the credential types that describe what each provider needs.

## Requirements

### Requirement: ImageUploadProvider Interface

The system MUST define an `ImageUploadProvider` interface with the following members:

- `providerId: string` — a unique identifier (e.g., `"imgbb"`, `"r2"`, `"b2"`).
- `displayName: string` — a human-readable label (e.g., `"ImgBB"`).
- `upload(file: File, credentials: Record<string, string>, name?: string): Promise<UploadResult>` — uploads a file using the given credentials and optional filename override.
- `testConnection(credentials: Record<string, string>): Promise<{ ok: boolean; message?: string }>` — verifies that the credentials are valid and the target service is reachable.

#### Scenario: Provider exposes metadata

- GIVEN an ImgBB provider instance
- WHEN `providerId` is read
- THEN it returns `"imgbb"`
- AND `displayName` returns `"ImgBB"`

#### Scenario: upload accepts optional name

- GIVEN a provider with a file named `"photo.png"` and credentials
- WHEN `upload(file, credentials, "vacation.png")` is called
- THEN the uploaded object uses the name `"vacation.png"`
- AND when `upload(file, credentials)` is called without a name
- THEN the uploaded object uses the file's original name `"photo.png"`

### Requirement: UploadResult Type

The system MUST define an `UploadResult` type with:

- `url: string` — the public URL of the uploaded image (required, always present).
- `displayUrl?: string` — an alternative public URL (optional, e.g., a custom-domain URL).
- `deleteUrl?: string` — a URL that can be used to delete the image (optional; ImgBB sets it, R2 and B2 omit it).

#### Scenario: UploadResult with all fields

- GIVEN an R2 upload with a custom domain `https://cdn.example.com`
- WHEN the upload succeeds
- THEN `url` is the R2 bucket endpoint URL
- AND `displayUrl` is `https://cdn.example.com/file/bucket/photo.png`
- AND `deleteUrl` is `undefined`

#### Scenario: ImgBB UploadResult with deleteUrl

- GIVEN an ImgBB upload succeeds
- WHEN `UploadResult` is returned
- THEN `url` is the ImgBB direct image URL
- AND `deleteUrl` is a non-empty string

### Requirement: ProviderRegistry — Registration

The system MUST provide a `ProviderRegistry` class with a `register(provider: ImageUploadProvider): void` method that stores a provider instance keyed by its `providerId`.

#### Scenario: Registering a provider

- GIVEN a `ProviderRegistry` instance
- WHEN `registry.register(new ImgBBProvider())` is called
- THEN the ImgBB provider is stored under key `"imgbb"`

#### Scenario: Registering multiple providers

- GIVEN a `ProviderRegistry` instance
- WHEN ImgBB, R2, and B2 providers are all registered
- THEN the registry contains three entries

### Requirement: ProviderRegistry — Resolution

The system MUST provide a `get(providerId: string): ImageUploadProvider | undefined` method that returns the provider registered under the given ID, or `undefined` when no matching provider exists.

#### Scenario: Resolving a registered provider

- GIVEN an ImgBB provider is registered under `"imgbb"`
- WHEN `registry.get("imgbb")` is called
- THEN the ImgBB provider instance is returned

#### Scenario: Resolving an unregistered provider

- GIVEN no provider is registered under `"unknown"`
- WHEN `registry.get("unknown")` is called
- THEN `undefined` is returned

#### Scenario: Resolving provider for an account

- GIVEN an account with `provider: "b2"` and the B2 provider is registered
- WHEN `registry.get(account.provider)` is called
- THEN the B2 provider instance is returned

### Requirement: Credential Types per Provider

The system MUST define credential type mappings that describe which fields each provider requires and which are optional. These types SHALL be used for validation and form rendering.

#### Scenario: ImgBB credential type

- GIVEN the ImgBB credential type
- THEN it requires `imgbbApiKey: string`
- AND it has no optional fields

#### Scenario: R2 credential type

- GIVEN the R2 credential type
- THEN it requires `r2AccountId: string`, `r2AccessKeyId: string`, `r2SecretAccessKey: string`, and `r2Bucket: string`
- AND it has an optional field `r2CustomDomain?: string`

#### Scenario: B2 credential type

- GIVEN the B2 credential type
- THEN it requires `b2ApplicationKeyId: string`, `b2ApplicationKey: string`, `b2BucketId: string`, and `b2BucketName: string`
- AND it has no optional fields

### Requirement: testConnection Contract

The `testConnection` method MUST return a `Promise<{ ok: boolean; message?: string }>`. When successful, `ok` SHALL be `true` and `message` SHALL be optional. When the test fails, `ok` SHALL be `false` and `message` SHALL contain a human-readable explanation of the failure.

#### Scenario: Successful test connection

- GIVEN valid credentials for an ImgBB account
- WHEN `testConnection(credentials)` is called
- THEN the returned promise resolves with `{ ok: true }`

#### Scenario: Failed test connection with message

- GIVEN invalid credentials for an R2 account
- WHEN `testConnection(credentials)` is called
- THEN the returned promise resolves with an object where `ok` is `false`
- AND `message` contains a description of what failed (e.g., `"R2: Access Denied (403). Check your Access Key ID and Secret Access Key."`)
