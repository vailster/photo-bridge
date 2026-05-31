export interface GoogleMediaItem {
  id: string;
  filename: string;
  baseUrl: string;
  mimeType: string;
  mediaFile?: {
    baseUrl: string;
    filename: string;
  };
}

export interface UploadResult {
  uploaded: number;
  total: number;
  failed: string[];
}
