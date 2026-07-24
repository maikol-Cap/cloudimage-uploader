# Apply Progress: Multi-Provider Image Upload — PR #1 of 4

## Completed

### Phase 1: Shared Provider Types ✅
- **1.1** Created `src/providers/types.ts` (56 lines): `ImageUploadProvider` interface, `UploadResult` type, `UploadError` interface, `isCorsError()` function, `formatUploadError()` function with provider-specific CORS messages.
- **1.2** Created `src/providers/registry.ts` (13 lines): `ProviderRegistry` class with `Map<string, ImageUploadProvider>` backing store, `register()` and `get()` methods.

### Phase 2: Types Update ✅
- **2.1** Updated `src/types.ts`: Added `Account` type with `id`, `name`, `provider` discriminator (`"imgbb" | "r2" | "b2"`), and flat optional credential fields for all three providers.
- **2.2** Updated `CloudImagePluginSettings`: Added `accounts: Account[]` and `lastUsedAccountId: string | null`. Removed `apiKey` from `DEFAULT_SETTINGS` but kept `apiKey?: string` on the interface for backward compat during the chain.
- **2.3** Made `UploadedImage.deleteUrl` optional (`deleteUrl?: string`). Removed `ImgBBUploadResult`.

### Phase 3: ImgBB Provider Extraction ✅
- **3.1** Created `src/providers/imgbb.ts` (99 lines): `ImgBBProvider` implementing `ImageUploadProvider`. `ImgBBError` class moved here. Same API_URL, same FormData encoding, same error handling, same testConnection (1x1 PNG upload).
- **3.2** Replaced `src/api.ts` with a re-export stub (21 lines): `ImgBBClient` delegates to `ImgBBProvider` instance, preserving the static API that `settings.ts` and `modal.ts` depend on. `ImgBBError` is re-exported from `providers/imgbb.ts`.
- **3.3** Fixed type errors: `displayUrl: result.displayUrl ?? result.url` in modal.ts (now `string | undefined` → `string`), `setValue(nullable)` in settings.ts, `testBtn.disabled(nullable)` in settings.ts.

### PR 1 Verification ✅
- **3.4** `tsc --noEmit`: **0 errors** ✅
- **3.5** `npm run build`: **main.js produced (13.7kb)** ✅

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `src/providers/types.ts` | Created | 56 |
| `src/providers/registry.ts` | Created | 13 |
| `src/providers/imgbb.ts` | Created | 99 |
| `src/types.ts` | Modified | 54 |
| `src/api.ts` | Replaced (stub) | 21 |
| `src/modal.ts` | Modified (compat) | +1 |
| `src/settings.ts` | Modified (compat) | +2 |
| **Total** | | **~243 lines** |

## Deviations from Design

1. **`src/api.ts` kept as re-export stub instead of deleted**: The tasks said "Delete `src/api.ts`", but `settings.ts` and `modal.ts` still import `ImgBBClient` and `ImgBBError` from it. These consumers are rewritten in PR 3/4. Deleting `src/api.ts` now would break tsc in PR 1. The stub delegates to the new `ImgBBProvider` instance via the same static API, so behavior is byte-identical and all existing callers compile. The stub will be deleted in PR 4 when modal.ts is rewritten.

2. **`CloudImagePluginSettings.apiKey` kept as optional**: Removed from `DEFAULT_SETTINGS` but kept `apiKey?: string` on the interface so `settings.ts` and `modal.ts` don't break. Will be fully removed in PR 4.

3. **`UploadedImage.displayUrl` kept as `string` (not optional)**: The old type has `displayUrl: string` and many callers depend on it being non-null. The adapter bridges `result.displayUrl ?? result.url` to provide a fallback from the new `UploadResult` which has `displayUrl?: string`. Full optionality will align in PR 4.

## Remaining Tasks (PR 1)

All PR 1 tasks complete. Parent-owned task 3.6 (bounded review) remains for the orchestrator.

## Chain State

```
stacked-to-main: 4 PRs → main in order

PR #1 (✅ DONE): Provider scaffold + ImgBB extraction → main (~243 lines)
  ↓
PR #2 (pending): R2 + B2 providers → main (~370 lines)
  ↓
PR #3 (pending): Settings migration + Account CRUD UI → main (~250 lines)
  ↓
PR #4 (pending): Modal updates + verification → main (~140 lines)
```

## Verification Evidence

```
$ npx tsc --noEmit
(npm notice only — zero errors)

$ npm run build
main.js  13.7kb
⚡ Done in 7ms
```
