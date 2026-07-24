# CloudImage Uploader

Obsidian plugin to upload images to ImgBB, Cloudflare R2, or Backblaze B2 and insert them into your notes. Supports multiple accounts per provider — use free tiers across different accounts.

## Features

- Open upload modal via `Ctrl+Shift+U` (customizable hotkey)
- Upload images to ImgBB, Cloudflare R2, or Backblaze B2
- Multiple accounts per provider (e.g., two B2 accounts, one R2, one ImgBB)
- Account selector in upload modal (defaults to last used)
- Paste images from clipboard, drag & drop, or file picker
- Preview image before uploading
- Image size selector (Small/Medium/Full/Custom)
- Auto-insert `![alt](url)` or `![alt|size](url)` at cursor position
- Raw URL insert for Excalidraw compatibility
- Upload history with search
- Connection test for all providers

## Prerequisites

- [Obsidian](https://obsidian.md) v1.0.0+
- Node.js 18+
- A free account on any of:
  - [ImgBB](https://api.imgbb.com) — free API key
  - [Cloudflare R2](https://developers.cloudflare.com/r2/) — free tier: 10 GB/month
  - [Backblaze B2](https://www.backblaze.com/cloud-storage) — free tier: 10 GB

> **Tip:** Create multiple accounts on the same provider (e.g., two B2 accounts) to stack free tiers.

## CORS Configuration (Required for Mobile)

Obsidian Desktop (Electron) works out of the box. **Obsidian Mobile requires CORS configuration** in your provider dashboard:

### Cloudflare R2
1. Go to your R2 bucket → Settings → CORS Policy
2. Add a rule allowing your Obsidian origin and the `PUT` method:
   ```json
   {
     "AllowedOrigins": ["capacitor://localhost"],
     "AllowedMethods": ["PUT", "GET", "HEAD"],
     "AllowedHeaders": ["*"]
   }
   ```

### Backblaze B2
1. Go to your B2 bucket → Bucket Settings → CORS Rules
2. Add a rule allowing your Obsidian origin:
   ```json
   [
     {
       "corsRuleName": "obsidian",
       "allowedOrigins": ["capacitor://localhost"],
       "allowedOperations": ["s3:PutObject", "s3:GetObject"],
       "allowedHeaders": ["*"]
     }
   ]
   ```
3. Also enable `b2_download_authorize` in bucket settings for downloads

If CORS is not configured, the plugin will show an error message telling you exactly what to fix.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Copy to your Obsidian vault for testing
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/cloudimage-uploader/
```

## Project Structure

```
├── main.ts              # Plugin entry point (migration + registry setup)
├── src/
│   ├── providers/        # Upload provider implementations
│   │   ├── types.ts      # ImageUploadProvider interface, UploadResult, CORS detection
│   │   ├── registry.ts   # ProviderRegistry
│   │   ├── imgbb.ts      # ImgBBProvider
│   │   ├── r2.ts         # R2Provider (AWS Signature V4)
│   │   └── b2.ts         # B2Provider (3-step upload + SHA-1)
│   ├── modal.ts          # UploadModal (drag & drop, paste, preview, account selector)
│   ├── editor.ts         # EditorService (markdown injection)
│   ├── settings.ts       # CloudImageSettingTab (account CRUD)
│   └── types.ts          # Shared types (Account, settings model)
├── manifest.json         # Obsidian plugin manifest
├── styles.css            # Modal + settings styles (Obsidian theme variables)
└── esbuild.config.mjs    # Build config
```

## License

MIT

