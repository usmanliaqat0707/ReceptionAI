import fs from "fs/promises";
import path from "path";

export interface ObjectStorage {
  put(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  createSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export class LocalObjectStorage implements ObjectStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), "storage");
  }

  private resolveSafePath(key: string): string {
    // Sanitize key to prevent path traversal
    const cleanKey = key.replace(/(\.\.[\/\\])+/g, "").replace(/^[\/\\]+/, "");
    return path.join(this.baseDir, cleanKey);
  }

  async put(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  async get(key: string): Promise<Buffer> {
    const filePath = this.resolveSafePath(key);
    try {
      return await fs.readFile(filePath);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new Error(`KNOWLEDGE_SOURCE_NOT_FOUND: Object '${key}' not found in storage.`);
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  async createSignedDownloadUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    // In local development, return direct API download URL
    return `/api/v1/storage/${encodeURIComponent(key)}`;
  }
}

export const objectStorage = new LocalObjectStorage();
