import type { ImgBBUploadResult } from "./types";

const API_URL = "https://api.imgbb.com/1/upload";
const MAX_SIZE = 32 * 1024 * 1024; // 32 MB

export class ImgBBError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ImgBBError";
    this.code = code;
  }
}

export class ImgBBClient {
  static async upload(
    file: File,
    apiKey: string,
  ): Promise<ImgBBUploadResult> {
    if (file.size > MAX_SIZE) {
      throw new ImgBBError("File exceeds 32 MB limit", "SIZE_EXCEEDED");
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("key", apiKey);

    const name = file.name.replace(/\.[^.]+$/, "");
    if (name) formData.append("name", name);

    let response: Response;
    try {
      response = await fetch(API_URL, { method: "POST", body: formData });
    } catch {
      throw new ImgBBError(
        "Network error: unable to reach ImgBB",
        "NETWORK_ERROR",
      );
    }

    if (!response.ok) {
      if (response.status >= 500) {
        throw new ImgBBError(
          `ImgBB server error (${response.status})`,
          "SERVER_ERROR",
        );
      }
      const body = await response.json().catch(() => ({}));
      throw new ImgBBError(
        body.error?.message || `Upload failed (${response.status})`,
        "UPLOAD_FAILED",
      );
    }

    const json = await response.json();

    if (!json.success) {
      throw new ImgBBError(
        json.error?.message || "Upload failed",
        "UPLOAD_FAILED",
      );
    }

    return {
      url: json.data.url,
      displayUrl: json.data.display_url,
      deleteUrl: json.data.delete_url,
    };
  }

  static async testConnection(apiKey: string): Promise<boolean> {
    const dot =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const blob = await fetch(`data:image/png;base64,${dot}`).then((r) =>
      r.blob(),
    );
    const file = new File([blob], "test.png", { type: "image/png" });

    try {
      await ImgBBClient.upload(file, apiKey);
      return true;
    } catch {
      return false;
    }
  }
}
