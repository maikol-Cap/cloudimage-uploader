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
