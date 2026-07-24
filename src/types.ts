export interface Account {
  id: string;
  name: string;
  provider: "imgbb" | "r2" | "b2";

  // ImgBB
  imgbbApiKey?: string;

  // R2
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2Bucket?: string;
  r2CustomDomain?: string;

  // B2
  b2ApplicationKeyId?: string;
  b2ApplicationKey?: string;
  b2BucketId?: string;
  b2BucketName?: string;

  // Image compression
  compressionEnabled?: boolean;
  compressionMaxWidth?: number;
  compressionFormat?: "webp" | "original";
  compressionQuality?: number;
  compressionSkipThresholdKB?: number;
}

export interface UploadedImage {
  url: string;
  displayUrl: string;
  deleteUrl?: string;
  filename: string;
  uploadedAt: number;
}

export interface CloudImagePluginSettings {
  accounts: Account[];
  lastUsedAccountId: string | null;
  uploadedImages: UploadedImage[];
}

export const DEFAULT_SETTINGS: CloudImagePluginSettings = {
  accounts: [],
  lastUsedAccountId: null,
  uploadedImages: [],
};

export const SIZE_PRESETS: Record<string, number | null> = {
  none: null,
  small: 400,
  medium: 600,
  full: 800,
  custom: null,
};

export const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32 MB
export const MAX_HISTORY = 50;
export const MAX_HISTORY_DISPLAY = 20;
