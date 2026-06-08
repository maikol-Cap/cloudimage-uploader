# Engram Export — CloudImage Uploader

> Exportación de la memoria persistente del proyecto. Contiene el historial completo de decisiones, arquitectura, specs y aprendizajes del desarrollo.

---

## Project State — v1.1.0

**Obsidian plugin completo** — CloudImage Uploader for ImgBB. Upload, URL insert, history, settings with test connection.

### New in v1.1.0

- ✅ **Test Connection fix**: button now reactively enables/disables as API key is typed
- ✅ **URL image naming**: pasted/entered URLs now show preview with editable name before inserting

### Files

- `main.ts` — Plugin entry, Ctrl+Shift+U command, settings tab
- `src/modal.ts` — UploadModal (drag/drop, paste, file picker, URL input, history grid)
- `src/api.ts` — ImgBBClient (upload, testConnection, 32MB validation, typed errors)
- `src/editor.ts` — EditorService.insertAtCursor()
- `src/settings.ts` — CloudImageSettingTab (API key input, Test Connection button)
- `src/types.ts` — CloudImagePluginSettings, UploadedImage, ImgBBUploadResult
- `styles.css` — Obsidian CSS variables, drop zone, spinner, history grid
- `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`

### Capabilities

- Upload to ImgBB (clipboard paste, drag & drop, file picker, URL)
- URL images: preview + editable name before insert
- History: last 50 images, deduplicated, name search, thumbnail grid
- Test connection from settings (reactive disabled state)
- Bundle: 10.1 KB (limit 100 KB)

### Gotchas & Learnings

- Clipboard paste in Obsidian requires document-level listener with `{ capture: true }` and `stopImmediatePropagation()` to beat Obsidian's global paste handler
- ImgBB has no key-validation endpoint; testConnection uploads a 1x1 pixel
- `import type` for Plugin class avoids circular dependency between main.ts ↔ settings.ts/modal.ts
- Obsidian modals intercept keyboard events; `scope.register` needed for Escape key
- Obsidian's Setting.addButton callback fires once at render — UI elements that react to other field changes must store component refs and update them manually
- History deduplication by URL prevents visual clutter
- Local history (data.json) scales fine even with 10,000+ entries

---

## SDD Proposal

### Intent
Obsidian plugin for one-shot image uploads to ImgBB via a modal UI (clipboard paste, drag-and-drop, file picker), injecting `![Alt](URL)` at the active editor cursor. Single provider, single image, free tier.

### Scope
- Configurable hotkey that opens the upload modal
- Modal with three input methods: clipboard paste (Ctrl+V), drag-and-drop zone, file picker button
- Image preview before upload
- POST multipart/form-data to `https://api.imgbb.com/1/upload` via native `fetch`
- Loading state: controls disabled, "Uploading..." feedback
- Inject `![Alt](URL)` at active editor cursor on success
- Notice notifications for success and failure
- Settings tab for ImgBB API key stored via Obsidian `loadData`/`saveData`

### Out of Scope
Multiple image providers, batch upload, image editing/resizing, gallery or image management UI, ImgBB deletion.

---

## SDD Specs

### modal-upload-ui

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Command Activation | SHALL | Open modal via registered command/hotkey |
| R2 | Drag-and-Drop | SHALL | Accept image files dropped onto drop zone |
| R3 | Clipboard Paste | SHALL | Accept images pasted via Ctrl+V / Cmd+V |
| R4 | File Picker | SHALL | Button opens native file picker filtered to images |
| R5 | Image Preview | SHALL | Render scaled preview of selected image |
| R6 | Loading State | SHALL | Disable inputs, show "Uploading..." during transfer |
| R7 | Modal Dismissal | SHALL | Close on Escape key or cancel button click |

### imgbb-api-client

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Multipart Upload | SHALL | POST file + API key as FormData to ImgBB endpoint |
| R2 | API Key Injection | SHALL | Read API key from plugin settings |
| R3 | Success Parsing | SHALL | Parse JSON response, return typed {url, displayUrl, deleteUrl} |
| R4 | Error Handling | SHALL | Surface descriptive errors for HTTP and ImgBB failures |
| R5 | File Size Validation | SHALL | Reject files > 32MB before any network request |

### editor-markdown-injection

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Cursor Detection | SHALL | Detect cursor position in active Markdown editor |
| R2 | Markdown Injection | SHALL | Insert ![Alt](URL) at cursor after upload |
| R3 | Alt Text Generation | SHALL | Derive alt text from filename or use default |
| R4 | Success Notification | SHALL | Show notice with URL on success |
| R5 | Error Notification | SHALL | Show notice with error details on failure |

### plugin-settings

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Settings Tab | SHALL | Register "CloudImage" tab in Obsidian settings |
| R2 | API Key Input | SHALL | Password-masked text field for ImgBB API key |
| R3 | Key Persistence | SHALL | Persist via Obsidian loadData/saveData |
| R4 | Key Validation | SHALL | Validate key presence before allowing upload |
| R5 | Default Settings | SHALL | Fall back to {apiKey: ""} on first load |

---

## SDD Design

Class-based architecture with four modules wired by Plugin entry point:

```
main.ts (Plugin Entry)
  ├── UploadModal (src/modal.ts)
  │     ├── drag/drop, paste, file picker
  │     ├── image preview
  │     ├── URL input
  │     └── history grid
  ├── ImgBBClient (src/api.ts)
  │     ├── upload (multipart POST)
  │     ├── testConnection (1x1 pixel)
  │     └── 32MB validation
  ├── EditorService (src/editor.ts)
  │     └── insertAtCursor (markdown injection)
  └── CloudImageSettingTab (src/settings.ts)
        ├── API key input
        └── Test Connection button
```

### Architecture Decisions

1. **Native fetch + FormData** over axios — zero runtime deps, Obsidian already has fetch
2. **Static ImgBBClient** over instance — simpler, no state needed
3. **CSS variables** for theme compatibility — uses Obsidian's --background-primary, --text-normal, etc.
4. **HTML file picker** over Electron dialog — works in mobile Obsidian too
5. **Obsidian loadData/saveData** for persistence — built-in, encrypted on desktop
6. **import type for Plugin** — avoids circular dependency between main.ts and settings.ts

---

## SDD Tasks

### Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 345–445 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |

### Work Units

| Unit | Goal | PR | Notes |
|------|------|-----|-------|
| 1 | Foundation + Settings | PR 1 | Plugin loads, settings tab works, key persists |
| 2 | API Client + Editor | PR 2 | Upload and injection — base: PR 1 |
| 3 | Modal + Main + Styles | PR 3 | Full flow end-to-end — base: PR 2 |

---

## Session History

### Session 1 — Planning + PRs 1-3

**Goal**: Build complete Obsidian plugin for ImgBB uploads using SDD workflow.

**Accomplished**:
- ✅ SDD init, proposal, specs, design, tasks
- ✅ PR 1: Foundation — package.json, tsconfig, manifest, esbuild config, settings tab
- ✅ PR 2: Modal UI — drag/drop, clipboard paste, file picker, preview, editor injection, styles
- ✅ PR 3: ImgBB API — upload with validation, test connection, full flow wired

### Session 2 — Features + Polish

**Goal**: Add history, URL insert, image naming, and UI redesign.

**Accomplished**:
- ✅ Clipboard paste fix (document capture phase)
- ✅ URL insert (auto-detect + manual input)
- ✅ History grid with dedup, search, broken thumbnail fallback
- ✅ Custom image naming on upload
- ✅ UI redesign: progressive disclosure, collapsible history, unified drop zone
- ✅ Code audit: removed 3 unnecessary class fields, confirmed zero dead code
- ✅ Build: 9.6 KB bundle (under 100 KB limit)

### Session 3 — Export + GitHub

**Goal**: Export project for GitHub and install in vault.

**Accomplished**:
- ✅ Installed gh CLI
- ✅ Authenticated with GitHub
- ✅ Exported Engram memory to this file
- ✅ Project ready for GitHub upload

### Session 4 — v1.1 Fixes

**Goal**: Fix Test Connection button + add URL image naming.

**Accomplished**:
- ✅ Test Connection button now reactively enables/disables as API key is typed
- ✅ URL images now show preview with editable name before insert (matching file upload UX)
- ✅ Build: 10.1 KB

**Files changed**:
- `src/settings.ts` — stored ButtonComponent ref, update setDisabled() in onChange
- `src/modal.ts` — added selectedUrl field, handleUrl() + handleUpload() dual-mode

---

## Key Learnings

1. **Clipboard paste in Obsidian** requires document-level listener with `{ capture: true }` and `stopImmediatePropagation()` to beat Obsidian's global paste handler
2. **ImgBB has no key-validation endpoint** — testConnection uploads a 1x1 transparent PNG
3. **`import type` for Plugin class** avoids circular dependency between main.ts ↔ settings.ts/modal.ts
4. **Obsidian modals intercept keyboard events** — `scope.register` is needed for Escape key
5. **Bundle size**: 9.6 KB — well under 100 KB constraint
6. **Local history (data.json)** scales fine even with 10,000+ entries
7. **Progressive disclosure** (hidden preview, collapsed history) improves cognitive clarity

---

*Exported from Engram — newproyect project — 2026-06-08*
