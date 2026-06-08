# Design: CloudImage Uploader (ImgBB Edition)

## Technical Approach

Greenfield Obsidian plugin. Four modules (modal, api, editor, settings) wired by a `Plugin` entry point. Class-based architecture following Obsidian SDK conventions (`Modal`, `PluginSettingTab`). Native `fetch` + `FormData` for HTTP. Zero runtime dependencies — esbuild bundles everything into `main.js`.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HTTP client | Native `fetch` + `FormData` | Zero deps, native in Electron; axios adds bundle bloat for a single POST |
| Service methods | Static methods on `ImgBBClient`, `EditorService` | Pure functions with no internal state; instance adds ceremony with no benefit |
| CSS theming | Obsidian CSS variables (`--background-primary`, `--text-normal`) | Required by community plugin review; respects all Obsidian themes |
| File picker | HTML `<input type="file" accept="image/*">` | Obsidian `FileSuggest` is for vault files, not OS filesystem; HTML input is simpler |
| Settings persistence | Obsidian `loadData()`/`saveData()` | Platform standard; encrypted-at-rest on mobile; no manual serialization needed |

## Data Flow

```
User hotkey ──→ Plugin ──→ UploadModal.open()
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
                 paste       drag/drop    file picker
                    │           │           │
                    └───────────┼───────────┘
                                ▼
                        image preview + filename/size
                                │
                          [Upload click]
                                │
                    ImgBBClient.upload(file, apiKey)
                                │
                      ┌─────────┴─────────┐
                      ▼                   ▼
                   success              error
                      │                   │
          EditorService.insertAtCursor   Notice(error)
                      │
                Notice("Uploaded: URL")
                      │
                  Modal.close()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `main.ts` | Create | Plugin entry: registers command + settings tab, loads/saves `CloudImagePluginSettings` |
| `src/modal.ts` | Create | `UploadModal extends Modal`: drop zone, paste/drag/pick, preview, loading state, wiring to API + editor |
| `src/api.ts` | Create | `ImgBBClient.upload()`: size validation (≤32MB), FormData POST, JSON parse, typed errors |
| `src/editor.ts` | Create | `EditorService.insertAtCursor()`: `editor.getCursor()` + `editor.replaceRange()` with `![alt](url)` |
| `src/settings.ts` | Create | `CloudImageSettingTab extends PluginSettingTab`: password field, auto-save via `saveData()` |
| `manifest.json` | Create | Plugin metadata (id, name, version, minAppVersion "1.0.0") |
| `package.json` | Create | devDeps: obsidian, esbuild, typescript ^5.0 |
| `tsconfig.json` | Create | ES2020 target, ESNext module, strict mode |
| `esbuild.config.mjs` | Create | Bundle `main.ts` → `main.js`, external obsidian, browser platform |
| `styles.css` | Create | Obsidian CSS variables; drop zone dashed border; preview containment |

## Interfaces / Contracts

```typescript
// src/settings.ts & main.ts — persisted via loadData/saveData
interface CloudImagePluginSettings {
  apiKey: string;
}
const DEFAULT_SETTINGS: CloudImagePluginSettings = { apiKey: "" };

// src/api.ts — ImgBB response parsing
interface ImgBBUploadResult {
  url: string;        // direct image URL → injected as markdown src
  displayUrl: string; // ImgBB viewer page URL
  deleteUrl: string;  // deletion URL (not exposed in UI per scope)
}
```

Note: `ImgBBUploadResult` fields map from ImgBB's `data.url`, `data.display_url`, `data.delete_url` — snake_case→camelCase conversion at parse boundary.

## Error Handling Strategy

| Error Mode | Surface To | Behavior |
|------------|-----------|----------|
| Missing API key | `new Notice("Please configure your ImgBB API key in settings")` | Abort before fetch; modal stays open |
| File > 32MB | `new Notice("File exceeds 32MB limit")` | Reject in `ImgBBClient` before network; modal stays open |
| Network failure | `new Notice("Network error: unable to reach ImgBB")` | Modal closes, no injection |
| ImgBB 4xx (invalid key, etc.) | `new Notice("Upload failed: {message}")` | Parse `error.message` from ImgBB JSON; modal closes |
| ImgBB 5xx | `new Notice("ImgBB server error ({status})")` | Modal closes; user can retry |
| No active Markdown editor | `new Notice("Image uploaded: {URL}")` | Upload succeeds, URL in notice for manual copy |
| Non-image paste/drop | Silent ignore (paste) / inline error text (drop) | Modal stays open; user can retry with valid image |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `api.ts` — FormData construction, size validation, response parsing | Mock `fetch` with `vi.fn()` or jest; test error paths |
| Unit | `editor.ts` — cursor position, markdown string generation | String-based: assert `replaceRange` called with correct `![alt](url)` |
| Manual | Full upload flow in Obsidian dev vault | Paste/drag/pick → preview → upload → verify `![alt](URL)` inserted |
| Manual | Settings persistence across restart | Save key, reload Obsidian, verify key present |

No E2E framework available for Obsidian plugins. Manual verification in a dev vault is the industry standard.

## Migration / Rollout

No migration required. First install: plugin appears in Community Plugins. Settings tab prompts for API key. Users obtain free ImgBB key at https://api.imgbb.com.

## Open Questions

- [ ] Should the modal support pasting image URLs (not just files) for re-upload to ImgBB? Out of scope per proposal, but worth user feedback.
- [ ] Should the plugin auto-detect `.md` file context and warn if user is not in a Markdown view? Spec handles this gracefully (notice with URL), but a pre-warning could reduce confusion.
