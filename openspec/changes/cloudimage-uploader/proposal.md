# Proposal: CloudImage Uploader (ImgBB Edition)

## Intent

Obsidian plugin for one-shot image uploads to ImgBB via a modal UI (clipboard paste, drag-and-drop, file picker), injecting `![Alt](URL)` at the active editor cursor. Single provider, single image, free tier.

## Scope

### In Scope
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

## Capabilities

### New Capabilities

- `modal-upload-ui`: Multi-input upload modal with clipboard paste, drag-drop, file selector, image preview, and loading state
- `imgbb-api-client`: Fetch wrapper for ImgBB POST with `FormData` + API key, JSON response parsing
- `editor-markdown-injection`: Detect active editor cursor and insert `![Alt](URL)` Markdown syntax
- `plugin-settings`: Obsidian settings tab with secure API key input persisted to plugin data

### Modified Capabilities

None — greenfield project.

## Approach

- `CloudImagePlugin extends Plugin`: register command, add settings tab
- `UploadModal extends Modal`: handle paste/drop/file events, render preview, manage loading state, invoke upload
- `ImgBBSettingsTab extends PluginSettingTab`: single text field for API key
- `api.ts`: `uploadToImgBB(file, apiKey)` using `fetch` + `FormData`
- CSS: Obsidian CSS variables (`--text-normal`, `--background-primary`, etc.) for theme compatibility
- Bundle via esbuild to single `main.js` < 100KB

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/main.ts` | New | Plugin entry point, command + settings registration |
| `src/modal.ts` | New | UploadModal class — UI, events, preview |
| `src/api.ts` | New | ImgBB HTTP client (fetch + FormData) |
| `src/settings.ts` | New | PluginSettingTab for API key |
| `src/types.ts` | New | ImgBB response and plugin data interfaces |
| `styles.css` | New | Modal styles using Obsidian CSS variables |
| `manifest.json` | New | Plugin manifest (id, name, version, minAppVersion) |
| `package.json` | New | devDeps: obsidian, esbuild, typescript |
| `esbuild.config.mjs` | New | Bundler configuration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ImgBB CORS blocked by Electron runtime | Low | ImgBB docs confirm open CORS; validate in early integration test |
| API key leaked in repository or bundle | Low | `.gitignore` for `data.json`; key never hardcoded, stored only in Obsidian plugin data |
| Free tier limits exceeded (file size, rate) | Med | Document limits clearly; surface descriptive error on 4xx responses |
| Plugin conflicts with other upload plugins | Low | Unique command ID namespace; no global overrides |

## Rollback Plan

Disable plugin via Obsidian Community Plugins settings. Delete plugin folder from `.obsidian/plugins/`. No data migrations required — previously uploaded images remain accessible on ImgBB.

## Dependencies

- `obsidian` (dev) — Plugin SDK types
- `esbuild` (dev) — TypeScript bundling
- `typescript ^5.0` (dev) — Type checking
- Runtime: Obsidian >= 1.0.0 (Electron), Node.js 18+

## Success Criteria

- [ ] Modal opens via configurable hotkey (default: Ctrl+Shift+U)
- [ ] Paste/drag-drop/file-pick → preview shown → upload → `![Alt](URL)` inserted at cursor
- [ ] Loading state blocks re-submission during transfer
- [ ] Notice notification on success (with URL) and failure (with error detail)
- [ ] API key persists across Obsidian restarts
- [ ] Final bundle < 100KB
