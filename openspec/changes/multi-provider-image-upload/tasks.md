# Tasks: Multi-Provider Image Upload

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~990 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Provider scaffold + ImgBB extraction → PR 2: R2 + B2 providers → PR 3: Settings migration + UI rewrite → PR 4: Modal updates + verification |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

---

## PR 1: Provider Abstraction + ImgBB Extraction (~230 lines)

Goal: define the provider interface, registry, types, and extract ImgBB logic without behavior change. `tsc --noEmit` passes at the end of this PR.

### Phase 1: Shared Provider Types

- [x] 1.1 Create `src/providers/types.ts` with `ImageUploadProvider` interface (`providerId`, `displayName`, `upload()`, `testConnection()`), `UploadResult` type (`url`, `displayUrl?`, `deleteUrl?`), `UploadError` interface (`code`, `providerId`, `message`, `status?`), `isCorsError()` function, and `formatUploadError()` function — follow the contracts in `specs/provider-abstraction/spec.md` and `specs/cors-aware-errors/spec.md`. <!-- sdd-owner: implementation -->
- [x] 1.2 Create `src/providers/registry.ts` with `ProviderRegistry` class: `Map<string, ImageUploadProvider>` backing store, `register(provider)` keyed by `providerId`, `get(providerId)` returning `ImageUploadProvider | undefined` — follow `specs/provider-abstraction/spec.md`. <!-- sdd-owner: implementation -->

### Phase 2: Types Update

- [x] 2.1 Update `src/types.ts`: add `Account` type with `id`, `name`, `provider` discriminator (`"imgbb" | "r2" | "b2"`), and flat optional credential fields (`imgbbApiKey?`, `r2AccountId?`, `r2AccessKeyId?`, `r2SecretAccessKey?`, `r2Bucket?`, `r2CustomDomain?`, `b2ApplicationKeyId?`, `b2ApplicationKey?`, `b2BucketId?`, `b2BucketName?`) — follow `specs/account-model/spec.md`. <!-- sdd-owner: implementation -->
- [x] 2.2 Update `CloudImagePluginSettings`: add `accounts: Account[]` and `lastUsedAccountId: string | null`, remove `apiKey` — update `DEFAULT_SETTINGS` accordingly. <!-- sdd-owner: implementation -->
- [x] 2.3 Make `UploadedImage.deleteUrl` optional (`deleteUrl?: string`). Remove `ImgBBUploadResult` (replaced by shared `UploadResult` from `providers/types.ts`). <!-- sdd-owner: implementation -->

### Phase 3: ImgBB Provider Extraction

- [x] 3.1 Create `src/providers/imgbb.ts` — extract `ImgBBClient` logic into `ImgBBProvider` implementing `ImageUploadProvider`. Move `ImgBBError` class here. Signature: `providerId = "imgbb"`, `displayName = "ImgBB"`, `upload(file, credentials, name?)` reads `credentials.imgbbApiKey`, `testConnection(credentials)` uploads 1x1 PNG. Behavior MUST be byte-identical to current `ImgBBClient`. Follow `specs/imgbb-provider/spec.md`. <!-- sdd-owner: implementation -->
- [x] 3.2 Delete `src/api.ts`. <!-- sdd-owner: implementation -->
- [x] 3.3 Run `tsc --noEmit` — fix all type errors introduced by the extraction and types changes. All IntelliSense errors MUST be resolved before this PR is complete. <!-- sdd-owner: implementation -->

### PR 1 Verification

- [x] 3.4 Run `tsc --noEmit` from project root — assert zero errors. <!-- sdd-owner: implementation -->
- [x] 3.5 Run `npm run build` — assert `main.js` is produced without errors. <!-- sdd-owner: implementation -->
- [ ] 3.6 Start or reuse bounded review for PR 1 diff. <!-- sdd-owner: parent -->

---

## PR 2: R2 + B2 Providers (~370 lines)

Goal: two new providers, each with upload + testConnection. Builds on PR 1's types and registry. `tsc --noEmit` passes.

### Phase 4: R2 Provider

- [x] 4.1 Create `src/providers/r2.ts` with `R2Provider` implementing `ImageUploadProvider`. Metadata: `providerId = "r2"`, `displayName = "Cloudflare R2"`. Follow `specs/r2-provider/spec.md`. <!-- sdd-owner: implementation -->
- [x] 4.2 Implement AWS Signature V4 for `PUT`: key derivation (`kDate → kRegion → kService → kSigning` using `HMAC-SHA256`), canonical request, string to sign, `Authorization` header. Use `crypto.subtle` for HMAC. Region: `"auto"`. Service: `"s3"`. <!-- sdd-owner: implementation -->
- [x] 4.3 Implement `upload()`: validate required credentials (`r2AccountId`, `r2AccessKeyId`, `r2SecretAccessKey`, `r2Bucket`), construct endpoint `https://<accountId>.r2.cloudflarestorage.com/<bucket>/<filename>-<uuid>.<ext>`, compute SigV4, `PUT` with `x-amz-date`, `x-amz-content-sha256`, `Content-Type`. Construct `url` as `https://pub-<hash>.r2.dev/<filename>` (or equivalent public URL). Construct `displayUrl` from `r2CustomDomain` when configured (handle trailing slash). Catch errors and classify CORS via `isCorsError`. <!-- sdd-owner: implementation -->
- [x] 4.4 Implement `testConnection()`: `PUT` a 1-byte test object to the bucket with SigV4, then `HEAD` the same object to verify it was written. Return `{ ok: true }` or `{ ok: false, message }`. Include CORS-specific messages on CORS failures. <!-- sdd-owner: implementation -->

### Phase 5: B2 Provider

- [x] 5.1 Create `src/providers/b2.ts` with `B2Provider` implementing `ImageUploadProvider`. Metadata: `providerId = "b2"`, `displayName = "Backblaze B2"`. Follow `specs/b2-provider/spec.md`. <!-- sdd-owner: implementation -->
- [x] 5.2 Implement SHA-1 computation: primary path via `crypto.subtle.digest("SHA-1", buffer)` returning hex string. Fallback: chunked manual SHA-1 implementation with `setTimeout` yields when `crypto.subtle` is unavailable. Test against known vectors ("hello" → `aaf4c61d...`, empty → `da39a3ee...`). <!-- sdd-owner: implementation -->
- [x] 5.3 Implement `upload()` — Step 1 `b2_authorize_account`: `GET https://api.backblazeb2.com/b2api/v3/b2_authorize_account` with `Authorization: Basic <base64(id:key)>`. Extract `authorizationToken`, `apiUrl`, `downloadUrl`. <!-- sdd-owner: implementation -->
- [x] 5.4 Implement `upload()` — Step 2 `b2_get_upload_url`: `POST <apiUrl>/b2api/v3/b2_get_upload_url` with `Authorization: <token>` and `{ bucketId }`. Extract `uploadUrl` and single-use `authorizationToken`. <!-- sdd-owner: implementation -->
- [x] 5.5 Implement `upload()` — Step 3 PUT file: `PUT <uploadUrl>` with headers `Authorization`, `X-Bz-File-Name` (URL-encoded), `Content-Type`, `X-Bz-Content-Sha1` (hex SHA-1 from 5.2), `Content-Length`. Construct public URL as `<downloadUrl>/file/<bucketName>/<fileName>`. Catch errors and classify CORS via `isCorsError`. <!-- sdd-owner: implementation -->
- [x] 5.6 Implement `testConnection()`: call `b2_authorize_account`, then `b2_list_buckets` (`POST <apiUrl>/b2api/v3/b2_list_buckets` with `{ accountId }`), verify configured `bucketId` is in the response. Return `{ ok: true }` or `{ ok: false, message }`. Include CORS-specific messages on CORS failures. <!-- sdd-owner: implementation -->

### PR 2 Verification

- [x] 5.7 Run `tsc --noEmit` — assert zero errors across all provider files. <!-- sdd-owner: implementation -->
- [x] 5.8 Run `npm run build` — assert `main.js` bundles correctly. <!-- sdd-owner: implementation -->
- [ ] 5.9 Start or reuse bounded review for PR 2 diff. <!-- sdd-owner: parent -->

---

## PR 3: Settings Migration + Account CRUD UI (~250 lines)

Goal: one-time migration in `main.ts`, complete settings UI rewrite, CSS for account cards. Builds on PR 2's types and registry. `tsc --noEmit` passes.

### Phase 6: Plugin Bootstrap + Migration

- [x] 6.1 Update `main.ts` `onload()`: instantiate `ProviderRegistry`, register all three providers (`ImgBBProvider`, `R2Provider`, `B2Provider`). Detect legacy `apiKey` in raw loaded data — if present and non-empty, create a named ImgBB Account (`name: "ImgBB"`, generated `id` via `crypto.randomUUID()`), push to `accounts[]`, set `lastUsedAccountId`, delete `apiKey`, `saveData()`. If `apiKey` is empty string, delete it without creating an account. Follow `specs/account-model/spec.md` migration scenario. <!-- sdd-owner: implementation -->
- [x] 6.2 Pass `ProviderRegistry` instance to `CloudImageSettingTab` and `UploadModal` constructors. Update `main.ts` constructor calls in `addSettingTab` and `addCommand` callback. <!-- sdd-owner: implementation -->

### Phase 7: Settings UI — Account CRUD

- [x] 7.1 Rewrite `src/settings.ts` `CloudImageSettingTab.display()`: replace API Key + Test Connection settings with account list container. Render empty state ("No upload accounts configured. Add one to start uploading images." + "+ Add Account" button) when `accounts.length === 0`. Follow `specs/account-settings-ui/spec.md`. <!-- sdd-owner: implementation -->
- [x] 7.2 Implement account card rendering: each card shows account `name` (bold), provider badge (colored pill: "ImgBB" / "R2" / "B2"), key info (ImgBB: "api.imgbb.com", R2: bucket name, B2: bucket name), action buttons: [Edit] [Delete] [Test Connection]. Card uses `createDiv`/`createEl` to build DOM. <!-- sdd-owner: implementation -->
- [x] 7.3 Implement "+ Add Account" flow: provider picker (ImgBB / Cloudflare R2 / Backblaze B2 dropdown or button group), dynamic credential fields per provider (section 7.4), account name field (defaults to provider display name if empty), [Save] [Cancel] buttons. Validate required fields non-empty before save. On save: `crypto.randomUUID()` for `id`, push to `accounts[]`, `saveData()`, re-render. Follow specs section "Add Account Flow". <!-- sdd-owner: implementation -->
- [x] 7.4 Implement provider-specific form field mappings — ImgBB: API Key. R2: Account ID, Access Key ID, Secret Access Key, Bucket, Custom Domain (optional). B2: Application Key ID, Application Key, Bucket ID, Bucket Name. Switching provider resets all credential fields. Sensitive fields rendered as password inputs with reveal/hide toggle. <!-- sdd-owner: implementation -->
- [x] 7.5 Implement inline Edit: clicking [Edit] replaces card content with pre-populated form (same fields as add, provider type shown but locked/read-only). [Save] updates account in `accounts[]` array in place, `saveData()`, re-renders card. [Cancel] discards changes and re-renders original card. <!-- sdd-owner: implementation -->
- [x] 7.6 Implement Delete with confirmation: show confirmation text "Delete account '<name>'?" with [Cancel] [Delete] buttons. On confirm: remove from `accounts[]`, update `lastUsedAccountId` if deleted account was the last-used (fall back to first remaining account or `null`), `saveData()`, re-render. On cancel: close confirmation, no changes. <!-- sdd-owner: implementation -->
- [x] 7.7 Implement Test Connection per account: call `registry.get(account.provider)?.testConnection(extractCredentials(account))`, show loading state on button during test, display success ("✓ Connection successful") or failure ("✗ <error message>") near the button. Button disabled during test. <!-- sdd-owner: implementation -->
- [x] 7.8 Add CORS help text in settings UI: below the account list or as a note on R2/B2 forms, document that desktop (Electron) has relaxed CORS while mobile (WebView) requires CORS configuration in the provider dashboard. Follow `specs/cors-aware-errors/spec.md` documentation requirement. <!-- sdd-owner: implementation -->

### Phase 8: Settings UI CSS

- [x] 8.1 Add `styles.css` rules for account cards (`.cloudimage-account-card`), provider badges (`.cloudimage-provider-badge` with color variants per provider), account forms (`.cloudimage-account-form`), empty state (`.cloudimage-account-empty`), test connection status (`.cloudimage-test-status`), password reveal toggle, delete confirmation dialog, and add button. <!-- sdd-owner: implementation -->

### PR 3 Verification

- [x] 8.2 Run `tsc --noEmit` — assert zero errors. <!-- sdd-owner: implementation -->
- [x] 8.3 Run `npm run build` — assert valid `main.js`. <!-- sdd-owner: implementation -->
- [ ] 8.4 Start or reuse bounded review for PR 3 diff. <!-- sdd-owner: parent -->

---

## PR 4: Upload Modal Updates + End-to-End Verification (~140 lines)

Goal: account selector in modal, provider-aware upload flow, final verification. Builds on PR 3's registered providers and settings.

### Phase 9: Modal — Account Selector + Upload Rewrite

- [x] 9.1 Update `UploadModal` constructor to accept `ProviderRegistry`. Store as private field. <!-- sdd-owner: implementation -->
- [x] 9.2 Add `resolveAccount()` helper to `UploadModal`: returns `Account | null`. If `accounts.length === 0` return `null`. If `lastUsedAccountId` matches an existing account, return it; otherwise return `accounts[0]`. <!-- sdd-owner: implementation -->
- [x] 9.3 Add `extractCredentials(account: Account): Record<string, string>` helper: iterate `Object.entries(account)`, collect string-valued fields excluding `id`, `name`, `provider`. <!-- sdd-owner: implementation -->
- [x] 9.4 Render account selector `<select>` in toolbar (`.cloudimage-toolbar`) alongside the size selector. Populate from `settings.accounts` sorted by name. Each option shows account name + provider badge. Pre-select based on `lastUsedAccountId` before the dropdown paints (no flicker). Hidden via `style.display = "none"` when `accounts.length <= 1`. On change: update `settings.lastUsedAccountId` to selected account `id` and `saveData()`. Follow `specs/account-selector-modal/spec.md`. <!-- sdd-owner: implementation -->
- [x] 9.5 Rewrite `uploadAndInsert()`: call `resolveAccount()` → if `null`, show Notice "No upload account configured. Add one in plugin settings." and return. Call `registry.get(account.provider)` → if `undefined`, show Notice and return. Call `extractCredentials(account)`, then `provider.upload(file, credentials, name)`. On success: `saveToHistory()` using `result.url`, `result.displayUrl ?? result.url`, `result.deleteUrl`, then `insertUrl()`. On catch: if `UploadError`, show `formatUploadError(error)`; otherwise show generic Notice. Loading state management unchanged from current. <!-- sdd-owner: implementation -->
- [x] 9.6 Update `handleInsertUrl()` to use the new provider flow. Same resolution logic as `uploadAndInsert()` for file mode. URL mode (already has a URL, no upload needed) remains unchanged from current behavior. <!-- sdd-owner: implementation -->
- [x] 9.7 Remove all references to `ImgBBClient`, `ImgBBError`, and `src/api` from modal imports. Replace with `ProviderRegistry`, `UploadError`, `formatUploadError` from provider modules. <!-- sdd-owner: implementation -->

### Phase 10: CSS — Account Selector

- [x] 10.1 Add `styles.css` rules for account selector dropdown (`.cloudimage-account-select`), account option with badge, hidden state, and toolbar layout accommodating both size and account selectors. <!-- sdd-owner: implementation -->

### Phase 11: Verification

- [x] 11.1 Run `tsc --noEmit` from project root — assert zero errors. <!-- sdd-owner: implementation -->
- [x] 11.2 Run `npm run build` — assert valid `main.js` bundle produced. <!-- sdd-owner: implementation -->
- [ ] 11.3 Manual: ImgBB upload with migrated account — verify same behavior as current plugin. <!-- sdd-owner: implementation -->
- [ ] 11.4 Manual: Account CRUD in settings — add ImgBB, R2, and B2 accounts; edit name and fields; delete with confirmation; verify empty state appears when all accounts deleted. <!-- sdd-owner: implementation -->
- [ ] 11.5 Manual: Account selector in modal — visible with 2+ accounts, hidden with 0-1, defaults to last-used, correctly persists selection. <!-- sdd-owner: implementation -->
- [ ] 11.6 Manual: Test Connection — success and failure per provider (at least ImgBB and one of R2/B2). <!-- sdd-owner: implementation -->
- [ ] 11.7 Manual: History rendering — upload via R2/B2 (no `deleteUrl`), verify history entries display correctly with URL and filename, no errors. <!-- sdd-owner: implementation -->
- [ ] 11.8 Manual: CORS error messages on mobile (if available) — upload to R2/B2 without CORS configured, verify provider-specific CORS message appears. <!-- sdd-owner: implementation -->

### PR 4 Verification

- [ ] 11.9 Start or reuse bounded review for PR 4 diff. <!-- sdd-owner: parent -->
