# Editor Markdown Injection Specification

## Purpose

Specifies how `EditorService.insertAtCursor()` generates and inserts image Markdown into the active Obsidian editor.

## Requirements

### Requirement: Basic Image Insertion

When no size is provided, the system MUST insert `![alt](url)` at cursor position using the filename (minus extension) as alt text. The cursor SHALL advance past the inserted text.

#### Scenario: Insert image without size

- GIVEN an active editor with cursor at position P
- WHEN `insertAtCursor(editor, "https://example.com/photo.png", "photo.png")` is called
- THEN `![photo](https://example.com/photo.png)` is inserted at P and cursor moves to end of inserted text

#### Scenario: Insert with empty filename

- GIVEN an active editor
- WHEN `insertAtCursor(editor, url, "")` is called
- THEN `![image](url)` is inserted (defaults alt to "image")

### Requirement: Sized Image Insertion

When `size` is provided and truthy (non-zero, non-null), the system MUST insert pipe syntax: `![alt|{size}](url)`.

#### Scenario: Insert image with size 400

- GIVEN an active editor
- WHEN `insertAtCursor(editor, url, "photo.png", 400)` is called
- THEN `![photo|400](url)` is inserted

#### Scenario: Insert with size zero or null

- GIVEN an active editor
- WHEN `insertAtCursor` is called with `size` as `0` or `null`
- THEN `![alt](url)` is inserted without pipe syntax

### Requirement: Custom Size Insertion

When a custom size value (50–2000, from the toolbar's custom input) is provided, the system MUST insert pipe syntax using that exact value: `![alt|{custom}](url)`. The system SHALL accept any valid integer within the 50–2000 range.

#### Scenario: Insert with custom size 847

- GIVEN an active editor
- WHEN `insertAtCursor(editor, url, "photo.png", 847)` is called
- THEN `![photo|847](url)` is inserted

#### Scenario: Insert with custom size at lower boundary

- GIVEN an active editor
- WHEN `insertAtCursor` is called with `size` as `50`
- THEN `![alt|50](url)` is inserted

#### Scenario: Insert with custom size at upper boundary

- GIVEN an active editor
- WHEN `insertAtCursor` is called with `size` as `2000`
- THEN `![alt|2000](url)` is inserted
