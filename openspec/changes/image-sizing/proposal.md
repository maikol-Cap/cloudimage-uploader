# Proposal: Image Size Selector

## Intent

Users need control over rendered image dimensions when inserting images via the UploadModal. Obsidian supports pipe syntax `![alt|400](url)` to set display width, but the plugin currently only inserts `![alt](url)`. This change adds an explicit size selector so users can choose Small (400px), Medium (600px), or Full (800px) before uploading or inserting a URL.

## Scope

### In Scope

- Toolbar area between the title and the drop zone — designed to host future features
- Modal title cleaned up: remove plugin name "CloudImage Uploader" heading or reduce its prominence
- Size selector with five options: None (default), Small (400px), Medium (600px), Full (800px), Custom (any 50–2000px)
- Custom size option reveals a numeric input field adjacent to the toolbar; validation rejects empty/invalid/out-of-range values before insert/upload
- Applies to both file uploads (Upload button) and URL inserts (Insert button)
- `EditorService.insertAtCursor()` extended with optional `size` parameter → `![alt|400](url)` for presets, `![alt|847](url)` for custom
- Selecting a file/URL does NOT reset the size selector
- Custom value does NOT persist across modal sessions

### Out of Scope

- Modifying already-inserted images (resizing existing Markdown)
- Size controls in the Settings tab
- Per-image default size preferences
- History thumbnail insertion (thumb clicks do not apply size)

## Capabilities

### New Capabilities

- `image-size-toolbar`: Toolbar UI with segmented size selector (None | Small 400px | Medium 600px | Full 800px | Custom), dynamic numeric input for custom size, state management, and visual active/disabled states. Also covers modal title cleanup.

### Modified Capabilities

None — `openspec/specs/` is empty; no existing spec files to delta. The spec phase will create a delta spec for the `editor-markdown-injection` and `modal-upload-ui` capabilities that conceptually exist in the code but have no formal specs.

## Approach

1. Add `selectedSize: number | null` state to `UploadModal`
2. Render a toolbar `<div>` after the h2 title with four toggle buttons
3. CSS: flexbox row, Obsidian CSS variables, active state via `--interactive-accent`
4. Pass `selectedSize` through `handleUpload()` → `EditorService.insertAtCursor(editor, url, name, size)`
5. `EditorService`: if `size` is truthy → `` ![`alt|${size}`](url) ``, else → `![alt](url)`
6. File select (`handleFile`) and URL select (`handleUrl`) do NOT touch `selectedSize`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/modal.ts` | Modified | `onOpen()`: toolbar element after h2, before drop zone. `handleUpload()`: pass size to EditorService |
| `src/editor.ts` | Modified | `insertAtCursor()` gains `size?: number`. Pipe syntax when size is set |
| `src/types.ts` | Modified | Optional: `ImageSizeOption` type or inline `number | null` |
| `styles.css` | Modified | `.cloudimage-toolbar`, button styles, active/inactive states (≈30 lines) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Obsidian pipe syntax not respected by all themes | Low | Syntax is core Obsidian Markdown; test in default + Minimal theme |
| Toolbar overflows on narrow modal | Low | Flexbox wrap; Obsidian modals are fixed-width |
| Accidental size on paste → unexpected output | Low | Size is explicitly selected by user; paste does not auto-set size |

## Rollback Plan

Remove toolbar `div` from `onOpen()`, delete `selectedSize` field, revert `insertAtCursor()` to original 3-param signature. No data migration required — only affects new insertions, never persisted.

## Dependencies

None. Pure UI + string formatting change within existing modal and editor service.

## Success Criteria

- [ ] Toolbar renders between title and drop zone with five size buttons (None, Small, Medium, Full, Custom)
- [ ] Modal title no longer displays a prominent h2 "CloudImage Uploader" heading (removed or reduced)
- [ ] Selecting "Custom" reveals a numeric input field; deselecting hides it
- [ ] Selecting file or URL does NOT change size selection
- [ ] "Small" + upload → `![alt|400](url)` inserted at cursor
- [ ] "Custom" + "847" entered + upload → `![alt|847](url)` inserted at cursor
- [ ] "None" selected → `![alt](url)` inserted (no pipe, backward compatible)
- [ ] URL insert path respects size selection identically to file upload path
- [ ] Custom input empty or invalid (non-numeric, <50, >2000) → Notice error shown, no insert/upload
- [ ] Custom value does not persist across modal sessions (fresh modal = empty input + None selected)
- [ ] Build passes `tsc --noEmit` with zero errors
