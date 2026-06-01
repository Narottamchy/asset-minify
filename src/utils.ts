import { createHash } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { execSync } from 'child_process';
import fg from 'fast-glob';

/**
 * Generates a SHA-256 hash of a file using streams to keep memory footprint low (especially for large videos).
 */
export function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Formats a byte number into a clean, human-readable string (e.g., 1.25 MB).
 * Handles negative differences and zero gracefully.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const isNegative = bytes < 0;
  const absBytes = Math.abs(bytes);
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(absBytes) / Math.log(k));
  // Safeguard index out of bounds
  const idx = Math.min(i, sizes.length - 1);
  const formatted = parseFloat((absBytes / Math.pow(k, idx)).toFixed(2));
  return `${isNegative ? '-' : ''}${formatted} ${sizes[idx]}`;
}

/**
 * Checks if a command is available on the system PATH.
 */
export function isCommandAvailable(command: string): boolean {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively scans a directory for files matching target extensions, ignoring common build folders.
 */
export async function findFiles(
  dir: string,
  extensions: string[],
  excludePatterns: string[] = []
): Promise<string[]> {
  // fast-glob expects forward slashes, even on Windows
  const normalizedDir = dir.replace(/\\/g, '/');
  
  // Format extensions to a glob search group: e.g. {png,jpg,jpeg,webp}
  const cleanExts = extensions.map((ext) => ext.replace(/^\./, '').toLowerCase());
  const extGlob = cleanExts.length === 1 ? cleanExts[0] : `{${cleanExts.join(',')}}`;
  const pattern = `${normalizedDir}/**/*.${extGlob}`;

  const defaultIgnore = [
    '**/node_modules/**',
    '**/.next/**',
    '**/.git/**',
    '**/.vercel/**',
    '**/dist/**',
    '**/build/**',
    '**/.asset-backup/**',
    '**/.asset-minify-cache.json'
  ];

  const customIgnore = excludePatterns.map((p) => p.replace(/\\/g, '/'));
  const ignore = [...defaultIgnore, ...customIgnore];

  return fg(pattern, {
    ignore,
    absolute: true,
    onlyFiles: true,
    caseSensitiveMatch: false,
  });
}
