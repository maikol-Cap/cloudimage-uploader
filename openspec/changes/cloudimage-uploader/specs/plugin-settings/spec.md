# plugin-settings Specification

## Purpose

Obsidian settings tab for ImgBB API key configuration. Persists securely via Obsidian's `loadData`/`saveData`. Validates key presence before upload.

## Requirements

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Settings Tab | SHALL | Register "CloudImage" tab in Obsidian settings |
| R2 | API Key Input | SHALL | Password-masked text field for ImgBB API key |
| R3 | Key Persistence | SHALL | Persist via Obsidian `loadData`/`saveData` |
| R4 | Key Validation | SHALL | Validate key presence before allowing upload |
| R5 | Default Settings | SHALL | Fall back to `{apiKey: ""}` on first load |

### Requirement: Settings Tab Registration

The system SHALL register a settings tab in Obsidian's settings panel.

#### Scenario: Tab appears in settings

- GIVEN plugin is loaded and enabled
- WHEN user opens Obsidian Settings
- THEN "CloudImage" tab appears in Community Plugins section
- AND tab content renders the API key input

### Requirement: API Key Input Field

The system SHALL provide a secure text input for the ImgBB API key.

#### Scenario: Key entered and saved

- GIVEN settings tab is open
- WHEN user types API key and focus leaves input
- THEN key is saved to plugin data.json via `saveData()`

#### Scenario: Key masked on display

- GIVEN a key has been previously saved
- WHEN settings tab opens
- THEN input shows key as masked password field

### Requirement: Key Persistence

The system SHALL persist settings using Obsidian's built-in data mechanism.

#### Scenario: Key survives restart

- GIVEN API key "abc123" was saved
- WHEN Obsidian restarts and plugin loads
- THEN `loadData()` returns `{apiKey: "abc123"}`

#### Scenario: Empty key persists

- GIVEN API key is cleared in settings
- WHEN settings are saved
- THEN `loadData()` returns `{apiKey: ""}`

### Requirement: Key Validation

The system SHALL validate API key presence before upload.

#### Scenario: Upload blocked without key

- GIVEN API key is empty or unset
- WHEN user attempts upload
- THEN notice displays "Please configure your ImgBB API key in settings"
- AND upload is aborted before any network request

#### Scenario: Upload proceeds with key

- GIVEN API key is configured
- WHEN user triggers upload
- THEN upload proceeds normally

### Requirement: Default Settings

The system SHALL provide a typed default settings object.

#### Scenario: First load with no data

- GIVEN plugin loads for the first time (no data.json)
- WHEN `loadData()` returns null/undefined
- THEN plugin uses `DEFAULT_SETTINGS: CloudImageSettings = {apiKey: ""}`
