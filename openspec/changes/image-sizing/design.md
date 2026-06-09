# Design: Image Size Selector

## Technical Approach

Add a toolbar to `UploadModal` with a 5-button size selector that passes the selected pixel width to `EditorService.insertAtCursor()`, enabling Obsidian pipe syntax (`![alt|400](url)`) for image dimensions. The change is additive — existing callers (history thumbnails) remain untouched.

## Architecture Decisions

### Decision: Title Replacement

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Remove h2 entirely | Clean but leaves empty space at top, looks broken | Rejected |
| Keep h2 with smaller styling | Still conveys "heading" semantics | Rejected |
| Replace with muted `<div class="cloudimage-modal-title">` | Keeps visual anchor, zero prominence | **Chosen** |

**Rationale**: The spec mandates no prominent h2 "CloudImage Uploader." A small uppercase `div` at `0.75em` with `text-muted` provides a subtle "Image upload" label without drawing attention, matching Obsidian's subdued modal conventions.

### Decision: Size State Model

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single `selectedSize: number \| null` | Ambiguous when Custom is active but no value entered | Rejected |
| `selectedSizePreset: SizePreset` + `customSizeValue: number \| null` | Clear separation of button state vs. parsed value | **Chosen** |

**Rationale**: Custom mode creates ambiguity — the button is active but the pixel value isn't known until the user types. Separating preset state from the parsed integer keeps validation and rendering logic straightforward. A `getEffectiveSize()` helper resolves the final pixel value.

### Decision: Custom Input Placement

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Inline after buttons in same row | Crowds the button row on narrow modals | Rejected |
| Below the button row, compact `label > span + input` | Clean row, clear visual hierarchy | **Chosen** |

**Rationale**: A dedicated row below the 5-button group with a "Width (px):" label avoids cramming and wraps naturally. Instant `display` toggle — no animations needed per spec.

### Decision: EditorService Extension

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New method (e.g., `insertSized`) | Two methods, caller must choose | Rejected |
| Optional 4th param `size?: number` | Backward compatible, single method | **Chosen** |

**Rationale**: All 3 existing call sites (URL insert, file upload, history) compile unchanged. Falsy values (0, null, undefined) produce `![alt](url)` — safe default.

## Data Flow

```
Modal opens
  └─ onOpen(): render title div + toolbar (None active) + custom input (hidden)

User clicks size button
  └─ update selectedSizePreset → re-render active state
      └─ Custom? show custom input : hide custom input

User selects file/URL (handleFile/handleUrl)
  └─ selectedSizePreset NOT touched (state independence)

User clicks Upload/Insert → handleUpload()
  ├─ Custom active? validate input (50–2000) → fail = Notice, return
  ├─ getEffectiveSize() → preset value or custom integer or null
  └─ EditorService.insertAtCursor(editor, url, name, effectiveSize)
       └─ size truthy? `![alt|{size}](url)` : `![alt](url)`
```

### Sequence: Upload with Small preset

```
User      UploadModal.onOpen()    UploadModal.handleUpload()    EditorService
 |              |                         |                         |
 |-- open ----> |                         |                         |
 |              |-- render title (<div>)   |                         |
 |              |-- render toolbar (None)  |                         |
 |              |-- render drop zone       |                         |
 |              |                         |                         |
 |-- Small -->  |                         |                         |
 |              |-- selectedSizePreset='small'
 |              |-- UI: Small active       |                         |
 |              |                         |                         |
 |-- drop file -------------------------> |                         |
 |              |-- handleFile(file)       |                         |
 |              |   (size NOT reset)       |                         |
 |              |                         |                         |
 |-- Upload --> |                         |                         |
 |              |                         |-- validate (no custom)  |
 |              |                         |-- upload to ImgBB       |
 |              |                         |-- getEffectiveSize()→400|
 |              |                         |-- insertAtCursor(e,u,n,400)
 |              |                         |                         |-- "![n|400](u)"
 |              |-- close()               |                         |
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/types.ts` | Modify | Export `SizePreset` type and `SIZE_PRESET_VALUES` constant map |
| `src/editor.ts` | Modify | Add `size?: number` param; build `![alt\|{size}](url)` when truthy |
| `src/modal.ts` | Modify | Replace h2 with `div.cloudimage-modal-title`. Add toolbar rendering (5 buttons + custom input row) between title and drop zone. Add `selectedSizePreset`, `customSizeValue`, `getEffectiveSize()`. Pass size in both upload and URL insert paths. Add custom validation in `handleUpload()`. |
| `styles.css` | Modify | Add ~50 lines: `.cloudimage-modal-title`, `.cloudimage-toolbar`, `.cloudimage-toolbar-btn`, `--active`, `.cloudimage-toolbar-custom`, input styles |

## Interfaces / Contracts

```typescript
// types.ts — new exports
export type SizePreset = 'none' | 'small' | 'medium' | 'full' | 'custom';
export const SIZE_PRESET_VALUES: Record<Exclude<SizePreset, 'none' | 'custom'>, number> = {
  small: 400, medium: 600, full: 800,
};

// editor.ts — signature change (additive)
static insertAtCursor(editor: Editor, url: string, filename: string, size?: number): void;

// modal.ts — new state
private selectedSizePreset: SizePreset = 'none';
private customSizeValue: number | null = null;
private getEffectiveSize(): number | null;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Type check | Compilation of all existing callers with new optional param | `tsc --noEmit` |
| Manual | Toolbar renders, button mutual exclusivity, custom input toggle | Open modal in Obsidian, verify DOM |
| Manual | Pipe syntax: None → `![alt](url)`, Small → `![alt\|400](url)`, Custom+847 → `![alt\|847](url)` | Upload/insert with each preset |
| Manual | Custom validation: empty, "abc", "30", "2500" → Notice, no insert | Test each invalid path |
| Manual | History exemption: select Small, click thumbnail → `![alt](url)` | Verify no pipe in output |

## Migration / Rollout

No migration required. Change is additive — all existing callers compile without modification. Rollback: remove toolbar block and `selectedSizePreset` from `onOpen()`, revert `insertAtCursor()` to 3-param, delete CSS additions. Zero data impact (only affects new insertions).

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Pipe syntax not rendered by all themes | Low | Core Obsidian Markdown; test in default + Minimal theme |
| Toolbar wraps on narrow modal | Low | `flex-wrap: wrap`; Obsidian modals fixed ~600px, 5 short buttons fit |
| Existing callers break on compilation | Low | `size?` makes the param optional — zero changes needed at call sites |
| Custom input DOM-level bypass | None | No security impact; ImgBB ignores pipe syntax server-side |
