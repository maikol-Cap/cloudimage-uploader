export interface UploadedImage {
  url: string;
  displayUrl: string;
  deleteUrl: string;
  filename: string;
  uploadedAt: number;
}

export interface CloudImagePluginSettings {
  apiKey: string;
  uploadedImages: UploadedImage[];
}

export const DEFAULT_SETTINGS: CloudImagePluginSettings = {
  apiKey: "",
  uploadedImages: [],
};

export interface ImgBBUploadResult {
  url: string;
  displayUrl: string;
  deleteUrl: string;
}

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
