# editor-markdown-injection Specification

## Purpose

Detects cursor position in active Markdown editor and inserts `![Alt](URL)` syntax after successful upload. Provides notice notifications for success and failure.

## Requirements

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Cursor Detection | SHALL | Detect cursor position in active Markdown editor |
| R2 | Markdown Injection | SHALL | Insert `![Alt](URL)` at cursor after upload |
| R3 | Alt Text Generation | SHALL | Derive alt text from filename or use default |
| R4 | Success Notification | SHALL | Show notice with URL on success |
| R5 | Error Notification | SHALL | Show notice with error details on failure |

### Requirement: Cursor Detection

The system SHALL detect the cursor position in the active Markdown editor before injection.

#### Scenario: Cursor in editor body

- GIVEN active Markdown view with cursor at line 5, column 12
- WHEN upload completes successfully
- THEN `![Alt](URL)` inserted at that exact position

#### Scenario: No active Markdown editor

- GIVEN no Markdown editor is active (e.g., graph view or settings)
- WHEN upload completes successfully
- THEN upload still succeeds BUT no injection occurs
- AND notice displays URL for manual copy

### Requirement: Markdown Link Injection

The system SHALL insert `![Alt](URL)` at detected cursor position after successful upload.

#### Scenario: Injects at cursor

- GIVEN editor is active and upload returned URL "https://i.imgbb.com/abc.png"
- WHEN injection fires
- THEN `![image](https://i.imgbb.com/abc.png)` inserted at cursor
- AND cursor moves to end of inserted text

### Requirement: Alt Text Generation

The system SHALL derive alt text from the uploaded file's name.

#### Scenario: Uses filename for alt text

- GIVEN uploaded file named "screenshot-2026.png"
- WHEN injection fires
- THEN alt text is "screenshot-2026" (filename without extension)

#### Scenario: Falls back to default alt

- GIVEN file has no readable name (e.g., clipboard paste produces blob)
- WHEN injection fires
- THEN alt text defaults to "image"

### Requirement: Success Notification

The system SHALL display an Obsidian notice on successful upload.

#### Scenario: Success notice

- GIVEN upload succeeds with URL
- WHEN markdown is injected
- THEN notice displays "Image uploaded: {URL}" for 5 seconds

### Requirement: Error Notification

The system SHALL display an Obsidian notice on upload failure.

#### Scenario: Error notice

- GIVEN upload fails with error "Invalid API key"
- WHEN error is caught
- THEN notice displays "Upload failed: Invalid API key" for 10 seconds
