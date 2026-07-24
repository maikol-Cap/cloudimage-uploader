export interface UploadResult {
  url: string;
  displayUrl?: string;
  deleteUrl?: string;
}

export interface ImageUploadProvider {
  providerId: string;
  displayName: string;
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
  status?: number;
}

export function isCorsError(error: unknown): boolean {
  if (error instanceof Response && error.status === 0) return true;
  if (error instanceof Response && error.type === "opaque") return true;
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    return msg.includes("failed to fetch") || msg.includes("networkerror");
  }
  return false;
}

const CORS_MESSAGES: Record<string, string> = {
  r2: "R2: CORS not configured. In your Cloudflare R2 dashboard, add a CORS policy allowing your Obsidian origin and the PUT method. See the plugin documentation for step-by-step instructions.",
  b2: "B2: CORS not configured. In your Backblaze B2 bucket settings, add a CORS rule allowing your Obsidian origin and enable b2_download_authorize.",
  imgbb:
    "ImgBB: Request blocked by CORS policy. This is unusual — check your network configuration.",
};

export function formatUploadError(error: UploadError): string {
  if (error.code === "CORS") {
    return (
      CORS_MESSAGES[error.providerId] ??
      `${error.providerId}: CORS not configured.`
    );
  }
  if (error.code === "HTTP_ERROR") {
    const status = error.status ? ` (${error.status})` : "";
    return `${error.providerId}: ${error.message}${status}`;
  }
  return `${error.providerId}: ${error.message}`;
}
