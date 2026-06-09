# Tasks: Image Size Selector

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 130–150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation (types + editor)

- [x] 1.1 Add `SizePreset` type and `SIZE_PRESET_VALUES` map to `src/types.ts`
- [x] 1.2 Add optional `size?: number` parameter to `EditorService.insertAtCursor()` in `src/editor.ts`
- [x] 1.3 Update `insertAtCursor()` to emit `![alt|{size}](url)` when `size` is truthy, else `![alt](url)`

## Phase 2: UI Foundation (toolbar + title + CSS)

- [x] 2.1 Replace h2 `"CloudImage Uploader"` with muted `<div class="cloudimage-modal-title">Image upload</div>` in `UploadModal.onOpen()` — `src/modal.ts`
- [x] 2.2 Add `selectedSizePreset: SizePreset` and `customSizeValue: number | null` state to `UploadModal` — `src/modal.ts`
- [x] 2.3 Render toolbar `<div class="cloudimage-toolbar">` with 5 mutually-exclusive buttons (None, Small 400px, Medium 600px, Full 800px, Custom) after title, before drop zone — `src/modal.ts`
- [x] 2.4 Add custom size input row below toolbar: label "Width (px):" + numeric input, hidden by default, shown only when Custom preset active — `src/modal.ts`
- [x] 2.5 Add CSS for `.cloudimage-modal-title`, `.cloudimage-toolbar`, `.cloudimage-toolbar-btn`, active state (`--interactive-accent`), `.cloudimage-toolbar-custom`, and custom input styling — `styles.css`

## Phase 3: Integration (wiring size through upload and insert)

- [x] 3.1 Add `getEffectiveSize()` helper: returns preset value for Small/Medium/Full, `customSizeValue` for Custom, `null` for None — `src/modal.ts`
- [x] 3.2 Add custom size validation in `handleUpload()`: when Custom is active, reject empty/non-numeric/<50/>2000 with `new Notice("...")` and early return — `src/modal.ts`
- [x] 3.3 Wire `getEffectiveSize()` into file upload path: pass as 4th argument to `insertAtCursor()` in `handleUpload()` — `src/modal.ts`
- [x] 3.4 Wire `getEffectiveSize()` into URL insert path: pass as 4th argument to `insertAtCursor()` in `handleUpload()` URL branch — `src/modal.ts`
- [x] 3.5 Verify history thumbnail clicks call `insertAtCursor()` without `size` (3-arg form, no pipe) — no code change needed; confirm existing call site in `src/modal.ts:358`

## Phase 4: Verification

- [x] 4.1 Run `tsc --noEmit` — assert zero errors with new optional parameter at all call sites
- [ ] 4.2 Manual smoke test: open modal, verify muted title, toolbar renders, None selected by default
- [ ] 4.3 Manual integration test: upload file with Small → `![alt|400](url)`; URL insert with Medium → `![alt|600](url)`; Custom+847 → `![alt|847](url)`; None → `![alt](url)`; history click ignores size
- [ ] 4.4 Manual validation test: Custom with empty / "abc" / "30" / "2500" → Notice error, no insert
