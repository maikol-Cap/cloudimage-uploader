# modal-upload-ui Specification

## Purpose

Multi-input upload modal with clipboard paste, drag-drop, file selector, image preview, and loading state. Accessed via registered Obsidian command/hotkey.

## Requirements

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Command Activation | SHALL | Open modal via registered command/hotkey |
| R2 | Drag-and-Drop | SHALL | Accept image files dropped onto drop zone |
| R3 | Clipboard Paste | SHALL | Accept images pasted via Ctrl+V / Cmd+V |
| R4 | File Picker | SHALL | Button opens native file picker filtered to images |
| R5 | Image Preview | SHALL | Render scaled preview of selected image |
| R6 | Loading State | SHALL | Disable inputs, show "Uploading..." during transfer |
| R7 | Modal Dismissal | SHALL | Close on Escape key or cancel button click |

### Requirement: Command Activation

The system SHALL open the upload modal when the registered command is invoked via hotkey or command palette.

#### Scenario: Hotkey opens modal

- GIVEN plugin is enabled
- WHEN user presses configured hotkey (default Ctrl+Shift+U)
- THEN upload modal opens centered in Obsidian window

#### Scenario: Command palette opens modal

- GIVEN plugin is enabled
- WHEN user runs "CloudImage: Upload image" from command palette
- THEN upload modal opens

### Requirement: Drag-and-Drop Input

The system SHALL accept image files dropped onto the modal drop zone.

#### Scenario: Valid image dropped

- GIVEN modal is open
- WHEN user drops a PNG/JPG/GIF/WebP file onto drop zone
- THEN image preview displays AND drop zone hides

#### Scenario: Non-image file dropped

- GIVEN modal is open
- WHEN user drops a non-image file
- THEN drop zone shows error feedback AND file is rejected

### Requirement: Clipboard Paste Input

The system SHALL detect and accept images pasted from clipboard.

#### Scenario: Image pasted from clipboard

- GIVEN modal is open and clipboard contains an image
- WHEN user presses Ctrl+V (Cmd+V on macOS)
- THEN pasted image shows in preview

#### Scenario: Non-image clipboard content

- GIVEN modal is open and clipboard contains text only
- WHEN user presses Ctrl+V
- THEN paste event is ignored without error

### Requirement: File Picker Input

The system SHALL provide a button to open native file picker filtered to image types.

#### Scenario: File selected via picker

- GIVEN modal is open
- WHEN user clicks "Choose File" and selects an image
- THEN image preview displays

### Requirement: Image Preview

The system SHALL render a scaled preview of the selected image before upload.

#### Scenario: Preview renders

- GIVEN an image has been loaded via any input method
- WHEN preview component mounts
- THEN `<img>` renders with max dimensions fitting modal width
- AND file name and size are displayed below preview

### Requirement: Loading State

The system SHALL disable all inputs and show feedback during upload.

#### Scenario: Loading blocks re-submission

- GIVEN user clicks "Upload"
- WHEN upload is in progress
- THEN all inputs and Upload button are disabled
- AND "Uploading..." text displays with a spinner

#### Scenario: Loading completes

- GIVEN upload is in progress
- WHEN upload succeeds or fails
- THEN loading state clears AND modal closes

### Requirement: Modal Dismissal

The system SHALL close the modal on Escape key or cancel button.

#### Scenario: Escape closes modal

- GIVEN modal is open
- WHEN user presses Escape
- THEN modal closes AND no editor injection occurs

#### Scenario: Cancel button closes modal

- GIVEN modal is open
- WHEN user clicks "Cancel" button
- THEN modal closes without uploading
