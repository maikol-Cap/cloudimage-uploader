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

export type SizePreset = 'none' | 'small' | 'medium' | 'full' | 'custom';
export const SIZE_PRESET_VALUES: Record<SizePreset, number | null> = {
  none: null,
  small: 400,
  medium: 600,
  full: 800,
  custom: null,
};
