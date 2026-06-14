# CloudImage Uploader

Obsidian plugin to upload images to [ImgBB](https://imgbb.com) and insert them into your notes.

## Features

- Open upload modal via `Ctrl+Shift+U` (customizable hotkey)
- Paste images from clipboard, drag & drop, or file picker
- Preview image before uploading
- Auto-insert `![alt](url)` at cursor position
- API key configurable in Obsidian settings with connection test

## Prerequisites

- [Obsidian](https://obsidian.md) v1.0.0+
- Node.js 18+
- A free [ImgBB API key](https://api.imgbb.com)

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
├── main.ts              # Plugin entry point
├── src/
│   ├── modal.ts         # UploadModal (drag & drop, paste, preview)
│   ├── api.ts           # ImgBBClient (multipart upload)
│   ├── editor.ts        # EditorService (markdown injection)
│   ├── settings.ts      # CloudImageSettingTab (API key config)
│   └── types.ts         # Shared interfaces
├── manifest.json        # Obsidian plugin manifest
├── styles.css           # Modal styles (Obsidian theme variables)
└── esbuild.config.mjs   # Build config
```

## License
```js
console.log("hola mundo")
```

