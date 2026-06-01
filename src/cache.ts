import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CacheData, CacheEntry } from './types';

export class CacheManager {
  private cachePath: string;
  private cacheData: CacheData = {};

  constructor(rootDir: string, cacheFileName = '.asset-minify-cache.json') {
    this.cachePath = join(rootDir, cacheFileName);
  }

  /**
   * Loads cache data from disk. If the cache file is corrupted or doesn't exist,
   * it falls back to an empty cache gracefully.
   */
  public load(): void {
    if (!existsSync(this.cachePath)) {
      this.cacheData = {};
      return;
    }

    try {
      const fileContent = readFileSync(this.cachePath, 'utf8');
      this.cacheData = JSON.parse(fileContent);
    } catch (error) {
      console.warn(
        `\n⚠️ Cache file corrupted or unreadable. Starting with a fresh cache. Error: ${
          error instanceof Error ? error.message : 'Unknown'
        }`
      );
      this.cacheData = {};
    }
  }

  /**
   * Checks if an asset is already optimized and valid.
   * A cache hit is valid ONLY if the file hash matches and the quality setting remains the same.
   */
  public getValidEntry(relativePath: string, currentHash: string, currentQuality: number): CacheEntry | null {
    const entry = this.cacheData[relativePath];
    if (entry && entry.hash === currentHash && entry.quality === currentQuality) {
      return entry;
    }
    return null;
  }

  /**
   * Sets a cache entry for a relative file path.
   */
  public set(relativePath: string, hash: string, size: number, quality: number): void {
    this.cacheData[relativePath] = {
      hash,
      optimizedAt: new Date().toISOString(),
      size,
      quality,
    };
  }

  /**
   * Removes an entry from the cache.
   */
  public remove(relativePath: string): void {
    delete this.cacheData[relativePath];
  }

  /**
   * Saves the current cache status to disk.
   */
  public save(): void {
    try {
      const dataString = JSON.stringify(this.cacheData, null, 2);
      writeFileSync(this.cachePath, dataString, 'utf8');
    } catch (error) {
      console.error(
        `\n❌ Failed to save optimization cache: ${
          error instanceof Error ? error.message : 'Unknown'
        }`
      );
    }
  }

  /**
   * Clears the cache directory on disk and resets local cache memory.
   */
  public clear(): void {
    this.cacheData = {};
    this.save();
  }
}
