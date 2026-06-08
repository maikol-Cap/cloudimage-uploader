# imgbb-api-client Specification

## Purpose

HTTP client for image uploads to ImgBB free tier. POSTs multipart/form-data with API key. Returns parsed success response. Surfaces descriptive errors and validates file size pre-upload.

## Requirements

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Multipart Upload | SHALL | POST file + API key as FormData to ImgBB endpoint |
| R2 | API Key Injection | SHALL | Read API key from plugin settings |
| R3 | Success Parsing | SHALL | Parse JSON response, return typed `{url, displayUrl, deleteUrl}` |
| R4 | Error Handling | SHALL | Surface descriptive errors for HTTP and ImgBB failures |
| R5 | File Size Validation | SHALL | Reject files > 32MB before any network request |

### Requirement: Multipart Upload

The system SHALL POST image as multipart/form-data to `https://api.imgbb.com/1/upload` using native `fetch`.

#### Scenario: Successful upload

- GIVEN valid API key and image < 32MB
- WHEN `uploadToImgBB(file, apiKey)` is called
- THEN POST includes `image` (File) and `key` (string) as FormData fields
- AND response status is 200

#### Scenario: Content-Type header

- GIVEN a File object
- WHEN FormData is constructed for fetch
- THEN Content-Type header MUST NOT be set manually (browser sets multipart boundary)

### Requirement: API Key Injection

The system SHALL read the ImgBB API key from plugin settings.

#### Scenario: Key injected from settings

- GIVEN API key "abc123" exists in plugin settings
- WHEN upload is triggered
- THEN key is passed as `key` field in FormData

#### Scenario: Key missing

- GIVEN API key is empty or not set
- WHEN upload is attempted
- THEN function rejects with error "API key not configured"

### Requirement: Success Response Parsing

The system SHALL parse ImgBB JSON response and return typed result.

#### Scenario: Parse success response

- GIVEN ImgBB returns HTTP 200 with `{"data":{"url":"https://i.imgbb.com/abc.png","display_url":"...","delete_url":"..."},"success":true,"status":200}`
- WHEN response is parsed
- THEN function returns `{url: string, displayUrl: string, deleteUrl: string}`

### Requirement: Error Handling

The system SHALL surface descriptive errors for all failure modes.

#### Scenario: ImgBB application error

- GIVEN ImgBB returns HTTP 400 with `{"status_code":400,"error":{"message":"Invalid API key.","code":100},"success":false}`
- WHEN response is parsed
- THEN function throws with message from `error.message` field

#### Scenario: Network failure

- GIVEN network is unavailable
- WHEN fetch is called
- THEN function throws "Network error: unable to reach ImgBB"

#### Scenario: Server error (5xx)

- GIVEN ImgBB returns HTTP 500
- WHEN response received
- THEN function throws "ImgBB server error (500)"

### Requirement: File Size Validation

The system SHALL reject oversized files before any network request.

#### Scenario: File exceeds free tier limit

- GIVEN file size is 33MB (free tier max: 32MB)
- WHEN upload is attempted
- THEN function throws "File exceeds 32MB limit" before fetch is called
