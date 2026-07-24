# ImgBB Provider Specification

## Purpose

Defines the `ImgBBProvider`, extracted from the existing static `ImgBBClient` class into an implementation of the `ImageUploadProvider` interface. Behavior is preserved exactly — same API endpoint, same FormData encoding, same error codes.

## Requirements

### Requirement: Provider Metadata

The `ImgBBProvider` MUST return `providerId` as `"imgbb"` and `displayName` as `"ImgBB"`.

#### Scenario: Metadata values

- GIVEN an `ImgBBProvider` instance
- WHEN `providerId` is read
- THEN it returns `"imgbb"`
- AND `displayName` returns `"ImgBB"`

### Requirement: Upload — API Endpoint and Encoding

The `upload()` method MUST send a `POST` request to `https://api.imgbb.com/1/upload` with a `FormData` body containing the `image` file and the `key` parameter set to the account's `imgbbApiKey`. The optional `name` parameter SHALL be sent as the `name` field in the FormData when provided.

#### Scenario: Basic upload with key

- GIVEN an ImgBB account with `imgbbApiKey: "testkey123"`
- AND a file `photo.png`
- WHEN `upload(file, { imgbbApiKey: "testkey123" })` is called
- THEN a `POST` is sent to `https://api.imgbb.com/1/upload`
- AND the body is a `FormData` containing `image` (the file) and `key` (`"testkey123"`)

#### Scenario: Upload with custom name

- GIVEN an ImgBB account with `imgbbApiKey: "testkey123"`
- AND a file `photo.png`
- WHEN `upload(file, { imgbbApiKey: "testkey123" }, "vacation.png")` is called
- THEN the FormData body includes `name` set to `"vacation.png"`

### Requirement: Upload — Successful Response

When the ImgBB API returns a 200 response with `success: true`, the system MUST extract the following from `response.data`:

- `url` from `data.image.url`
- `displayUrl` from `data.display_url`
- `deleteUrl` from `data.delete_url`

The returned `UploadResult` SHALL include all three fields.

#### Scenario: Successful upload response parsing

- GIVEN the ImgBB API responds with `{ success: true, data: { id: "abc", image: { url: "https://i.imgbb.com/img/abc.png" }, display_url: "https://ibb.co/abc", delete_url: "https://ibb.co/abc/delete" } }`
- WHEN `upload()` processes the response
- THEN `UploadResult.url` is `"https://i.imgbb.com/img/abc.png"`
- AND `UploadResult.displayUrl` is `"https://ibb.co/abc"`
- AND `UploadResult.deleteUrl` is `"https://ibb.co/abc/delete"`

### Requirement: Upload — Error Handling

When the ImgBB API returns a non-200 status or a response with `success: false`, the system MUST throw an error whose message includes the HTTP status code and the API error message (when available). The existing error code catalog SHALL be preserved.

#### Scenario: API returns 400 with error message

- GIVEN the ImgBB API responds with status 400 and body `{ status_code: 400, error: { message: "Invalid API key." } }`
- WHEN `upload()` processes the response
- THEN an error is thrown
- AND the error message contains `"Invalid API key."`

#### Scenario: Network failure

- GIVEN the ImgBB API is unreachable
- WHEN `upload()` attempts the request
- THEN an error is thrown
- AND the error message indicates a network failure

### Requirement: testConnection — Tiny Image Upload

The `testConnection()` method MUST upload a minimal valid image (1x1 PNG) to the ImgBB API using the provided credentials. If the upload succeeds, the test SHALL return `{ ok: true }`. If the upload fails, the test SHALL return `{ ok: false, message: "..." }` with an error description.

#### Scenario: Valid credentials — test passes

- GIVEN valid ImgBB API key `"testkey123"`
- WHEN `testConnection({ imgbbApiKey: "testkey123" })` is called
- THEN the provider uploads a 1x1 PNG to ImgBB
- AND the result is `{ ok: true }`

#### Scenario: Invalid credentials — test fails

- GIVEN an invalid ImgBB API key
- WHEN `testConnection({ imgbbApiKey: "badkey" })` is called
- THEN the result is `{ ok: false }`
- AND `message` describes the failure (e.g., `"ImgBB: Invalid API key (400)."`)

### Requirement: Behavior Preservation — No Regression

The `ImgBBProvider.upload()` method MUST produce identical HTTP requests and response handling to the existing `ImgBBClient.upload()` static method. No existing behavior SHALL be changed, removed, or altered.

#### Scenario: Request equivalence with current implementation

- GIVEN a file and the same API key
- WHEN uploading with `ImgBBClient` (current) and `ImgBBProvider` (new)
- THEN both send identical HTTP method, URL, headers, and FormData fields
- AND both parse the response identically

#### Scenario: Old ImgBBClient is removed

- GIVEN the `ImgBBProvider` is implemented
- WHEN the codebase is inspected
- THEN the old `ImgBBClient` class no longer exists
- AND all callers use `ImageUploadProvider.upload()` through the registry
