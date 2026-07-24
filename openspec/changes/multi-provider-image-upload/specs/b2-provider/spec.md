# B2 Provider Specification

## Purpose

Defines the `B2Provider`, an implementation of `ImageUploadProvider` that uploads images to Backblaze B2 using the native B2 API. The upload follows a 3-step flow: authorize, get upload URL, then PUT the file. SHA-1 hashing is computed client-side via the Web Crypto API.

## Requirements

### Requirement: Provider Metadata

The `B2Provider` MUST return `providerId` as `"b2"` and `displayName` as `"Backblaze B2"`.

#### Scenario: Metadata values

- GIVEN a `B2Provider` instance
- WHEN `providerId` is read
- THEN it returns `"b2"`
- AND `displayName` returns `"Backblaze B2"`

### Requirement: Required Credentials

The B2 provider MUST require the following credential fields: `b2ApplicationKeyId`, `b2ApplicationKey`, `b2BucketId`, and `b2BucketName`.

#### Scenario: Upload requires all mandatory credentials

- GIVEN a B2 account missing `b2BucketId`
- WHEN `upload()` is called
- THEN an error is thrown indicating missing credentials

### Requirement: Upload — Step 1: b2_authorize_account

The `upload()` method MUST first call `b2_authorize_account` by sending a `GET` request to `https://api.backblazeb2.com/b2api/v3/b2_authorize_account` with the `Authorization` header set to `Basic <base64(applicationKeyId:applicationKey)>`.

A successful response SHALL provide:

- `authorizationToken` — used in subsequent requests.
- `apiUrl` — the base URL for API calls.
- `downloadUrl` — the base URL for public file downloads.

#### Scenario: Successful authorization

- GIVEN valid `b2ApplicationKeyId: "key123"` and `b2ApplicationKey: "secret456"`
- WHEN `b2_authorize_account` is called
- THEN a `GET` is sent to `https://api.backblazeb2.com/b2api/v3/b2_authorize_account`
- AND the `Authorization` header is `Basic <base64("key123:secret456")>`
- AND the response contains `authorizationToken`, `apiUrl`, and `downloadUrl`

#### Scenario: Failed authorization

- GIVEN invalid credentials
- WHEN `b2_authorize_account` is called
- THEN an error is thrown
- AND the error message includes the HTTP status code

### Requirement: Upload — Step 2: b2_get_upload_url

After authorization succeeds, the `upload()` method MUST call `b2_get_upload_url` by sending a `POST` request to `<apiUrl>/b2api/v3/b2_get_upload_url` with the `Authorization` header set to the `authorizationToken` from step 1 and a JSON body containing `{ bucketId: "<bucketId>" }`.

A successful response SHALL provide:

- `uploadUrl` — the URL to `PUT` the file to.
- `authorizationToken` — a single-use upload token.

#### Scenario: Successful upload URL retrieval

- GIVEN a valid `authorizationToken` from step 1
- AND `bucketId: "bucket-abc"`
- WHEN `b2_get_upload_url` is called
- THEN a `POST` is sent to `<apiUrl>/b2api/v3/b2_get_upload_url`
- AND the body is `{ "bucketId": "bucket-abc" }`
- AND the response contains `uploadUrl` and a new `authorizationToken`

#### Scenario: Bucket not found

- GIVEN an invalid `bucketId`
- WHEN `b2_get_upload_url` is called
- THEN an error is thrown indicating the bucket was not found

### Requirement: Upload — Step 3: PUT File to Upload URL

After obtaining the upload URL, the `upload()` method MUST `PUT` the file bytes to the `uploadUrl`. The request SHALL include the following headers:

- `Authorization: <uploadAuthorizationToken>`
- `X-Bz-File-Name: <filename>` (URL-encoded)
- `Content-Type: <file MIME type>`
- `X-Bz-Content-Sha1: <hex-encoded SHA-1 hash of file bytes>`
- `Content-Length: <file size in bytes>`

A successful `PUT` response SHALL include the uploaded file's metadata, from which the public URL is derived.

#### Scenario: Successful file upload

- GIVEN a valid `uploadUrl` and `authorizationToken` from step 2
- AND a file `photo.png`
- WHEN the file is `PUT` to the upload URL
- THEN the request includes all required headers
- AND the `X-Bz-Content-Sha1` header matches the hex-encoded SHA-1 of the file
- AND the response contains file metadata

### Requirement: SHA-1 Hashing via Web Crypto API

The provider MUST compute the SHA-1 hash of the file bytes using `crypto.subtle.digest("SHA-1", buffer)`. The resulting hash SHALL be hex-encoded for the `X-Bz-Content-Sha1` header.

#### Scenario: SHA-1 computation on a small file

- GIVEN a file with known content `"hello"`
- WHEN the SHA-1 hash is computed
- THEN the result is the hex-encoded SHA-1 `"aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d"`

#### Scenario: SHA-1 on an empty file

- GIVEN an empty file (0 bytes)
- WHEN the SHA-1 hash is computed
- THEN the result is the hex-encoded SHA-1 `"da39a3ee5e6b4b0d3255bfef95601890afd80709"`

#### Scenario: SubtleCrypto unavailable fallback

- GIVEN the runtime does not expose `crypto.subtle`
- WHEN the SHA-1 hash is requested
- THEN the provider SHALL fall back to a chunked manual SHA-1 implementation
- AND the computation SHALL yield the same result as the Web Crypto API

### Requirement: Upload — Public URL Construction

After a successful upload, the `UploadResult.url` MUST be constructed as:

```
<downloadUrl>/file/<bucketName>/<fileName>
```

where `downloadUrl` is the value from step 1, `bucketName` is from the account credentials, and `fileName` is the uploaded filename.

#### Scenario: Public URL after upload

- GIVEN `downloadUrl: "https://f001.backblazeb2.com"`, `bucketName: "my-bucket"`, and uploaded filename `"photo-1234.png"`
- WHEN `UploadResult` is returned
- THEN `url` is `"https://f001.backblazeb2.com/file/my-bucket/photo-1234.png"`
- AND `displayUrl` is `undefined`
- AND `deleteUrl` is `undefined`

### Requirement: Upload — Error Handling

When any step of the 3-step flow fails, the system MUST throw an error whose message includes the step that failed, the HTTP status code, and the API error message (when available).

#### Scenario: Authorization failure

- GIVEN invalid `b2ApplicationKeyId`
- WHEN `upload()` calls `b2_authorize_account`
- THEN an error is thrown with a message indicating authorization failure

#### Scenario: Upload URL retrieval failure

- GIVEN a valid authorization but no permission to upload to the bucket
- WHEN `upload()` calls `b2_get_upload_url`
- THEN an error is thrown with a message indicating the upload URL could not be obtained

#### Scenario: File PUT failure

- GIVEN a valid upload URL but a network interruption during the PUT
- WHEN the file upload is attempted
- THEN an error is thrown indicating the upload failed

### Requirement: testConnection — Authorize + List Buckets

The `testConnection()` method MUST perform:

1. `b2_authorize_account` to verify credentials.
2. `b2_list_buckets` to verify the bucket exists and is accessible.

If both steps succeed, the test SHALL return `{ ok: true }`. If either fails, the test SHALL return `{ ok: false, message: "..." }`.

#### Scenario: Successful test connection

- GIVEN valid B2 credentials
- WHEN `testConnection(credentials)` is called
- THEN `b2_authorize_account` succeeds
- AND `b2_list_buckets` includes the configured bucket
- AND the result is `{ ok: true }`

#### Scenario: Invalid credentials — test fails at authorize

- GIVEN invalid `b2ApplicationKeyId`
- WHEN `testConnection(credentials)` is called
- THEN `b2_authorize_account` fails
- AND the result is `{ ok: false }` with message `"B2: Authorization failed (401). Check your Application Key ID and Application Key."`

#### Scenario: Bucket not found — test fails at list

- GIVEN valid credentials but an incorrect `bucketId`
- WHEN `testConnection(credentials)` is called
- THEN `b2_authorize_account` succeeds
- AND `b2_list_buckets` does not include the configured bucket
- AND the result is `{ ok: false }` with a message indicating the bucket was not found
