# Tasks: CloudImage Uploader (ImgBB Edition)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 345–445 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + Settings | PR 1 | Plugin loads, settings tab works, key persists — independently verifiable |
| 2 | API Client + Editor + Tests | PR 2 | Unit-tested upload and injection — independently verifiable; base: PR 1 |
| 3 | Modal + Main + Styles + Integration | PR 3 | Full flow end-to-end — base: PR 2 |

## Phase 1: Foundation

- [ ] 1.1 Create `package.json` with `obsidian`, `esbuild`, `typescript ^5.0` as devDeps and build script `node esbuild.config.mjs production`
- [ ] 1.2 Create `tsconfig.json`: ES2020 target, ESNext module, strict mode, `baseUrl: "."`, paths for `src/*`
- [ ] 1.3 Create `manifest.json`: id `cloudimage-uploader`, name `CloudImage Uploader`, minAppVersion `1.0.0`
- [ ] 1.4 Create `esbuild.config.mjs`: bundle `main.ts` → `main.js`, external `obsidian`, platform `browser`
- [ ] 1.5 Create `src/types.ts`: `CloudImagePluginSettings { apiKey }` interface + `DEFAULT_SETTINGS` + `ImgBBUploadResult { url, displayUrl, deleteUrl }`

## Phase 2: Settings Module

- [ ] 2.1 Create `src/settings.ts`: `CloudImageSettingTab extends PluginSettingTab` with password-masked API key input, auto-save on change via `saveData()` — satisfies plugin-settings R1, R2, R3, R5

## Phase 3: API Client

- [ ] 3.1 Create `src/api.ts`: `ImgBBClient.upload(file, apiKey)` — size validation ≤32MB (R5), FormData POST to `https://api.imgbb.com/1/upload` (R1), no manual Content-Type (R1 scenario), snake_case→camelCase parse (R3), typed errors per design error table (R4)

## Phase 4: Editor Injection

- [ ] 4.1 Create `src/editor.ts`: `EditorService.insertAtCursor(editor, url, filename)` — derive alt text from filename without extension (R3), fallback `"image"` for unnamed blobs (R3 scenario), insert `![alt](url)` at cursor via `replaceRange` (R2), move cursor to end of inserted text (R2 scenario)

## Phase 5: Upload Modal

- [ ] 5.1 Create `src/modal.ts`: `UploadModal extends Modal` — drop zone with dashed border (R2), clipboard paste via `Ctrl+V`/`Cmd+V` with `ClipboardEvent.clipboardData.files` (R3), file picker button via hidden `<input type="file" accept="image/*">` (R4), image preview with filename/size via `URL.createObjectURL` (R5), loading state disables inputs + "Uploading..." text (R6), Cancel button + Escape dismissal (R7), wire to `ImgBBClient.upload()` on Upload click, call `EditorService.insertAtCursor()` on success, `new Notice()` for success/error feedback

## Phase 6: Plugin Entry

- [ ] 6.1 Create `main.ts`: `CloudImagePlugin extends Plugin` — `onload` registers command `cloudimage-uploader:upload` ("CloudImage: Upload image", hotkey `Ctrl+Shift+U`) opening `UploadModal`, adds `CloudImageSettingTab`, loads settings via `loadData()` with `DEFAULT_SETTINGS` fallback

## Phase 7: Styles

- [ ] 7.1 Create `styles.css`: use Obsidian CSS variables (`--background-primary`, `--text-normal`, etc.), drop zone dashed border with hover highlight, preview `max-width: 100%` containment, loading spinner via CSS animation, button styling consistent with Obsidian theme

## Phase 8: Verification

- [ ] 8.1 Unit tests: `api.test.ts` — mock `fetch`, assert FormData fields, 32MB rejection, success parse (snake_case map), error paths (400, 500, network); `editor.test.ts` — mock `replaceRange`, assert `![alt](url)` injection with filename alt and cursor position
- [ ] 8.2 Manual: full flow in Obsidian dev vault — paste/drag/pick → preview → upload → `![alt](URL)` at cursor → notice (editor R1–R5, modal R1–R7)
- [ ] 8.3 Manual: settings persistence across restart (settings R3, R5); error handling — no API key (settings R4), network failure, 4xx/5xx, 32MB rejection
- [ ] 8.4 Verify final `main.js` bundle < 100KB via `ls -lh main.js`
