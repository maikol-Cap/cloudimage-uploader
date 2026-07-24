// ---------------------------------------------------------------------------
// R2Provider — Cloudflare R2 via AWS Signature V4
// ---------------------------------------------------------------------------

import { isCorsError, type UploadResult, type ImageUploadProvider } from "./types";

// ---------------------------------------------------------------------------
// TypeScript-native HMAC-SHA256 using Web Crypto
// ---------------------------------------------------------------------------

async function hmacSha256(
  key: ArrayBuffer,
  data: string,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const encoded = new TextEncoder().encode(data);
  return crypto.subtle.sign("HMAC", cryptoKey, encoded);
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function amzTimestamp(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

// ---------------------------------------------------------------------------
// AWS Signature V4 for R2 PUT
// ---------------------------------------------------------------------------

async function signRequest(
  accessKeyId: string,
  secretAccessKey: string,
  bucket: string,
  objectKey: string,
  host: string,
  bodyBuffer: ArrayBuffer,
  date: Date,
): Promise<{ authorization: string; amzDate: string; contentHash: string }> {
  const region = "auto";
  const service = "s3";
  const amzDate = amzTimestamp(date);
  const dateStamp = amzDate.slice(0, 8);
  const contentHash = await sha256Hex(bodyBuffer);

  // Canonical URI
  const encodedKey = encodeURIComponent(objectKey)
    .replace(/%2F/g, "/")
    .replace(/\*/g, "%2A");
  const canonicalUri = `/${bucket}/${encodedKey}`;

  // Canonical headers (sorted alphabetically)
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${amzDate}\n`;

  // Signed headers
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  // Payload hash
  const payloadHash = contentHash;

  // Canonical request
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  // String to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(new TextEncoder().encode(canonicalRequest).buffer),
  ].join("\n");

  // Derive signing key (kDate → kRegion → kService → kSigning)
  const kSecret = new TextEncoder().encode("AWS4" + secretAccessKey).buffer;
  const kDate = await hmacSha256(kSecret, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");

  // Sign the string-to-sign
  const signature = await hmacSha256(kSigning, stringToSign);
  const signatureHex = buf2hex(signature);

  const authorization =
    `AWS4-HMAC-SHA256 ` +
    `Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signatureHex}`;

  return { authorization, amzDate, contentHash };
}

// ---------------------------------------------------------------------------
// R2Provider
// ---------------------------------------------------------------------------

export class R2Provider implements ImageUploadProvider {
  providerId = "r2" as const;
  displayName = "Cloudflare R2";

  async upload(
    file: File,
    credentials: Record<string, string>,
    name?: string,
  ): Promise<UploadResult> {
    const accountId = credentials.r2AccountId;
    const accessKeyId = credentials.r2AccessKeyId;
    const secretAccessKey = credentials.r2SecretAccessKey;
    const bucket = credentials.r2Bucket;
    const customDomain = credentials.r2CustomDomain;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw {
        code: "UNKNOWN",
        providerId: "r2",
        message:
          "R2: Missing required credentials (r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2Bucket).",
      };
    }

    // Build unique filename with correct extension from the actual file
    const effectiveName = name || file.name;
    const dotIdx = effectiveName.lastIndexOf(".");
    const baseName =
      dotIdx > 0 ? effectiveName.slice(0, dotIdx) : effectiveName;
    const fileExtIdx = file.name.lastIndexOf(".");
    const fileExt =
      fileExtIdx > 0 ? file.name.slice(fileExtIdx) : "";
    const ext = dotIdx > 0 ? effectiveName.slice(dotIdx) : fileExt;
    const uniqueName = `${baseName}-${crypto.randomUUID()}${ext}`;

    const host = `${accountId}.r2.cloudflarestorage.com`;
    const date = new Date();
    const bodyBuffer = await file.arrayBuffer();

    const { authorization, amzDate, contentHash } = await signRequest(
      accessKeyId,
      secretAccessKey,
      bucket,
      uniqueName,
      host,
      bodyBuffer,
      date,
    );

    const endpoint = `https://${host}/${bucket}/${encodeURIComponent(uniqueName)}`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Authorization: authorization,
          "x-amz-date": amzDate,
          "x-amz-content-sha256": contentHash,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: bodyBuffer,
      });
    } catch (error) {
      if (isCorsError(error)) {
        throw {
          code: "CORS",
          providerId: "r2",
          message:
            "R2: CORS not configured. In your Cloudflare R2 dashboard, " +
            "add a CORS policy allowing your Obsidian origin and the PUT method. " +
            "See the plugin documentation for step-by-step instructions.",
        };
      }
      throw {
        code: "NETWORK_ERROR",
        providerId: "r2",
        message: "R2: Network error — check your connection.",
      };
    }

    if (!response.ok) {
      let bodyMsg = "";
      try {
        bodyMsg = await response.text();
      } catch {
        // ignore body read errors
      }
      throw {
        code: "HTTP_ERROR",
        providerId: "r2",
        message: bodyMsg || `Upload failed (${response.status})`,
        status: response.status,
      };
    }

    // Construct public URL
    // R2 public URLs require a custom domain or r2.dev subdomain.
    // pub-<accountId>.r2.dev is NOT valid — use the customDomain field.
    const result: UploadResult = {} as UploadResult;

    if (customDomain) {
      const domain = customDomain.endsWith("/")
        ? customDomain.slice(0, -1)
        : customDomain;
      result.url = `${domain}/${uniqueName}`;
      result.displayUrl = result.url;
    } else {
      throw {
        code: "UNKNOWN",
        providerId: "r2",
        message:
          "R2: Image uploaded but no public URL configured. " +
          "Add your r2.dev subdomain in the Custom Domain field " +
          "(Cloudflare Dashboard → R2 → bucket → R2.dev subdomain).",
      };
    }

    return result;
  }

  async testConnection(
    credentials: Record<string, string>,
  ): Promise<{ ok: boolean; message?: string }> {
    const accountId = credentials.r2AccountId;
    const accessKeyId = credentials.r2AccessKeyId;
    const secretAccessKey = credentials.r2SecretAccessKey;
    const bucket = credentials.r2Bucket;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      return {
        ok: false,
        message:
          "R2: Missing required credentials (r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2Bucket).",
      };
    }

    const testKey = `.cloudimage-test-${crypto.randomUUID()}`;
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const date = new Date();
    const testBody = new Uint8Array([0]).buffer;

    try {
      const { authorization, amzDate, contentHash } = await signRequest(
        accessKeyId,
        secretAccessKey,
        bucket,
        testKey,
        host,
        testBody,
        date,
      );

      const putEndpoint = `https://${host}/${bucket}/${encodeURIComponent(testKey)}`;

      let putResponse: Response;
      try {
        putResponse = await fetch(putEndpoint, {
          method: "PUT",
          headers: {
            Authorization: authorization,
            "x-amz-date": amzDate,
            "x-amz-content-sha256": contentHash,
            "Content-Type": "application/octet-stream",
          },
          body: testBody,
        });
      } catch (error) {
        if (isCorsError(error)) {
          return {
            ok: false,
            message:
              "R2: CORS not configured. In your Cloudflare R2 dashboard, " +
              "add a CORS policy allowing your Obsidian origin and the PUT method.",
          };
        }
        return {
          ok: false,
          message: "R2: Network error — check your connection.",
        };
      }

      if (!putResponse.ok) {
        let bodyMsg = "";
        try { bodyMsg = await putResponse.text(); } catch { /* ignore */ }
        return {
          ok: false,
          message: `R2: Upload test failed (${putResponse.status})${
            bodyMsg ? ` — ${bodyMsg}` : ""
          }. Check your credentials.`,
        };
      }

      return { ok: true };
    } catch (error) {
      const err = error as { message?: string };
      return {
        ok: false,
        message: err.message || "R2: Connection test failed.",
      };
    }
  }
}
