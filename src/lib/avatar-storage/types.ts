export type StorageDriver = "local" | "s3" | "r2" | "blob" | "cloudinary";

export interface AvatarUploadResult {
  url: string;
  key: string;
  provider: StorageDriver;
}

export interface AvatarStorageAdapter {
  upload(file: Buffer, filename: string, mimeType: string): Promise<AvatarUploadResult>;
  delete(key: string): Promise<void>;
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024;

export function validateAvatarFile(file: { size: number; type: string }): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Type de fichier non autorisé. Utilisez JPEG, PNG ou WebP.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("La taille du fichier ne peut pas dépasser 5 Mo.");
  }
}