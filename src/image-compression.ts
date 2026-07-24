// ---------------------------------------------------------------------------
// Image Compression — Canvas-based resize + WebP conversion
// No external dependencies. Uses browser-native Canvas API.
// ---------------------------------------------------------------------------

export interface CompressionOptions {
  maxWidth: number;
  format: "webp" | "original";
  quality: number; // 0–1, used for WebP and JPEG
  skipSmallImages: boolean;
  skipSmallThresholdKB: number;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

const SKIP_EXTENSIONS = new Set([".gif", ".svg"]);

/**
 * Compress an image file using Canvas API.
 * Returns a new File (or the original if compression was skipped).
 *
 * Rules:
 * - GIFs and SVGs → never touched
 * - Small images (< threshold) → skipped
 * - PNGs → resize only, keep as PNG (preserve transparency)
 * - JPEG and others → resize + optional WebP conversion
 */
export async function compressImage(
  file: File,
  options: CompressionOptions,
): Promise<CompressionResult> {
  const originalSize = file.size;

  // Skip small images
  if (options.skipSmallImages && originalSize < options.skipSmallThresholdKB * 1024) {
    return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
  }

  // Skip GIFs and SVGs — they lose animation/vector data
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (SKIP_EXTENSIONS.has(ext)) {
    return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
  }

  const isPng = file.type === "image/png";

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // If no resize needed and it's a PNG, skip entirely
    if (width <= options.maxWidth && isPng) {
      bitmap.close();
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    // Determine target dimensions
    let targetWidth = width;
    let targetHeight = height;
    if (width > options.maxWidth) {
      const ratio = options.maxWidth / width;
      targetWidth = options.maxWidth;
      targetHeight = Math.round(height * ratio);
    }

    // Draw to canvas at target size
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    // Determine output format
    // PNGs stay as PNG (only resized, preserve transparency)
    // Other images use the configured format
    let mimeType = file.type;
    if (!isPng && options.format === "webp") {
      mimeType = "image/webp";
    }

    const blob = await canvas.convertToBlob({
      type: mimeType,
      quality: options.quality,
    });

    bitmap.close();

    // Only return compressed version if it's actually smaller
    if (blob.size >= originalSize) {
      return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
    }

    // Build new filename with correct extension
    const nameBase = file.name.replace(/\.[^.]+$/, "");
    const newExt = !isPng && options.format === "webp" ? ".webp" : ext;
    const compressedFile = new File([blob], `${nameBase}${newExt}`, {
      type: mimeType,
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      originalSize,
      compressedSize: blob.size,
      wasCompressed: true,
    };
  } catch {
    // If anything fails (e.g., unsupported format), return original
    return { file, originalSize, compressedSize: originalSize, wasCompressed: false };
  }
}

/**
 * Build compression options from an Account's compression settings.
 */
export function getCompressionOptions(
  account?: Record<string, any>,
): CompressionOptions | null {
  if (!account?.compressionEnabled) return null;

  return {
    maxWidth: account.compressionMaxWidth ?? 1920,
    format: account.compressionFormat ?? "webp",
    quality: (account.compressionQuality ?? 85) / 100,
    skipSmallImages: true,
    skipSmallThresholdKB: account.compressionSkipThresholdKB ?? 200,
  };
}
