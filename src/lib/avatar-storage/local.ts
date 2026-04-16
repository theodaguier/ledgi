import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { AvatarStorageAdapter, AvatarUploadResult } from "./types";

const OUT_DIR = "public/uploads/avatars";
const SIZE = 512;

export class LocalAvatarStorage implements AvatarStorageAdapter {
  private baseDir: string;

  constructor(baseDir = OUT_DIR) {
    this.baseDir = baseDir;
  }

  async upload(file: Buffer, _filename: string, _mimeType: string): Promise<AvatarUploadResult> {
    await fs.mkdir(this.baseDir, { recursive: true });

    const id = crypto.randomUUID();
    const outName = `${id}.webp`;
    const outPath = path.join(this.baseDir, outName);

    const buf = await sharp(file)
      .resize(SIZE, SIZE, {
        fit: "cover",
        position: "center",
      })
      .webp({ quality: 85 })
      .toBuffer();

    await fs.writeFile(outPath, buf);

    const url = `/uploads/avatars/${outName}`;
    return { url, key: outName, provider: "local" };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    await fs.unlink(filePath).catch(() => {});
  }
}