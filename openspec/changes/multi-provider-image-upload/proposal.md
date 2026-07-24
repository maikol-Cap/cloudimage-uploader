# Proposal: Multi-Provider Image Upload

## Intent

Cloudimage-uploader currently hardwires ImgBB as the only image host, creating platform lock-in. Users who outgrow ImgBB's free tier or have compliance requirements (data residency, existing Cloudflare/B2 infrastructure) cannot use the plugin with their own storage. Adding Cloudflare R2 and Backblaze B2 alongside ImgBB — with support for **multiple accounts per provider** — lets users maximize free tiers, separate personal and work uploads, and choose the host that fits their stack, cost model, and compliance needs.

## Scope

### In Scope

- **Provider abstraction**: interface (`ImageUploadProvider`) + strategy pattern so providers are interchangeable
- **Account model**: users can create multiple named accounts of any provider type (e.g., two B2 accounts, one R2, one ImgBB). Each account stores its own credentials
- **ImgBB refactor**: extract existing `ImgBBClient` logic into an `ImgBBProvider` implementing the interface; no behavior change
- **Cloudflare R2 provider**: S3-compatible upload via AWS Signature V4 PUT; configurable custom domain per account
- **Backblaze B2 provider**: 3-step B2 upload flow (`b2_authorize_account` → `b2_get_upload_url` → PUT); SHA-1 hashing on the client side
- **Account CRUD settings UI**: list of accounts with Add / Edit / Delete / Test Connection per account; each account has a user-chosen name, a provider type, and provider-specific credential fields
- **Account selector in upload modal**: dropdown listing all configured accounts; defaults to the last-used account; user can switch without opening settings
- **Test connection** for every account: provider-specific logic (ImgBB: tiny image upload; R2: PUT + HEAD; B2: authorize + list buckets)
- **CORS-aware error messages**: surface actionable messages when uploads fail due to CORS misconfiguration
- **Last-used account persisted**: `lastUsedAccountId` in settings determines the default account in the upload modal
- **One-time migration**: existing `apiKey` → a named ImgBB account on first load after upgrade, zero user action

### Out of Scope

- Batch/multiple image upload
- Image deletion or lifecycle management from the plugin
- Presigned URL generation exposed to the user
- Provider-specific per-file size limits beyond what each provider enforces natively (the 32 MB Obsidian cap remains)
- R2 multipart upload for files above 5 GB (irrelevant given Obsidian's 32 MB cap)
- Migration wizard or automatic credential conversion
- Sharing accounts between vaults (accounts are vault-local via data.json)

## Capabilities

### New Capabilities

- `account-model`: `Account` type with `id`, `name`, `provider`, and provider-specific credential fields. `CloudImagePluginSettings` gains `accounts: Account[]` and `lastUsedAccountId: string | null`. Accounts are created/edited/deleted in settings and selected in the upload modal.
- `provider-abstraction`: `ImageUploadProvider` interface with `upload(file, credentials, name?) → UploadResult`, `testConnection(credentials) → boolean`, and metadata (`providerId`, `displayName`). A `ProviderRegistry` resolves an account to its provider instance at runtime.
- `r2-provider`: S3-compatible `PUT` upload to Cloudflare R2. Requires Account ID, Access Key ID, Secret Access Key, bucket name, and optional custom domain/endpoint. Computes AWS Signature V4 on the client side. Public URL generation supports custom domains when configured.
- `b2-provider`: 3-step Backblaze B2 upload (`b2_authorize_account`, `b2_get_upload_url`, file `PUT` to upload URL). Requires Application Key ID, Application Key, Bucket ID, and Bucket name. Computes SHA-1 on the client side for the `X-Bz-Content-Sha1` header. Public URL: `<downloadUrl>/file/<bucketName>/<fileName>`.
- `account-crud-settings-ui`: List of accounts in the settings tab. Each account card shows its name, provider type, and bucket/api info. Buttons: Edit (inline form), Delete, Test Connection. "+ Add Account" button opens a form where the user chooses a provider type, fills credentials, and names the account.
- `account-selector-modal`: Dropdown in the UploadModal letting the user choose which account to upload to. Defaults to `lastUsedAccountId`. Selecting a different account updates `lastUsedAccountId` for next time. User is never forced to choose — the default works immediately.
- `cors-aware-errors`: Catch CORS failures and emit provider-specific messages (`"R2: CORS not configured. Allow your Obsidian origin in the bucket settings"`, `"B2: CORS not configured. Add b2_download_authorize in bucket settings"`).

### Modified Capabilities

- `imgbb-provider`: Extracted from static `ImgBBClient` into a class implementing `ImageUploadProvider`. Behavior preserved exactly — same API endpoint, same FormData encoding, same error codes.
- `upload-history`: `UploadedImage.deleteUrl` becomes optional (`deleteUrl?: string`). ImgBB sets it; R2 and B2 leave it undefined. History deduplication by URL still works.
- `settings-model`: `CloudImagePluginSettings` replaces flat `apiKey` with `accounts: Account[]` and `lastUsedAccountId: string | null`. The old `apiKey` is migrated to an ImgBB account on first load.
- `upload-modal-flow`: `UploadModal.uploadAndInsert()` resolves the active account and its provider from settings instead of hardcoding ImgBB. An account selector dropdown appears in the modal. Error handling catches provider-agnostic errors.

## Approach

### Architecture: Account Model + Strategy Pattern

```
CloudImagePlugin
  └── settings.accounts → Account[]  (list of named accounts)
  └── settings.lastUsedAccountId → string | null
  └── ProviderRegistry.get(account.provider) → ImageUploadProvider

UploadModal
  └── Account selector dropdown (defaults to lastUsedAccountId)
  └── On upload: resolve account → provider → upload

ImageUploadProvider (interface)
  ├── ImgBBProvider    → POST FormData to api.imgbb.com
  ├── R2Provider       → PUT with AWS Signature V4 to R2
  └── B2Provider       → b2_authorize → b2_get_upload_url → PUT
```

1. **Define `Account` type** in `src/types.ts`. Each account has:
   - `id: string` (generated UUID or crypto.randomUUID())
   - `name: string` (user-chosen label, e.g. "B2 Personal", "R2 Work")
   - `provider: "imgbb" | "r2" | "b2"`
   - Provider-specific credential fields (flat optional on Account, validated by provider type)

2. **Define `ImageUploadProvider` interface** in `src/providers/types.ts`. Methods: `upload(file, credentials, name?) → UploadResult`, `testConnection(credentials) → boolean`, `providerId`, `displayName`. `UploadResult` replaces `ImgBBUploadResult` with `url` guaranteed; `displayUrl` and `deleteUrl` optional.

3. **Extract `ImgBBProvider`** from `src/api.ts`. Same logic, new interface. The old `ImgBBClient` static class is removed.

4. **Implement `R2Provider`**: AWS Signature V4 PUT. Custom domain per account. Test: PUT 1-byte + HEAD.

5. **Implement `B2Provider`**: 3-step flow + SHA-1 via SubtleCrypto. Test: b2_authorize + b2_list_buckets.

6. **Add `ProviderRegistry`**: Indexed by provider type (`"imgbb"` → ImgBBProvider instance). Resolves an account to its upload provider.

7. **Redesign settings model**: `CloudImagePluginSettings` gains:
   - `accounts: Account[]` (default empty — migration populates it from old `apiKey`)
   - `lastUsedAccountId: string | null`
   - Old `apiKey` and `uploadedImages` remain during migration, then dropped after first save

8. **Redesign settings UI — Account CRUD list**:
   - Each account rendered as a card showing: name, provider badge ("ImgBB" / "R2" / "B2"), key info (bucket name / API domain)
   - Per card: [Edit] opens inline form with provider-specific fields; [Delete] with confirmation; [Test Connection]
   - "+ Add Account" button at the bottom → opens form: choose provider type, fill fields, name it, save
   - Empty state when no accounts exist: helpful message + Add button

9. **Redesign UploadModal — Account selector**:
   - New dropdown in the modal toolbar (next to size selector): "Account: [B2 Personal ▾]"
   - Populated from `settings.accounts`, sorted by name
   - Default selection: `lastUsedAccountId` if it exists and the account still exists; otherwise first account
   - On change: update `lastUsedAccountId` in settings and persist
   - If no accounts configured: show error message pointing user to settings
   - Hidden when only one account exists (no point showing a 1-option dropdown)

10. **Update `uploadAndInsert()`**: Resolves `account = settings.accounts.find(a => a.id === settings.lastUsedAccountId)`, then `provider = registry.get(account.provider)`, then `provider.upload(file, account, name)`. Credential check validates account fields.

11. **Make `deleteUrl` optional** in `UploadedImage`. History rendering already only uses `url`, `filename`, `uploadedAt`.

12. **One-time migration on first load**: Detect old `apiKey` field. If present and non-empty, create an Account `{ id: generated, name: "ImgBB", provider: "imgbb", imgbbApiKey: apiKey }`, push to `accounts[]`, set `lastUsedAccountId`, delete `apiKey`. For empty apiKey, just delete the field.

### CORS Handling

Obsidian desktop (Electron) has relaxed CORS enforcement, so R2 and B2 uploads are expected to work out of the box. Obsidian mobile uses a system WebView with standard CORS enforcement. This means:

- **R2**: Users MUST configure CORS in the R2 dashboard to allow the Obsidian mobile origin (`capacitor://localhost`, `https://*.obsidian.md`, or similar) and the `PUT` method. Without this, mobile uploads will fail with opaque responses.
- **B2**: Users MUST configure CORS in the B2 bucket settings to allow the Obsidian mobile origin and the specific headers B2 needs (`Authorization`, `X-Bz-File-Name`, `X-Bz-Content-Sha1`). Additionally, `b2_download_authorize` must be enabled for downloads via CORS.

The proposal surfaces CORS misconfiguration errors with provider-specific messages. It does NOT attempt to proxy uploads through a server (that would defeat the purpose of direct-to-cloud uploads).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/api.ts` | **Replaced** | `ImgBBClient` extracted into `src/providers/imgbb.ts`. |
| `src/types.ts` | **Modified** | New `Account` type with discriminated provider fields. `CloudImagePluginSettings` gains `accounts[]` + `lastUsedAccountId`. `UploadedImage.deleteUrl` becomes optional. `ImgBBUploadResult` replaced by shared `UploadResult`. |
| `src/settings.ts` | **Rewritten** | Account CRUD list UI with add/edit/delete/test per account. ~200 new lines. |
| `src/modal.ts` | **Modified** | Account selector dropdown in toolbar. `uploadAndInsert()` resolves account → provider → upload. ~40 lines changed. |
| `src/providers/imgbb.ts` | **New** | Existing ImgBB logic extracted as `ImgBBProvider`. ~80 lines. |
| `src/providers/r2.ts` | **New** | Cloudflare R2 provider with AWS Signature V4. ~150 lines. |
| `src/providers/b2.ts` | **New** | Backblaze B2 provider with 3-step upload + SHA-1. ~180 lines. |
| `src/providers/types.ts` | **New** | `ImageUploadProvider` interface, `UploadResult`, credential types. ~50 lines. |
| `src/providers/registry.ts` | **New** | `ProviderRegistry` indexed by provider type. ~20 lines. |
| `main.ts` | **Modified** | Migration logic, registry setup, settings init. ~30 lines. |
| `src/editor.ts` | **Unchanged** | Provider-agnostic — only handles markdown insertion. |
| `styles.css` | **Modified** | Styles for account cards, add/edit forms, account selector dropdown. ~60 lines. |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Obsidian mobile CORS** — R2/B2 uploads fail on mobile because system WebView enforces CORS while Electron (desktop) does not | Medium | High | Surface provider-specific CORS setup instructions in error messages and in settings UI (help text). Document CORS requirements in README. Accept that this is a platform limitation, not a plugin bug. |
| **Credential storage in Obsidian data.json** — API keys stored in plaintext in the vault's data.json | High | Medium | Obsidian's plugin data API stores to `data.json` unencrypted. This is the same risk as the current ImgBB API key. Document that users should use scoped keys (R2 API tokens with bucket-only access, B2 application keys with write-only). No mitigation in code — Obsidian provides no secure storage API. |
| **B2 SHA-1 computation on large files** — hashing a 32 MB file in the main thread before upload could freeze the UI | Medium | Medium | Use `crypto.subtle.digest("SHA-1", buffer)` which is async and offloaded. If SubtleCrypto is unavailable (older WebView), fall back to a chunked manual implementation with `setTimeout` yields. The 32 MB Obsidian cap makes this tractable. |
| **R2 Signature V4 complexity** — AWS SigV4 is error-prone to implement from scratch; incorrect signatures cause opaque 403 errors | Medium | Medium | Implement only the subset needed for a single PUT (no query params, no chunked upload, no STS). Use well-tested reference implementations as a guide. Add integration test instructions (manual, since no test runner is configured). |
| **ImgBB API rate limits** — unchanged from current behavior but now part of a larger system | Low | Low | No change to ImgBB upload logic. Existing `ImgBBError` handling preserved. |
| **Backward compatibility of settings** — `apiKey` field replaced by accounts array could break existing installations on upgrade | Medium | High | On first load after upgrade, detect old `apiKey`. If present, create an Account `{ name: "ImgBB", provider: "imgbb", imgbbApiKey: apiKey }`, push to `accounts[]`, set `lastUsedAccountId`, delete `apiKey`. Zero user action. |
| **User confusion with account vs provider** — users might not understand the account model initially | Medium | Low | Empty state guides user to create their first account. Each account card shows provider badge and key info. Test Connection gives immediate feedback. Account selector in modal is only shown when 2+ accounts exist. |
| **Account selector noise in modal** — showing a dropdown for every upload could feel like friction | Low | Low | Default is last-used account, so power users with one primary account never touch it. Hidden when only one account exists. |

## Rollback Plan

1. **Code rollback**: Revert to the last commit before the multi-provider merge. All new provider files are additive. The `ImgBBProvider` extraction wraps the same logic; a surgical revert of `src/api.ts` restores the old static class.
2. **Settings rollback**: Users who upgraded and then downgraded will have `accounts[]` and `lastUsedAccountId` in their `data.json`. The old plugin only reads `apiKey`. On downgrade, users must manually extract the ImgBB API key from their first account and paste it into the `apiKey` field. Document this in release notes.
3. **Data safety**: No images are deleted or moved. History entries work regardless of which account uploaded them.

## Dependencies

- **None external.** AWS Signature V4 and SHA-1 hashing are implemented in pure TypeScript using Web Crypto APIs available in Obsidian's runtime (Chromium/Electron).
- **No new npm packages.** Keeping the plugin dependency-free avoids conflicts with Obsidian's bundling requirements.
- **Provider dashboards:** R2 requires CORS configuration in Cloudflare dashboard. B2 requires CORS + `b2_download_authorize` in Backblaze dashboard. These are documented, not automated.

## Success Criteria

- [ ] Settings page shows account list with Add/Edit/Delete/Test Connection per account
- [ ] "+ Add Account" opens form: choose provider type (ImgBB/R2/B2), fill credential fields, name the account, save
- [ ] Multiple accounts of the same provider type can be created (e.g., two B2 accounts)
- [ ] Editing an account shows its current provider type and credentials; changing provider type resets fields
- [ ] Empty state with helpful message when no accounts exist, guiding user to create one
- [ ] Upload modal shows account selector dropdown only when 2+ accounts exist; hidden when 0 or 1
- [ ] Account selector defaults to last-used account; changing it persists as new default
- [ ] ImgBB uploads work identically to current behavior — same endpoint, same response handling
- [ ] R2 upload succeeds with valid credentials and produces a valid public URL
- [ ] B2 upload succeeds with valid credentials and produces a valid public URL
- [ ] Test Connection works for all three provider types with clear success/failure feedback
- [ ] CORS failures produce actionable error messages naming the provider
- [ ] Existing ImgBB `apiKey` is migrated to an ImgBB account on first load (zero user action)
- [ ] History with `deleteUrl: undefined` (R2/B2 uploads) displays correctly
- [ ] Build passes `tsc --noEmit` with zero errors
- [ ] `npm run build` produces a valid `main.js` bundle
- [ ] Obsidian mobile CORS limitations documented in settings help text and README
