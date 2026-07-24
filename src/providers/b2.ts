import type { ImageUploadProvider, UploadResult } from "./types";
import { isCorsError } from "./types";

const AUTH_URL = "https://api.backblazeb2.com/b2api/v3/b2_authorize_account";

// ---------------------------------------------------------------------------
// SHA-1 helpers
// ---------------------------------------------------------------------------

/**
 * Compute the hex-encoded SHA-1 of a buffer.
 * Primary path: `crypto.subtle.digest("SHA-1", buffer)` (async, offloaded).
 * Fallback: chunked manual SHA-1 implementation.
 */
async function computeSha1(buffer: ArrayBuffer): Promise<string> {
  if (crypto?.subtle) {
    const hash = await crypto.subtle.digest("SHA-1", buffer);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback: manual SHA-1 with chunked yields
  return manualSha1(new Uint8Array(buffer));
}

/**
 * Manual SHA-1 implementation (RFC 3174).
 * Chunked with periodic `setTimeout` yields to avoid blocking the main thread.
 */
function manualSha1(data: Uint8Array): Promise<string> {
  return new Promise<string>((resolve) => {
    // SHA-1 functions
    function rotl(n: number, s: number): number {
      return ((n << s) | (n >>> (32 - s))) >>> 0;
    }

    function pad(message: Uint8Array): Uint8Array[] {
      const ml = message.length * 8; // message length in bits
      const padding = new Uint8Array(
        ((message.length + 8) >> 6) + 1 << 6,
      );
      padding.set(message);
      padding[message.length] = 0x80;

      // Append bit length as 64-bit big-endian
      const dv = new DataView(padding.buffer);
      dv.setUint32(padding.length - 4, ml, false); // high 32 bits (always 0 for < 512MB)
      // low 32 bits set by setUint32 at -4, but we need actual low 32 — wait, this is wrong.
      // Let me fix: ml is the full 64-bit length, high 32 in -8, low 32 in -4.
      // For files under 512MB, high 32 is 0.
      dv.setUint32(padding.length - 8, 0, false);
      dv.setUint32(padding.length - 4, ml, false);

      // Split into 512-bit (64-byte) chunks
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < padding.length; i += 64) {
        chunks.push(padding.slice(i, i + 64));
      }
      return chunks;
    }

    // Initialize state
    let h0 = 0x67452301;
    let h1 = 0xefcdab89;
    let h2 = 0x98badcfe;
    let h3 = 0x10325476;
    let h4 = 0xc3d2e1f0;

    const chunks = pad(data);


    function processNextChunks(
      start: number,
      batchSize: number,
    ): void {
      const end = Math.min(start + batchSize, chunks.length);

      for (let ci = start; ci < end; ci++) {
        const chunk = chunks[ci];
        const w = new Uint32Array(80);

        // Break chunk into 16 big-endian words
        for (let i = 0; i < 16; i++) {
          w[i] =
            ((chunk[i * 4] << 24) |
              (chunk[i * 4 + 1] << 16) |
              (chunk[i * 4 + 2] << 8) |
              chunk[i * 4 + 3]) >>>
            0;
        }

        // Extend to 80 words
        for (let i = 16; i < 80; i++) {
          w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
        }

        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;

        for (let i = 0; i < 80; i++) {
          let f: number;
          let k: number;

          if (i < 20) {
            f = (b & c) | (~b & d);
            k = 0x5a827999;
          } else if (i < 40) {
            f = b ^ c ^ d;
            k = 0x6ed9eba1;
          } else if (i < 60) {
            f = (b & c) | (b & d) | (c & d);
            k = 0x8f1bbcdc;
          } else {
            f = b ^ c ^ d;
            k = 0xca62c1d6;
          }

          const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
          e = d;
          d = c;
          c = rotl(b, 30);
          b = a;
          a = temp;
        }

        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
      }

      if (end < chunks.length) {
        // Yield to main thread, then continue
        setTimeout(() => processNextChunks(end, batchSize), 0);
      } else {
        // Finalize — produce 40 hex chars
        const hex = [h0, h1, h2, h3, h4]
          .map((h) => h.toString(16).padStart(8, "0"))
          .join("");
        resolve(hex);
      }
    }

    // Process in batches of 100 chunks per yield
    processNextChunks(0, 100);
  });
}

// ---------------------------------------------------------------------------
// B2Provider
// ---------------------------------------------------------------------------

interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  accountId: string;
}

interface B2UploadUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
}

export class B2Provider implements ImageUploadProvider {
  providerId = "b2" as const;
  displayName = "Backblaze B2";

  async upload(
    file: File,
    credentials: Record<string, string>,
    name?: string,
  ): Promise<UploadResult> {
    const appKeyId = credentials.b2ApplicationKeyId;
    const appKey = credentials.b2ApplicationKey;
    const bucketId = credentials.b2BucketId;
    const bucketName = credentials.b2BucketName;

    if (!appKeyId || !appKey || !bucketId || !bucketName) {
      throw {
        code: "UNKNOWN",
        providerId: "b2",
        message:
          "B2: Missing required credentials (b2ApplicationKeyId, b2ApplicationKey, b2BucketId, b2BucketName).",
      };
    }

    // Step 1: b2_authorize_account
    let auth: B2AuthResponse;
    try {
      auth = await this.authorizeAccount(appKeyId, appKey);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (err.code === "CORS") throw error;
      throw {
        code: "HTTP_ERROR",
        providerId: "b2",
        message: err.message || "B2: Authorization failed.",
      };
    }

    // Step 2: b2_get_upload_url
    let uploadLocation: B2UploadUrlResponse;
    try {
      uploadLocation = await this.getUploadUrl(
        auth.apiUrl,
        auth.authorizationToken,
        bucketId,
      );
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (err.code === "CORS") throw error;
      throw {
        code: "HTTP_ERROR",
        providerId: "b2",
        message: err.message || "B2: Failed to obtain upload URL.",
      };
    }

    // Step 3: PUT file to uploadUrl
    const bodyBuffer = await file.arrayBuffer();
    const sha1Hex = await computeSha1(bodyBuffer);
    const fileName = name || file.name;

    try {
      const putResponse = await fetch(uploadLocation.uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: uploadLocation.authorizationToken,
          "X-Bz-File-Name": encodeURIComponent(fileName),
          "Content-Type": file.type || "application/octet-stream",
          "X-Bz-Content-Sha1": sha1Hex,
          "Content-Length": String(bodyBuffer.byteLength),
        },
        body: new Uint8Array(bodyBuffer),
      });

      if (!putResponse.ok) {
        let bodyMsg = "";
        try {
          bodyMsg = await putResponse.text();
        } catch {
          // ignore
        }
        throw {
          code: "HTTP_ERROR",
          providerId: "b2",
          message: bodyMsg || `File upload failed (${putResponse.status})`,
          status: putResponse.status,
        };
      }

      // Construct public URL
      const publicUrl = `${auth.downloadUrl}/file/${encodeURIComponent(bucketName)}/${encodeURIComponent(fileName)}`;

      return { url: publicUrl };
    } catch (error) {
      const err = error as { code?: string; message?: string; status?: number };
      if (err.code === "HTTP_ERROR") throw error;
      if (isCorsError(error)) {
        throw {
          code: "CORS",
          providerId: "b2",
          message:
            "B2: CORS not configured. In your Backblaze B2 bucket settings, " +
            "add a CORS rule allowing your Obsidian origin and enable b2_download_authorize.",
        };
      }
      throw {
        code: "NETWORK_ERROR",
        providerId: "b2",
        message: "B2: Network error — check your connection.",
      };
    }
  }

  async testConnection(
    credentials: Record<string, string>,
  ): Promise<{ ok: boolean; message?: string }> {
    const appKeyId = credentials.b2ApplicationKeyId;
    const appKey = credentials.b2ApplicationKey;
    const bucketId = credentials.b2BucketId;

    if (!appKeyId || !appKey || !bucketId) {
      return {
        ok: false,
        message:
          "B2: Missing required credentials (b2ApplicationKeyId, b2ApplicationKey, b2BucketId).",
      };
    }

    // Step 1: authorize
    let auth: B2AuthResponse;
    try {
      auth = await this.authorizeAccount(appKeyId, appKey);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (err.code === "CORS") {
        return {
          ok: false,
          message:
            "B2: CORS not configured. In your Backblaze B2 bucket settings, " +
            "add a CORS rule allowing your Obsidian origin.",
        };
      }
      return {
        ok: false,
        message: `B2: Authorization failed (401). Check your Application Key ID and Application Key.`,
      };
    }

    // Step 2: list buckets
    try {
      const listResponse = await fetch(
        `${auth.apiUrl}/b2api/v3/b2_list_buckets`,
        {
          method: "POST",
          headers: {
            Authorization: auth.authorizationToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountId: auth.accountId,
          }),
        },
      );

      if (!listResponse.ok) {
        let bodyMsg = "";
        try {
          bodyMsg = await listResponse.text();
        } catch {
          // ignore
        }
        return {
          ok: false,
          message: `B2: Failed to list buckets (${listResponse.status})${bodyMsg ? ` — ${bodyMsg}` : ""}.`,
        };
      }

      const body = await listResponse.json();
      const buckets: Array<{ bucketId: string; bucketName: string }> =
        body.buckets || [];
      const found = buckets.find((b) => b.bucketId === bucketId);

      if (!found) {
        return {
          ok: false,
          message: `B2: Bucket '${bucketId}' not found in your account. Check your Bucket ID.`,
        };
      }

      return { ok: true };
    } catch (error) {
      if (isCorsError(error)) {
        return {
          ok: false,
          message:
            "B2: CORS not configured. In your Backblaze B2 bucket settings, " +
            "add a CORS rule allowing your Obsidian origin.",
        };
      }
      return {
        ok: false,
        message: "B2: Network error during bucket listing — check your connection.",
      };
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async authorizeAccount(
    keyId: string,
    applicationKey: string,
  ): Promise<B2AuthResponse> {
    const encoded = btoa(`${keyId}:${applicationKey}`);

    let response: Response;
    try {
      response = await fetch(AUTH_URL, {
        method: "GET",
        headers: { Authorization: `Basic ${encoded}` },
      });
    } catch (error) {
      if (isCorsError(error)) {
        throw {
          code: "CORS",
          providerId: "b2",
          message:
            "B2: CORS not configured. In your Backblaze B2 bucket settings, " +
            "add a CORS rule allowing your Obsidian origin.",
        };
      }
      throw { code: "NETWORK_ERROR", providerId: "b2", message: "B2: Network error." };
    }

    if (!response.ok) {
      let bodyMsg = "";
      try {
        bodyMsg = await response.text();
      } catch {
        // ignore
      }
      throw {
        code: "HTTP_ERROR",
        providerId: "b2",
        message: `B2: Authorization failed (${response.status})${bodyMsg ? ` — ${bodyMsg}` : ""}.`,
        status: response.status,
      };
    }

    const body = await response.json();
    return {
      authorizationToken: body.authorizationToken,
      apiUrl: body.apiUrl,
      downloadUrl: body.downloadUrl,
          accountId: body.accountId,
    };
  }

  private async getUploadUrl(
    apiUrl: string,
    authToken: string,
    bucketId: string,
  ): Promise<B2UploadUrlResponse> {
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bucketId }),
      });
    } catch (error) {
      if (isCorsError(error)) {
        throw {
          code: "CORS",
          providerId: "b2",
          message:
            "B2: CORS not configured. In your Backblaze B2 bucket settings, " +
            "add a CORS rule allowing your Obsidian origin.",
        };
      }
      throw { code: "NETWORK_ERROR", providerId: "b2", message: "B2: Network error." };
    }

    if (!response.ok) {
      let bodyMsg = "";
      try {
        bodyMsg = await response.text();
      } catch {
        // ignore
      }
      throw {
        code: "HTTP_ERROR",
        providerId: "b2",
        message: `B2: Failed to get upload URL (${response.status})${bodyMsg ? ` — ${bodyMsg}` : ""}.`,
        status: response.status,
      };
    }

    const body = await response.json();
    return {
      uploadUrl: body.uploadUrl,
      authorizationToken: body.authorizationToken,
    };
  }
}
