# Modal Upload UI Specification

## Purpose

Specifies how the UploadModal integrates the image-size toolbar and passes the selected size through file upload and URL insert paths to EditorService.

## Requirements

### Requirement: Toolbar Rendering

The modal MUST render the image-size toolbar between the title area and the drop zone. The modal title SHALL NOT display a prominent h2 "CloudImage Uploader" heading.

#### Scenario: Toolbar positioned in modal

- GIVEN the UploadModal is opened
- WHEN `onOpen()` renders the DOM
- THEN the toolbar element appears after the title area and before the drop zone element
- AND no large heading with "CloudImage Uploader" is visible

### Requirement: File Upload with Size

When uploading a file, the system MUST pass the selected size to `EditorService.insertAtCursor()`.

#### Scenario: Upload with Small selected

- GIVEN Small (400px) is selected and a file is loaded
- WHEN the user clicks Upload and the upload succeeds
- THEN `![alt|400](url)` is inserted at the cursor

#### Scenario: Upload with None selected

- GIVEN None is selected and a file is loaded
- WHEN the user clicks Upload and the upload succeeds
- THEN `![alt](url)` is inserted at the cursor (no pipe, backward compatible)

### Requirement: URL Insert with Size

The URL insert path MUST pass the selected size to `insertAtCursor()` identically to file upload.

#### Scenario: URL insert with Medium selected

- GIVEN Medium (600px) is selected and a valid URL is entered
- WHEN the user clicks the Insert arrow button
- THEN `![alt|600](url)` is inserted at the cursor

### Requirement: History Thumbnail Exemption

History thumbnail clicks SHALL NOT apply the size selection. Thumbnails always insert `![alt](url)`.

#### Scenario: History click ignores active size

- GIVEN Small (400px) is selected in the toolbar
- WHEN the user clicks a history thumbnail
- THEN `![alt](url)` is inserted without pipe syntax

### Requirement: Custom Size Validation

When Custom is selected, the system MUST validate the numeric input before upload or URL insert. If the input is empty, non-numeric, or outside 50–2000, the system SHALL display a Notice error and SHALL NOT execute the insert or upload.

#### Scenario: Custom selected with empty input

- GIVEN Custom is active and the numeric input is empty
- WHEN the user clicks Upload or Insert
- THEN an error Notice is displayed and no Markdown is inserted

#### Scenario: Custom selected with non-numeric input

- GIVEN Custom is active and the numeric input contains "abc"
- WHEN the user clicks Upload or Insert
- THEN an error Notice is displayed and no Markdown is inserted

#### Scenario: Custom selected with value below range

- GIVEN Custom is active and the numeric input contains "30"
- WHEN the user clicks Upload or Insert
- THEN an error Notice is displayed and no Markdown is inserted

#### Scenario: Custom selected with value above range

- GIVEN Custom is active and the numeric input contains "2500"
- WHEN the user clicks Upload or Insert
- THEN an error Notice is displayed and no Markdown is inserted

#### Scenario: Custom selected with valid value

- GIVEN Custom is active and the numeric input contains "847"
- WHEN the user clicks Upload or Insert
- THEN `![alt|847](url)` is inserted and no error Notice is displayed

### Requirement: Dynamic Input Visibility

The custom numeric input field MUST appear when Custom is selected and MUST disappear when any other size option is selected. The transition SHALL be instantaneous (no animation required).

#### Scenario: Input appears on Custom selection

- GIVEN None is active and no custom input is visible
- WHEN the user clicks Custom
- THEN a numeric input field appears adjacent to the toolbar

#### Scenario: Input disappears on switching away from Custom

- GIVEN Custom is active and the numeric input is visible
- WHEN the user clicks Small
- THEN the numeric input field disappears and Small becomes active
