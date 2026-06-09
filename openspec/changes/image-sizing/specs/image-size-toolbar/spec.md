# Image Size Toolbar Specification

## Purpose

Toolbar area in the UploadModal between the title and drop zone, hosting a segmented size selector and designed to accommodate future toolbar features.

## Requirements

### Requirement: Size Options

The toolbar MUST present five exclusive options: None (default), Small (400px), Medium (600px), Full (800px), and Custom. Only one option MAY be active at a time.

#### Scenario: Toolbar renders with all options

- GIVEN the UploadModal is open
- WHEN the toolbar renders
- THEN five labeled buttons appear: None, Small (400px), Medium (600px), Full (800px), Custom

#### Scenario: Selecting a size option

- GIVEN None is active by default
- WHEN the user clicks Small
- THEN Small becomes active and None is deselected

#### Scenario: Selecting Custom

- GIVEN None is active by default
- WHEN the user clicks Custom
- THEN Custom becomes active and a numeric input field appears adjacent to the toolbar

### Requirement: Custom Size Input

When Custom is selected, the system MUST reveal a numeric input field where the user types an arbitrary pixel width. Validation MUST reject empty, non-numeric, and out-of-range values (valid range: 50–2000) before insert or upload. The input SHALL NOT persist across modal sessions.

#### Scenario: Custom input appears

- GIVEN the toolbar is rendered and None is active
- WHEN the user clicks the Custom button
- THEN a numeric input field appears next to or below the toolbar with an empty default value

#### Scenario: Custom input disappears on deselect

- GIVEN Custom is active and the numeric input is visible
- WHEN the user clicks any other size option (None, Small, Medium, Full)
- THEN the numeric input field disappears

#### Scenario: Custom input does not persist

- GIVEN the user selected Custom and entered "847"
- WHEN a file is uploaded and the modal is closed then reopened
- THEN the toolbar defaults to None and the custom input is empty

### Requirement: Modal Title

The modal title SHALL NOT display a prominent h2 "CloudImage Uploader" heading. The system SHOULD remove the heading entirely or replace it with less prominent text (e.g., smaller font, plain styling).

#### Scenario: Modal opens without prominent plugin title

- GIVEN the UploadModal is opened
- WHEN the modal renders
- THEN no large h2 "CloudImage Uploader" text is displayed

### Requirement: Default State

The toolbar SHALL default to None every time the modal opens.

#### Scenario: Fresh modal defaults to None

- GIVEN the UploadModal is opened
- WHEN the toolbar initializes
- THEN None shows the active visual state

### Requirement: State Independence

Selecting a file or URL SHALL NOT reset the size selector. The user MUST explicitly change it.

#### Scenario: File selection preserves size

- GIVEN the user selected Small in the toolbar
- WHEN the user selects a file via drop, paste, or browse
- THEN Small remains selected

#### Scenario: URL selection preserves size

- GIVEN the user selected Medium in the toolbar
- WHEN the user enters a URL and clicks the insert arrow button
- THEN Medium remains selected

### Requirement: Visual Active State

The active option MUST use `--interactive-accent` for background and contrasting text color. Inactive options SHALL use the default button style.

#### Scenario: Active button visually distinct

- GIVEN the toolbar is rendered
- WHEN one option is selected
- THEN only that option displays `--interactive-accent` background
