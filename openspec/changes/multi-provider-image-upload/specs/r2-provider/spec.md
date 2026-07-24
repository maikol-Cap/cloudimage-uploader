# R2 Provider Specification

## Purpose

Defines the `R2Provider`, an implementation of `ImageUploadProvider` that uploads images to Cloudflare R2 using an S3-compatible `PUT` request with AWS Signature V4. Supports optional custom domains for public URL generation.

## Requirements

### Requirement: Provider Metadata

The `R2Provider` MUST return `providerId` as `"r2"` and `displayName` as `"Cloudflare R2"`.

#### Scenario: Metadata values

- GIVEN an `R2Provider` instance
- WHEN `providerId` is read
- THEN it returns `"r2"`
- AND `displayName` returns `"Cloudflare R2"`

### Requirement: Required Credentials

The R2 provider MUST require the following credential fields: `r2AccountId`, `r2AccessKeyId`, `r2SecretAccessKey`, and `r2Bucket`. Additionally, `r2CustomDomain` SHALL be accepted as an optional field.

#### Scenario: Upload requires all mandatory credentials

- GIVEN an R2 account missing `r2Bucket`
- WHEN `upload()` is called
- THEN an error is thrown indicating missing credentials

### Requirement: Upload — AWS Signature V4 Computation

The `upload()` method MUST compute an AWS Signature V4 for a `PUT` request to the R2 endpoint. The signature SHALL be computed client-side in TypeScript using the Web Crypto API (`crypto.subtle`). The signing algorithm SHALL be `AWS4-HMAC-SHA256`.

#### Scenario: PUT request with valid signature

- GIVEN valid R2 credentials
- AND a file `photo.png`
- WHEN `upload(file, credentials)` is called
- THEN a `PUT` request is sent to `https://<accountId>.r2.cloudflarestorage.com/<bucket>/<filename>`
- AND the request includes `Authorization`, `x-amz-date`, `x-amz-content-sha256`, and `Content-Type` headers
- AND the `Authorization` header contains `AWS4-HMAC-SHA256` with the correct credential scope and signature

### Requirement: Upload — Endpoint Construction

The upload endpoint SHALL be constructed as:

```
https://<accountId>.r2.cloudflarestorage.com/<bucket>/<encoded-filename>
```

The filename SHALL be generated to avoid collisions. A unique prefix or suffix (e.g., timestamp or UUID) SHALL be appended to the original filename.

#### Scenario: Endpoint URL construction

- GIVEN `accountId: "abc123"`, `bucket: "my-images"`, and a file named `photo.png`
- WHEN the upload endpoint is constructed
- THEN the URL begins with `https://abc123.r2.cloudflarestorage.com/my-images/`
- AND the filename portion retains `.png`

### Requirement: Upload — Public URL with Default Domain

When the upload succeeds, the `UploadResult` MUST include `url` set to the R2 public endpoint:

```
https://pub-<hash>.r2.dev/<filename>
```

or the equivalent R2 public bucket URL when the bucket has a public custom domain not configured.

#### Scenario: Default public URL

- GIVEN an R2 upload succeeds
- AND no custom domain is configured
- WHEN `UploadResult` is returned
- THEN `url` is a valid R2 public URL (e.g., `https://pub-abc123.r2.dev/photo-1234.png`)

### Requirement: Upload — Public URL with Custom Domain

When `r2CustomDomain` is configured, the `UploadResult` MUST include `displayUrl` using the custom domain. The `url` field SHALL continue to use the default R2 public URL.

#### Scenario: Custom domain in displayUrl

- GIVEN an R2 account with `r2CustomDomain: "cdn.example.com"`
- AND the upload succeeds with filename `photo-1234.png`
- WHEN `UploadResult` is returned
- THEN `url` is the default R2 public URL
- AND `displayUrl` is `https://cdn.example.com/photo-1234.png`

#### Scenario: Custom domain with trailing slash

- GIVEN an R2 account with `r2CustomDomain: "cdn.example.com/"`
- AND the upload succeeds with filename `photo-1234.png`
- WHEN `UploadResult` is returned
- THEN `displayUrl` is `https://cdn.example.com/photo-1234.png`
- AND no double slash appears in the URL

### Requirement: Upload — Error Handling

When the R2 `PUT` returns a non-2xx status, the system MUST throw an error with a message that includes the HTTP status code and the R2 error body (when available).

#### Scenario: 403 Forbidden on upload

- GIVEN invalid R2 credentials
- WHEN `upload()` is called
- THEN an error is thrown
- AND the message includes the status code 403

#### Scenario: 404 bucket not found

- GIVEN valid credentials but a non-existent bucket
- WHEN `upload()` is called
- THEN an error is thrown indicating the bucket was not found

### Requirement: testConnection — PUT 1-Byte Object + HEAD Verify

The `testConnection()` method MUST perform a two-step check:

1. `PUT` a 1-byte object to the bucket (a test/temporary object).
2. `HEAD` the same object to verify it was written.

If both steps succeed, the test SHALL return `{ ok: true }`. If either fails, the test SHALL return `{ ok: false, message: "..." }` with a provider-specific description.

#### Scenario: Successful test connection

- GIVEN valid R2 credentials and a reachable bucket
- WHEN `testConnection(credentials)` is called
- THEN a 1-byte object is `PUT` and then `HEAD`ed successfully
- AND the result is `{ ok: true }`

#### Scenario: Test fails on PUT

- GIVEN invalid Access Key ID
- WHEN `testConnection(credentials)` is called
- THEN the `PUT` returns 403
- AND the result is `{ ok: false }` with a message indicating the 403 error

#### Scenario: Test object cleanup not required

- GIVEN the test connection creates a temporary object
- WHEN the test completes (success or failure)
- THEN the test object MAY remain in the bucket (it is a 1-byte object the user can delete at will)

### Requirement: Content Type Detection

The upload SHALL set the `Content-Type` header based on the file's MIME type. Image files SHALL be detected and served correctly.

#### Scenario: PNG content type

- GIVEN a file `photo.png` (MIME type `image/png`)
- WHEN the `PUT` request is constructed
- THEN the `Content-Type` header is `image/png`

#### Scenario: JPEG content type

- GIVEN a file `photo.jpg` (MIME type `image/jpeg`)
- WHEN the `PUT` request is constructed
- THEN the `Content-Type` header is `image/jpeg`
