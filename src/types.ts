export interface OptimizeOptions {
  /** Target directory to scan (absolute or relative) */
  dir: string;
  /** Image compression quality (1-100, default: 85) */
  quality: number;
  /** Whether video optimization is enabled */
  video: boolean;
  /** Whether cache is enabled for incremental runs (default: true) */
  cache: boolean;
  /** If true, calculates savings without writing changes (default: false) */
  dryRun: boolean;
  /** If true, backs up original files to a folder before optimizing (default: false) */
  backup: boolean;
  /** If true, auto-confirms all prompts (e.g. video optimization warning, default: false) */
  yes: boolean;
  /** Whether verbose logging is enabled */
  verbose?: boolean;
  /** Paths to exclude (glob patterns or exact names) */
  exclude?: string[];
  /** File extensions to process (e.g. ['.jpg', '.png']) */
  extensions?: string[];
}

export interface OptimizeResult {
  /** Absolute path of the file */
  filePath: string;
  /** Relative path of the file to the project root */
  relativePath: string;
  /** File extension (lowercase, e.g. '.png') */
  extension: string;
  /** Original file size in bytes */
  originalSize: number;
  /** Optimized file size in bytes */
  optimizedSize: number;
  /** Difference in bytes (originalSize - optimizedSize) */
  savedBytes: number;
  /** Whether the operation was successful */
  success: boolean;
  /** Whether the file was skipped (e.g. already compressed, or compressed version is larger) */
  skipped: boolean;
  /** Reason for skip or failure (if any) */
  error?: string;
}

export interface CacheEntry {
  /** SHA-256 hash of the original unoptimized file */
  hash: string;
  /** ISO timestamp when optimized */
  optimizedAt: string;
  /** Optimized file size in bytes */
  size: number;
  /** Quality level used for optimization */
  quality: number;
}

export interface CacheData {
  [relativePath: string]: CacheEntry;
}

export interface FileStats {
  originalSize: number;
  optimizedSize: number;
  savedBytes: number;
  count: number;
}

export interface SummaryStats {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  originalTotalSize: number;
  optimizedTotalSize: number;
  savedTotalBytes: number;
  byExtension: { [ext: string]: FileStats };
  durationMs: number;
}
