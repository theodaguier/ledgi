import type { AvatarStorageAdapter, StorageDriver } from "./types";
import { LocalAvatarStorage } from "./local";

let _adapter: AvatarStorageAdapter | null = null;

function getAdapter(): AvatarStorageAdapter {
  if (_adapter) return _adapter;

  const driver = (process.env.AVATAR_STORAGE_DRIVER ?? "local") as StorageDriver;

  switch (driver) {
    case "local":
      _adapter = new LocalAvatarStorage();
      break;
    default:
      _adapter = new LocalAvatarStorage();
  }

  return _adapter;
}

export async function uploadAvatar(
  file: Buffer,
  filename: string,
  mimeType: string
) {
  return getAdapter().upload(file, filename, mimeType);
}

export async function deleteAvatar(key: string) {
  return getAdapter().delete(key);
}

export { LocalAvatarStorage } from "./local";
export type { AvatarStorageAdapter, AvatarUploadResult, StorageDriver } from "./types";
export { validateAvatarFile } from "./types";