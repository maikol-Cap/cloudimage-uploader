# CORS-Aware Errors Specification

## Purpose

Defines how the system detects CORS-related upload failures and surfaces provider-specific actionable error messages so the user understands what CORS configuration is needed. Covers detection heuristics, message formatting, and platform-aware behavior (Electron desktop vs. mobile WebView).

## Requirements

### Requirement: CORS Failure Detection

The system MUST detect CORS-related upload failures by inspecting the error produced by the `fetch` call. A failure SHALL be classified as CORS-related when:

- The HTTP response has a status of `0` (opaque response — browser blocked the response).
- The response `type` is `"opaque"`.
- A `TypeError` is thrown with a network-related message (e.g., `"Failed to fetch"`, `"NetworkError"`).

These conditions SHALL be checked in provider-agnostic error handling code shared across all providers.

#### Scenario: Status 0 after fetch

- GIVEN the R2 provider sends a `PUT` request with valid credentials
- AND the R2 bucket does not have CORS configured
- AND the runtime is a mobile WebView with strict CORS enforcement
- WHEN the fetch completes
- THEN `response.status` is `0`
- AND the error is classified as CORS-related

#### Scenario: TypeError "Failed to fetch"

- GIVEN the B2 provider sends a `PUT` request
- AND the B2 bucket does not have CORS configured
- WHEN the fetch rejects with a `TypeError: Failed to fetch`
- THEN the error is classified as CORS-related

#### Scenario: Non-CORS error — not misclassified

- GIVEN the ImgBB provider sends a valid request
- AND the server returns a 400 status with an error body
- WHEN `upload()` processes the response
- THEN the error is NOT classified as CORS-related
- AND the original API error message is preserved

### Requirement: Provider-Specific CORS Error Messages

When a CORS failure is detected, the system MUST emit an error message that includes the provider name and actionable instructions specific to that provider. Each provider SHALL have a dedicated CORS error message template.

#### Scenario: R2 CORS error message

- GIVEN an R2 upload fails due to CORS
- WHEN the error is displayed to the user
- THEN the message SHALL be: `"R2: CORS not configured. In your Cloudflare R2 dashboard, add a CORS policy allowing your Obsidian origin and the PUT method. See the plugin documentation for step-by-step instructions."`

#### Scenario: B2 CORS error message

- GIVEN a B2 upload fails due to CORS
- WHEN the error is displayed to the user
- THEN the message SHALL mention B2 specifically and reference `b2_download_authorize`
- AND the message SHALL include: `"B2: CORS not configured. In your Backblaze B2 bucket settings, add a CORS rule allowing your Obsidian origin and enable b2_download_authorize."`

#### Scenario: ImgBB CORS error message

- GIVEN an ImgBB upload fails due to CORS (unlikely but possible in restricted environments)
- WHEN the error is displayed to the user
- THEN the message SHALL reference ImgBB but note this is unusual
- AND the message SHALL suggest checking network connectivity

### Requirement: Error Message Actionability

Every CORS error message MUST include:

1. The provider name (so the user knows which account is affected).
2. A clear statement that CORS is the likely cause.
3. A specific action the user can take (dashboard location, setting name, or documentation reference).

The system SHALL NOT suggest the user "disable CORS" or modify browser security settings.

#### Scenario: Message includes actionable next step

- GIVEN a CORS error is displayed
- WHEN the user reads the message
- THEN the user can identify which provider failed
- AND the user knows which dashboard or setting to visit
- AND the user is pointed to plugin documentation for details

### Requirement: Desktop vs Mobile CORS Behavior Documentation

The system MUST document that Obsidian desktop (Electron) has relaxed CORS enforcement and uploads are expected to work without CORS configuration, while Obsidian mobile (WebView) enforces standard CORS. This documentation SHALL appear in:

- The README file (installation/prerequisites section).
- Help text within the settings UI (near the account list or as a tooltip).

#### Scenario: README documents CORS requirements

- GIVEN the plugin README
- WHEN a user reads the installation or configuration section
- THEN CORS requirements for R2 and B2 are documented
- AND the desktop vs. mobile distinction is explained

#### Scenario: Settings UI includes CORS help text

- GIVEN the settings tab is open
- WHEN the user views the account list or an R2/B2 account
- THEN help text or a tooltip mentions CORS configuration requirements
- AND the help text notes that desktop (Electron) may work without CORS but mobile requires it

### Requirement: CORS Error Handling for testConnection

The `testConnection()` method in each provider SHALL also detect CORS failures and include CORS-specific guidance in the returned error message. The detection logic SHALL be the same as for `upload()`.

#### Scenario: R2 testConnection CORS failure

- GIVEN valid R2 credentials
- AND the bucket does not have CORS configured
- AND the runtime is a mobile WebView
- WHEN `testConnection()` is called
- THEN the result is `{ ok: false }`
- AND the message includes CORS configuration instructions for R2

#### Scenario: B2 testConnection CORS failure

- GIVEN valid B2 credentials
- AND CORS is not configured
- AND the runtime is a mobile WebView
- WHEN `testConnection()` is called
- THEN the result is `{ ok: false }`
- AND the message includes CORS configuration instructions for B2

### Requirement: Non-CORS Errors Preserve Provider-Specific Messages

When an upload or test fails for non-CORS reasons (e.g., invalid credentials, bucket not found), the system MUST preserve and display the provider-specific error message without CORS guidance.

#### Scenario: 403 on R2 upload with valid CORS

- GIVEN R2 CORS is correctly configured
- AND the Access Key ID is invalid
- WHEN an upload is attempted
- THEN the error message SHALL be about the 403/access denied, NOT about CORS
- AND the message does not suggest checking CORS settings
