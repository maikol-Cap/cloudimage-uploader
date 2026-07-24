# Design: Multi-Provider Image Upload

Replaces the hardwired ImgBB-only upload pipeline with a provider abstraction supporting ImgBB, Cloudflare R2, and Backblaze B2 — with multiple accounts per provider, account CRUD in settings, and an account selector in the upload modal.

## Quick Path

1. Read the **Architecture Decisions** table — every structural choice is there.
2. Scan the **sequence diagrams** for the three upload flows and migration.
3. Check **File Changes** to see what gets created, modified, and deleted.
4. Review **Error Propagation** for the CORS detection heuristic and error hierarchy.

---

## Architecture Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| **Account model** | Flat optional fields on a single `Account` type with `provider` literal discriminator | Discriminated union (`ImgBBAccount \| R2Account \| B2Account`) would add a type-narrowing step at every credential access site — the provider already knows what fields it needs via its credential type definition. Flat optional fields keep serialization trivial (Obsidian's `data.json` is plain JSON, no tagged unions) and avoid migration fragility. The `provider` literal acts as the discriminator; validation at save time guarantees only the matching provider's fields are populated. |
| **Provider interface** | `ImageUploadProvider` with `upload(file, credentials, name?) → UploadResult` and `testConnection(credentials) → { ok, message? }` | Credentials are passed as `Record<string, string>` — the provider extracts what it needs. This avoids coupling the interface to the Account type and lets providers validate their own credential shape. The optional `name` parameter overrides the filename for all providers uniformly. |
| **Provider registry** | `Map<string, ImageUploadProvider>` in `ProviderRegistry` | Simple key-value lookup by `providerId` (the same literal used in `Account.provider`). No lazy loading needed — all 3 providers are instantiated once at plugin startup and kept memory-resident (~1 KB total). |
| **Settings migration** | Detect `apiKey` on `onload`, create ImgBB Account, delete `apiKey` | Runs exactly once. The migration creates an Account object with `provider: "imgbb"`, pushes it to `accounts[]`, sets `lastUsedAccountId`, and removes the old field. On subsequent loads `apiKey` is absent → no-op. Empty `apiKey` is deleted without creating an account. |
| **`deleteUrl` optionality** | `UploadedImage.deleteUrl: string \| undefined` | ImgBB sets it; R2 and B2 omit it. History rendering only reads `url`, `filename`, `uploadedAt` — no conditional needed. Deduplication by `url` still works. |
| **SHA-1 strategy** | `crypto.subtle.digest("SHA-1", buffer)` primary; manual chunked implementation fallback | SubtleCrypto is async and offloaded from the main thread — no UI freeze. The manual fallback (pure TypeScript SHA-1) covers environments where `crypto.subtle` is unavailable (older WebViews). The 32 MB Obsidian cap keeps the fallback tractable even if slower. |
| **AWS SigV4 scope** | `PUT`-only, no query params, no chunked upload, no STS | Obsidian's 32 MB cap means single PUT covers all uploads. Implementing only the subset needed avoids the complexity of the full S3 API surface. The signing key derivation (`kDate → kRegion → kService → kSigning`) is standard across all SigV4 implementations. |
| **CORS detection** | Inspect `response.status === 0`, `response.type === "opaque"`, or `TypeError` with network message | These three signals cover all browser CORS-blocking behaviors. The detection runs in a shared helper (`isCorsError`) used by both `upload()` and `testConnection()`. Electron desktop returns real status codes even without CORS config, so this heuristic only fires on mobile WebViews — exactly where it's needed. |
| **Error hierarchy** | Flat `UploadError` with `code` and `providerId` fields, rendered via `formatUploadError(error) → string` | A single error class avoids the complexity of per-provider error subclasses. The `code` field enables programmatic checks; `providerId` enables provider-specific messages. The `formatUploadError` function is the single place where error → Notice text mapping lives, including CORS-specific branching. |
| **Settings UI pattern** | Container div with card-based rendering, inline forms, no Svelte/React | Obsidian's `PluginSettingTab` provides `Setting` components, but account cards with dynamic provider forms need more flexibility. We use raw DOM creation (`createDiv`, `createEl`) on a container, matching the existing `UploadModal` pattern. No framework dependency. |
| **Account selector in modal** | `<select>` dropdown in the toolbar row, alongside the size selector | Simple, accessible, zero JS framework needed. Hidden when `< 2` accounts via `style.display`. Default value set before the modal paints to eliminate flicker. |

---

## File Structure

```
src/
├── providers/
│   ├── types.ts          # ImageUploadProvider, UploadResult, credential types, UploadError, isCorsError
│   ├── registry.ts       # ProviderRegistry (register / get)
│   ├── imgbb.ts          # ImgBBProvider
│   ├── r2.ts             # R2Provider (+ AWS SigV4 helpers)
│   └── b2.ts             # B2Provider (+ SHA-1 helpers)
├── types.ts              # Modified: Account, CloudImagePluginSettings, UploadedImage (deleteUrl optional)
├── api.ts                # Deleted: ImgBBClient extracted to providers/imgbb.ts
├── settings.ts           # Rewritten: Account CRUD card UI
├── modal.ts              # Modified: Account selector + provider-aware uploadAndInsert
└── editor.ts             # Unchanged
main.ts                   # Modified: Migration + registry setup
styles.css                # Modified: Account cards, forms, account selector
```

`src/providers/` is a new directory. Everything else modifies existing files. `src/api.ts` is deleted — `ImgBBError` moves to `providers/imgbb.ts`.

---

## Data Flow

### Upload with Account Resolution

```
UploadModal.handleUpload()
  └─ resolveAccount()
       ├─ settings.accounts (all)
       ├─ settings.lastUsedAccountId → find match
       └─ fallback: accounts[0]
  └─ provider = registry.get(account.provider)
  └─ credentials = extractCredentials(account)
  └─ provider.upload(file, credentials, name)
       ├─ ImgBBProvider  → POST FormData to api.imgbb.com
       ├─ R2Provider     → PUT with SigV4 to <accountId>.r2.cloudflarestorage.com
       └─ B2Provider     → b2_authorize → b2_get_upload_url → PUT
  └─ saveToHistory(UploadResult)
  └─ insertAtCursor(url, name, size)
```

### Error Propagation

```
provider.upload()
  └─ catch error
       ├─ isCorsError(error)?
       │    └─ throw UploadError { code: "CORS", providerId, message: corsMessage(providerId) }
       ├─ HTTP 4xx/5xx?
       │    └─ throw UploadError { code: "HTTP_ERROR", providerId, status, message }
       ├─ Network failure?
       │    └─ throw UploadError { code: "NETWORK_ERROR", providerId, message }
       └─ Other
            └─ throw UploadError { code: "UNKNOWN", providerId, message }

UploadModal.uploadAndInsert()
  └─ catch error
       └─ formatUploadError(error) → string
            ├─ CORS        → "R2: CORS not configured. In your Cloudflare R2 dashboard..."
            ├─ HTTP_ERROR  → "[Provider]: <status> — <body message>"
            └─ NETWORK     → "[Provider]: Network error — check your connection"
       └─ new Notice(message)
```

`formatUploadError` is the single mapping from `UploadError` to user-facing text. Provider-specific CORS messages are embedded there.

---

## Sequence Diagrams

### B2 Upload Flow

```
User          UploadModal          ProviderRegistry      B2Provider         Backblaze API
 |                |                       |                   |                   |
 |-- drop file -> |                       |                   |                   |
 |-- click Upload |                       |                   |                   |
 |                |-- resolveAccount()    |                   |                   |
 |                |-- registry.get("b2")  |                   |                   |
 |                |   => B2Provider       |                   |                   |
 |                |                       |                   |                   |
 |                |-- upload(file, creds, name) ------------>|                   |
 |                |                       |                   |                   |
 |                |                       |                   |-- GET /b2api/v3/  |
 |                |                       |                   |   b2_authorize_   |
 |                |                       |                   |   account          |
 |                |                       |                   |   Auth: Basic     |
 |                |                       |                   |   <base64(id:key)> |
 |                |                       |                   |                   |
 |                |                       |                   |<-- 200 { authToken,|
 |                |                       |                   |    apiUrl,         |
 |                |                       |                   |    downloadUrl }   |
 |                |                       |                   |                   |
 |                |                       |                   |-- POST <apiUrl>/  |
 |                |                       |                   |   b2api/v3/        |
 |                |                       |                   |   b2_get_upload_   |
 |                |                       |                   |   url              |
 |                |                       |                   |   Auth: authToken  |
 |                |                       |                   |   Body: {bucketId} |
 |                |                       |                   |                   |
 |                |                       |                   |<-- 200 { uploadUrl,|
 |                |                       |                   |    uploadAuthToken}|
 |                |                       |                   |                   |
 |                |                       |                   |-- crypto.subtle   |
 |                |                       |                   |   .digest("SHA-1",|
 |                |                       |                   |    file buffer)    |
 |                |                       |                   |   => hex SHA-1    |
 |                |                       |                   |                   |
 |                |                       |                   |-- PUT <uploadUrl> |
 |                |                       |                   |   Auth: uploadToken|
 |                |                       |                   |   X-Bz-File-Name   |
 |                |                       |                   |   X-Bz-Content-Sha1|
 |                |                       |                   |   Content-Type     |
 |                |                       |                   |   Body: file bytes |
 |                |                       |                   |                   |
 |                |                       |                   |<-- 200 { fileId,  |
 |                |                       |                   |    fileName, ... } |
 |                |                       |                   |                   |
 |                |                       |                   |-- construct URL:  |
 |                |                       |                   |   <downloadUrl>/   |
 |                |                       |                   |   file/<bucketName>|
 |                |                       |                   |   /<fileName>      |
 |                |                       |                   |                   |
 |                |<-- UploadResult { url } -----------------|                   |
 |                |                       |                   |                   |
 |                |-- saveToHistory()     |                   |                   |
 |                |-- insertAtCursor()    |                   |                   |
 |                |-- close()             |                   |                   |
```

### R2 Upload Flow

```
User          UploadModal          ProviderRegistry      R2Provider          Cloudflare R2
 |                |                       |                   |                   |
 |-- drop file -> |                       |                   |                   |
 |-- click Upload |                       |                   |                   |
 |                |-- resolveAccount()    |                   |                   |
 |                |-- registry.get("r2")  |                   |                   |
 |                |   => R2Provider       |                   |                   |
 |                |                       |                   |                   |
 |                |-- upload(file, creds, name) ------------>|                   |
 |                |                       |                   |                   |
 |                |                       |                   |-- compute AWS     |
 |                |                       |                   |   SigV4:           |
 |                |                       |                   |   kDate = HMAC(    |
 |                |                       |                   |     "AWS4" + key,  |
 |                |                       |                   |     YYYYMMDD)      |
 |                |                       |                   |   kRegion = HMAC(  |
 |                |                       |                   |     kDate, region) |
 |                |                       |                   |   kService = HMAC( |
 |                |                       |                   |     kRegion,"s3")  |
 |                |                       |                   |   kSigning = HMAC( |
 |                |                       |                   |     kService,      |
 |                |                       |                   |     "aws4_request")|
 |                |                       |                   |   signature = HMAC(|
 |                |                       |                   |     kSigning,       |
 |                |                       |                   |     stringToSign)  |
 |                |                       |                   |   => hex signature |
 |                |                       |                   |                   |
 |                |                       |                   |-- PUT https://     |
 |                |                       |                   |   <acctId>.r2.     |
 |                |                       |                   |   cloudflarestorage|
 |                |                       |                   |   .com/<bucket>/   |
 |                |                       |                   |   <file>           |
 |                |                       |                   |   Authorization:   |
 |                |                       |                   |   AWS4-HMAC-SHA256 |
 |                |                       |                   |   Credential=...   |
 |                |                       |                   |   SignedHeaders=...|
 |                |                       |                   |   Signature=...    |
 |                |                       |                   |   x-amz-date       |
 |                |                       |                   |   x-amz-content-   |
 |                |                       |                   |   sha256           |
 |                |                       |                   |   Content-Type     |
 |                |                       |                   |   Body: file bytes |
 |                |                       |                   |                   |
 |                |                       |                   |<-- 200 OK         |
 |                |                       |                   |                   |
 |                |                       |                   |-- url = pub-<hash>|
 |                |                       |                   |   .r2.dev/<file>   |
 |                |                       |                   |-- displayUrl =     |
 |                |                       |                   |   customDomain?    |
 |                |                       |                   |   <domain>/<file>  |
 |                |                       |                   |   : undefined      |
 |                |                       |                   |                   |
 |                |<-- UploadResult { url, displayUrl? } ----|                   |
 |                |                       |                   |                   |
 |                |-- saveToHistory()     |                   |                   |
 |                |-- insertAtCursor()    |                   |                   |
 |                |-- close()             |                   |                   |
```

### Settings Migration (One-Time)

```
Plugin.onload()
  |
  |-- loadData() => raw settings object
  |
  |-- Object.assign(DEFAULT_SETTINGS, raw)
  |
  |-- if (settings.apiKey !== undefined) ?
  |     YES:
  |       |-- if (settings.apiKey.trim() !== "") ?
  |       |     YES:
  |       |       |-- account = {
  |       |       |     id: crypto.randomUUID(),
  |       |       |     name: "ImgBB",
  |       |       |     provider: "imgbb",
  |       |       |     imgbbApiKey: settings.apiKey.trim()
  |       |       |   }
  |       |       |-- settings.accounts = [account]
  |       |       |-- settings.lastUsedAccountId = account.id
  |       |       |
  |       |     NO:
  |       |       |-- (skip — empty key, no account to create)
  |       |
  |       |-- delete settings.apiKey
  |       |-- await saveData(settings)
  |       |
  |     NO:
  |       |-- (already migrated — no-op)
  |
  |-- setup ProviderRegistry
  |-- addSettingTab
  |-- addCommand
  |-- done
```

### Account CRUD

#### Add Account

```
User                  Settings Tab                  Plugin
 |                        |                           |
 |-- click "+ Add" ->     |                           |
 |                        |-- render provider picker  |
 |                        |   (ImgBB / R2 / B2)       |
 |                        |                           |
 |-- select "R2" ->       |                           |
 |                        |-- render R2 fields:       |
 |                        |   Account ID, Access Key, |
 |                        |   Secret Key, Bucket,     |
 |                        |   Custom Domain (opt)     |
 |                        |   + Name field            |
 |                        |                           |
 |-- fill fields -------> |                           |
 |-- click Save --------> |                           |
 |                        |-- validate: all required  |
 |                        |   fields non-empty?       |
 |                        |   NO → show error, stop   |
 |                        |   YES → continue          |
 |                        |                           |
 |                        |-- account = {             |
 |                        |     id: randomUUID(),     |
 |                        |     name: "Blog Images",  |
 |                        |     provider: "r2",       |
 |                        |     r2AccountId: "...",   |
 |                        |     ...                   |
 |                        |   }                       |
 |                        |                           |
 |                        |-- settings.accounts.push  |
 |                        |   (account)               |
 |                        |-- saveData(settings) ---->|-- persist to data.json
 |                        |                           |
 |                        |-- re-render account list  |
 |                        |   (new card appears)      |
 |                        |-- close add form          |
```

#### Edit Account

```
User                  Settings Tab
 |                        |
 |-- click Edit on        |
 |   "R2 Work" card ->    |
 |                        |-- replace card content
 |                        |   with inline form
 |                        |   pre-populated with
 |                        |   current values
 |                        |-- provider type shown
 |                        |   but locked (read-only)
 |                        |
 |-- change bucket field  |
 |-- click Save --------> |
 |                        |-- validate required fields
 |                        |-- update account in
 |                        |   settings.accounts array
 |                        |-- saveData(settings)
 |                        |-- re-render card with
 |                        |   updated values
 |                        |-- close inline form
 |
 |-- click Cancel ------> |
 |                        |-- discard changes
 |                        |-- re-render card with
 |                        |   original values
```

#### Delete Account

```
User                  Settings Tab
 |                        |
 |-- click Delete on      |
 |   "ImgBB Personal" ->  |
 |                        |-- show confirmation:
 |                        |   "Delete account
 |                        |    'ImgBB Personal'?"
 |                        |   [Cancel] [Delete]
 |                        |
 |-- click Delete ------> |
 |                        |-- remove account from
 |                        |   settings.accounts
 |                        |
 |                        |-- was this the
 |                        |   lastUsedAccountId?
 |                        |   YES → update to first
 |                        |     remaining or null
 |                        |   NO → leave unchanged
 |                        |
 |                        |-- saveData(settings)
 |                        |-- re-render account list
 |                        |   (card removed)
 |                        |
 |                        |-- accounts.length === 0?
 |                        |   YES → show empty state
 |
 |-- click Cancel ------> |
 |                        |-- close confirmation
 |                        |-- no changes
```

---

## Interfaces / Contracts

```typescript
// ── src/types.ts ──────────────────────────────────────────

export interface Account {
  id: string;                    // crypto.randomUUID()
  name: string;                  // user-chosen label
  provider: "imgbb" | "r2" | "b2";

  // ImgBB
  imgbbApiKey?: string;

  // R2
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2Bucket?: string;
  r2CustomDomain?: string;       // optional

  // B2
  b2ApplicationKeyId?: string;
  b2ApplicationKey?: string;
  b2BucketId?: string;
  b2BucketName?: string;
}

export interface UploadedImage {
  url: string;
  displayUrl: string;
  deleteUrl?: string;            // CHANGED: string → string | undefined
  filename: string;
  uploadedAt: number;
}

export interface CloudImagePluginSettings {
  accounts: Account[];           // NEW
  lastUsedAccountId: string | null; // NEW
  uploadedImages: UploadedImage[];
  // apiKey removed (migrated)
}

export const DEFAULT_SETTINGS: CloudImagePluginSettings = {
  accounts: [],
  lastUsedAccountId: null,
  uploadedImages: [],
};

// ── src/providers/types.ts ─────────────────────────────────

export interface UploadResult {
  url: string;                   // always present
  displayUrl?: string;           // custom domain or ImgBB display_url
  deleteUrl?: string;            // ImgBB only
}

export interface ImageUploadProvider {
  providerId: string;            // "imgbb" | "r2" | "b2"
  displayName: string;           // "ImgBB" | "Cloudflare R2" | "Backblaze B2"
  upload(
    file: File,
    credentials: Record<string, string>,
    name?: string,
  ): Promise<UploadResult>;
  testConnection(
    credentials: Record<string, string>,
  ): Promise<{ ok: boolean; message?: string }>;
}

export interface UploadError {
  code: "CORS" | "HTTP_ERROR" | "NETWORK_ERROR" | "UNKNOWN";
  providerId: string;
  message: string;
  status?: number;               // for HTTP_ERROR
}

// Detects CORS failures across providers
export function isCorsError(error: unknown): boolean;

// Maps UploadError to user-facing Notice string
export function formatUploadError(error: UploadError): string;

// ── src/providers/registry.ts ──────────────────────────────

export class ProviderRegistry {
  private providers: Map<string, ImageUploadProvider> = new Map();

  register(provider: ImageUploadProvider): void;
  get(providerId: string): ImageUploadProvider | undefined;
}
```

---

## Key Implementation Details

### Settings Migration in `main.ts`

```typescript
async onload() {
  const raw = await this.loadData();
  this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);

  // One-time migration: apiKey → Account
  if ("apiKey" in raw) {
    const apiKey: string = (raw as any).apiKey?.trim() ?? "";
    if (apiKey) {
      const account: Account = {
        id: crypto.randomUUID(),
        name: "ImgBB",
        provider: "imgbb",
        imgbbApiKey: apiKey,
      };
      this.settings.accounts = [account];
      this.settings.lastUsedAccountId = account.id;
    }
    delete (this.settings as any).apiKey;
    await this.saveData(this.settings);
  }

  // Setup provider registry
  const registry = new ProviderRegistry();
  registry.register(new ImgBBProvider());
  registry.register(new R2Provider());
  registry.register(new B2Provider());
  // registry is passed to UploadModal and SettingsTab

  // ... rest of onload
}
```

### UploadAndInsert Rewrite in `modal.ts`

Current method validates `apiKey` directly. The new version:

```typescript
private async uploadAndInsert(
  file: File,
  name: string,
  mode: InsertMode,
  size?: number,
): Promise<void> {
  const account = this.resolveAccount();
  if (!account) {
    new Notice("No upload account configured. Add one in plugin settings.");
    return;
  }

  const provider = this.registry.get(account.provider);
  if (!provider) {
    new Notice(`Upload failed: provider '${account.provider}' is not available.`);
    return;
  }

  this.setLoading(true);

  try {
    const credentials = this.extractCredentials(account);
    const result = await provider.upload(file, credentials, name);

    this.saveToHistory({
      url: result.url,
      displayUrl: result.displayUrl ?? result.url,
      deleteUrl: result.deleteUrl,
      filename: name,
      uploadedAt: Date.now(),
    });

    this.insertUrl(result.url, name, mode, size);
  } catch (error) {
    if (error instanceof UploadError) {
      new Notice(formatUploadError(error));
    } else {
      new Notice("Upload failed: unexpected error");
    }
    this.setLoading(false);
  }
}

private resolveAccount(): Account | null {
  const { accounts, lastUsedAccountId } = this.plugin.settings;
  if (accounts.length === 0) return null;
  if (lastUsedAccountId) {
    const match = accounts.find(a => a.id === lastUsedAccountId);
    if (match) return match;
  }
  return accounts[0];
}

private extractCredentials(account: Account): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(account)) {
    if (typeof value === "string" && key !== "id" && key !== "name" && key !== "provider") {
      fields[key] = value;
    }
  }
  return fields;
}
```

### CORS Detection Heuristic

```typescript
// src/providers/types.ts

export function isCorsError(error: unknown): boolean {
  // Case 1: Response with status 0 (browser blocked)
  if (error instanceof Response && error.status === 0) return true;

  // Case 2: Response type is opaque
  if (error instanceof Response && error.type === "opaque") return true;

  // Case 3: TypeError from fetch — network-level CORS block
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    return msg.includes("failed to fetch") || msg.includes("networkerror");
  }

  return false;
}
```

Providers wrap their fetch errors through this:

```typescript
// Inside R2Provider.upload() catch block:
if (isCorsError(error)) {
  throw new UploadError({
    code: "CORS",
    providerId: "r2",
    message: "R2: CORS not configured. In your Cloudflare R2 dashboard, "
           + "add a CORS policy allowing your Obsidian origin and the PUT "
           + "method. See the plugin documentation for step-by-step instructions.",
  });
}
```

### SHA-1 Implementation Strategy

```typescript
// src/providers/b2.ts — internal helper

async function computeSha1(buffer: ArrayBuffer): Promise<string> {
  // Primary: Web Crypto API (async, offloaded from main thread)
  if (crypto?.subtle) {
    const hash = await crypto.subtle.digest("SHA-1", buffer);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback: manual SHA-1 (chunked with setTimeout yields for large files)
  return manualSha1(new Uint8Array(buffer));
}
```

The manual implementation is a standard SHA-1 round function (chunk size 64 bytes per block, 80 rounds per chunk). For a 32 MB file this processes ~524,288 blocks — tractable even on mobile when chunked with periodic yields.

### AWS SigV4 Scope

R2Provider's SigV4 implementation covers:

- **Signing key derivation**: `kDate = HMAC-SHA256("AWS4" + secretKey, YYYYMMDD)` → `kRegion = HMAC(kDate, "auto")` → `kService = HMAC(kRegion, "s3")` → `kSigning = HMAC(kService, "aws4_request")`. R2 uses `"auto"` as the region literal.
- **String to sign**: `AWS4-HMAC-SHA256\n<timestamp>\n<YYYYMMDD>/auto/s3/aws4_request\n<hex(sha256(canonicalRequest))>`
- **Canonical request**: `PUT\n/<bucket>/<encodedKey>\n\nhost:<host>\nx-amz-content-sha256:<hash>\nx-amz-date:<ts>\n\nhost;x-amz-content-sha256;x-amz-date\n<hex(sha256(""))>`
- **Headers sent**: `Authorization`, `x-amz-date`, `x-amz-content-sha256`, `Content-Type`

Not implemented: `x-amz-acl`, `x-amz-storage-class`, chunked upload, presigned URLs, multipart upload.

### Account Settings UI Rendering Strategy

The settings tab uses a container pattern:

```
display():
  containerEl.empty()

  // Account list section
  const listContainer = containerEl.createDiv("cloudimage-account-list")

  if (accounts.length === 0):
    renderEmptyState(listContainer)
  else:
    for each account:
      if editingThisAccount:
        renderEditForm(listContainer, account)
      else:
        renderAccountCard(listContainer, account)

  // "+ Add Account" button (always visible)
  if showingAddForm:
    renderAddForm(containerEl.createDiv("cloudimage-account-form"))
  else:
    renderAddButton(containerEl)
```

Each card is a div with:
- Name (bold)
- Provider badge (small colored pill: "ImgBB" / "R2" / "B2")
- Key info (bucket name, API domain)
- Action buttons row: [Edit] [Delete] [Test Connection]

Provider-specific form field mapping:

| Provider | Required Fields | Optional Fields |
|----------|----------------|-----------------|
| ImgBB | API Key | — |
| R2 | Account ID, Access Key ID, Secret Access Key, Bucket | Custom Domain |
| B2 | Application Key ID, Application Key, Bucket ID, Bucket Name | — |

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/providers/types.ts` | **New** | `ImageUploadProvider`, `UploadResult`, `UploadError`, `isCorsError`, `formatUploadError`, credential type definitions |
| `src/providers/registry.ts` | **New** | `ProviderRegistry` class (~25 lines) |
| `src/providers/imgbb.ts` | **New** | `ImgBBProvider` extracted from `src/api.ts`; `ImgBBError` moved here (~90 lines) |
| `src/providers/r2.ts` | **New** | `R2Provider` with AWS SigV4 PUT (~160 lines) |
| `src/providers/b2.ts` | **New** | `B2Provider` with 3-step upload + SHA-1 (~190 lines) |
| `src/types.ts` | **Modify** | Add `Account`, update `CloudImagePluginSettings` (+`accounts`, +`lastUsedAccountId`, -`apiKey`), update `DEFAULT_SETTINGS`, make `UploadedImage.deleteUrl` optional. Remove `ImgBBUploadResult`. Add migration helper type. |
| `src/api.ts` | **Delete** | `ImgBBClient` and `ImgBBError` extracted to `src/providers/imgbb.ts` |
| `src/settings.ts` | **Rewrite** | Account CRUD card list with add/edit/delete/test per account. ~220 lines. |
| `src/modal.ts` | **Modify** | Add account selector `<select>` in toolbar, `resolveAccount()`, `extractCredentials()`, `uploadAndInsert()` rewritten for provider flow. ~60 lines changed. |
| `src/editor.ts` | **Unchanged** | Provider-agnostic — only handles markdown insertion |
| `main.ts` | **Modify** | Migration logic, registry instantiation, pass registry to modal/settings. ~40 lines. |
| `styles.css` | **Modify** | Account cards, forms, provider badges, account selector, empty state. ~80 lines. |

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Type check | Compilation of all files with new types | `tsc --noEmit` |
| Unit (manual) | `isCorsError()` with `Response(status=0)`, `TypeError("Failed to fetch")`, `Response(status=403)` | Dev console in Obsidian |
| Unit (manual) | SHA-1: known vectors ("hello" → `aaf4c6...`, empty → `da39a3...`) | Dev console |
| Unit (manual) | AWS SigV4: compare against `aws-sdk-js` output for a known key/bucket/date | Dev console |
| Integration (manual) | ImgBB upload with migrated account → produces same result as before | Real Obsidian with test API key |
| Integration (manual) | R2 upload with valid credentials → public URL accessible | Real Obsidian with R2 test bucket |
| Integration (manual) | B2 upload with valid credentials → public URL accessible | Real Obsidian with B2 test bucket |
| UI (manual) | Account CRUD: add ImgBB/R2/B2 accounts, edit, delete | Open settings tab |
| UI (manual) | Test Connection: success and failure per provider | Click Test on each account |
| UI (manual) | Account selector: visible with 2+ accounts, hidden with 0-1, defaults correct | Open upload modal |
| UI (manual) | CORS error on mobile: R2/B2 without CORS → correct message | Obsidian mobile |
| UI (manual) | History with `deleteUrl: undefined` (R2/B2) → renders correctly | Upload, reopen modal, check history |
| Build | `npm run build` produces valid `main.js` | CLI |

---

## Migration / Rollout

### Upgrade Path

1. User updates plugin.
2. On first `onload`, migration detects `apiKey` → creates ImgBB Account → deletes `apiKey` → saves.
3. Existing uploads in `uploadedImages` are preserved unchanged. Their `deleteUrl` fields remain populated.
4. New uploads to ImgBB use the migrated account automatically (it's the only account, so `lastUsedAccountId` points to it).

### Rollback

1. **Code**: `git revert` to previous commit. `src/providers/` is additive; `src/api.ts` can be restored from history.
2. **Data**: User must manually extract `imgbbApiKey` from the first account in `data.json` and paste it into a `"apiKey"` field. The `accounts` array is ignored by the old plugin.
3. **Safety**: No images are deleted. History entries work regardless of upload method.

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Mobile CORS blocks R2/B2 | Medium | CORS-aware error messages guide user to configure. Documented in README and settings help text. |
| Plaintext credentials in data.json | Medium | Same as current ImgBB API key. Document scoped key usage. Obsidian provides no secure storage. |
| B2 SHA-1 on large files | Medium | SubtleCrypto is async/offloaded. Manual fallback chunked with yields. 32 MB cap makes it tractable. |
| R2 SigV4 signature errors | Medium | Implement only PUT subset. Test against known vectors. |
| Migration fails silently | Low | Migration runs synchronously in `onload` before any UI. If `saveData` fails, the migration retries on next load because `apiKey` is still present. |
| Account selector adds friction | Low | Hidden when ≤1 account. Defaults to last-used. Power users never see it. |
| Provider registry returns undefined | Low | `uploadAndInsert` checks for `undefined` before calling `upload`. Error Notice informs user. |
<br /></parameter>
