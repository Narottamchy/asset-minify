import { statSync, existsSync, renameSync, unlinkSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'fs';
import { dirname, extname, join, relative } from 'path';
import { exec } from 'child_process';
import sharp from 'sharp';
import { optimize as optimizeSvgContent } from 'svgo';
import { OptimizeOptions, OptimizeResult } from './types';

/**
 * Optimizes a single file in-place or dry-run, routing to the correct processor based on extension.
 */
export async function optimizeFile(
  filePath: string,
  rootDir: string,
  options: OptimizeOptions
): Promise<OptimizeResult> {
  const ext = extname(filePath).toLowerCase();
  const relativePath = relative(rootDir, filePath);
  
  const stats = statSync(filePath);
  const originalSize = stats.size;

  const result: OptimizeResult = {
    filePath,
    relativePath,
    extension: ext,
    originalSize,
    optimizedSize: originalSize,
    savedBytes: 0,
    success: false,
    skipped: false,
  };

  // Generate a temp file path in the same directory (prevents cross-device link errors during rename)
  const tempPath = `${filePath}.tmp${ext}`;

  try {
    // 1. Process file writing to the temp path
    if (['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.heif', '.heic', '.tiff', '.tif'].includes(ext)) {
      await optimizeImageFile(filePath, tempPath, ext, options.quality);
    } else if (ext === '.svg') {
      await optimizeSvgFile(filePath, tempPath);
    } else if (['.mp4', '.webm', '.mov', '.m4v'].includes(ext)) {
      if (!options.video) {
        result.skipped = true;
        result.error = 'Video optimization disabled';
        return result;
      }
      await optimizeVideoFile(filePath, tempPath, options.quality);
    } else {
      result.skipped = true;
      result.error = 'Unsupported file type';
      return result;
    }

    // Verify temp file exists and has size
    if (!existsSync(tempPath)) {
      throw new Error('Optimizer finished but no output file was created.');
    }

    const tempStats = statSync(tempPath);
    const optimizedSize = tempStats.size;

    // 2. Evaluate savings
    if (optimizedSize < originalSize) {
      result.optimizedSize = optimizedSize;
      result.savedBytes = originalSize - optimizedSize;
      result.success = true;

      if (options.dryRun) {
        // If dry run, just delete the temp file
        unlinkSync(tempPath);
      } else {
        // Handle backup if requested
        if (options.backup) {
          const backupDir = join(rootDir, '.asset-backup');
          const backupFilePath = join(backupDir, relativePath);
          const backupFileDir = dirname(backupFilePath);
          
          if (!existsSync(backupFileDir)) {
            mkdirSync(backupFileDir, { recursive: true });
          }
          copyFileSync(filePath, backupFilePath);
        }

        // Replace original with optimized file atomically
        renameSync(tempPath, filePath);
      }
    } else {
      // Optimized file is larger or equal in size; skip and discard the temp file
      unlinkSync(tempPath);
      result.success = true;
      result.skipped = true;
      result.error = 'Compressed version is larger or equal to original';
    }
  } catch (error) {
    // Cleanup on failure
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath);
      } catch {}
    }
    result.success = false;
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Compress images using Sharp.
 */
async function optimizeImageFile(
  inputPath: string,
  outputPath: string,
  ext: string,
  quality: number
): Promise<void> {
  const pipeline = sharp(inputPath, { failOn: 'truncated' });

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      await pipeline
        .jpeg({
          quality,
          progressive: true,
          mozjpeg: true, // Employs advanced JPEG coding models for high savings
        })
        .toFile(outputPath);
      break;

    case '.png':
      // PNGs are optimized losslessly to preserve fine details, text, and logos,
      // preventing generational quality loss across multiple runs.
      await pipeline
        .png({
          compressionLevel: 9,
          palette: false,
          effort: 8,
        })
        .toFile(outputPath);
      break;

    case '.webp':
      await pipeline
        .webp({
          quality,
          effort: 6, // 1-6 range, 6 is maximum CPU compression effort
        })
        .toFile(outputPath);
      break;

    case '.avif':
      await pipeline
        .avif({
          quality: Math.max(1, quality - 5), // AVIF quality 80 is equivalent to WebP 85
          effort: 4, // 0-9 range, 4 is a good tradeoff between speed and size
        })
        .toFile(outputPath);
      break;

    case '.gif':
      await pipeline
        .gif({
          effort: 7, // 1-10 range
        })
        .toFile(outputPath);
      break;

    case '.heif':
    case '.heic':
      await pipeline
        .heif({
          quality,
          effort: 4,
        })
        .toFile(outputPath);
      break;

    case '.tiff':
    case '.tif':
      await pipeline
        .tiff({
          quality,
          compression: 'lzw',
        })
        .toFile(outputPath);
      break;

    default:
      throw new Error(`Unsupported image format: ${ext}`);
  }
}

/**
 * Compress SVGs using SVGO.
 */
async function optimizeSvgFile(inputPath: string, outputPath: string): Promise<void> {
  const svgString = readFileSync(inputPath, 'utf8');
  
  const result = optimizeSvgContent(svgString, {
    path: inputPath,
    multipass: true, // run SVGO multiple times to get the smallest output
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            removeViewBox: false, // Don't break aspect ratio scales in modern CSS
            cleanupIds: false,   // Keep IDs since frontend frameworks might reference them
          },
        },
      },
    ],
  });

  if ('data' in result) {
    writeFileSync(outputPath, result.data, 'utf8');
  } else {
    throw new Error(`SVGO failed to compress file: ${String(result)}`);
  }
}

/**
 * Compress videos using system FFmpeg.
 */
function optimizeVideoFile(inputPath: string, outputPath: string, quality: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Map CLI quality (1-100) to FFmpeg H.264 CRF (Constant Rate Factor: 18 is visual lossless, 35 is highly compressed)
    // Quality 100 -> CRF 18
    // Quality 85  -> CRF 21 (near lossless, excellent default)
    // Quality 50  -> CRF 27
    // Quality 1   -> CRF 35
    const minCrf = 18;
    const maxCrf = 35;
    const crf = Math.round(maxCrf - (quality / 100) * (maxCrf - minCrf));

    // Command options explained:
    // -vcodec libx264: H.264 video codec
    // -crf: constant rate factor quality parameter
    // -preset medium: balanced compression CPU utilization
    // -pix_fmt yuv420p: 8-bit YUV 4:2:0 chroma subsampling for browser compatibility
    // -acodec aac -b:a 128k: audio compression to AAC
    // -map_metadata -1: strip all EXIF metadata/tags
    const cmd = `ffmpeg -i "${inputPath}" -vcodec libx264 -crf ${crf} -preset medium -pix_fmt yuv420p -acodec aac -b:a 128k -map_metadata -1 -y "${outputPath}"`;

    exec(cmd, (error) => {
      if (error) {
        reject(new Error(`FFmpeg error: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}
