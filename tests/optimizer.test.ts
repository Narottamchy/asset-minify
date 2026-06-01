import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { optimizeFile } from '../src/optimizer';
import { OptimizeOptions } from '../src/types';
import sharp from 'sharp';
import { optimize as optimizeSvgContent } from 'svgo';
import { exec } from 'child_process';

// Mock dependencies
jest.mock('sharp');
jest.mock('svgo');
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('Optimizer Engine', () => {
  const testDir = __dirname;
  const originalFile = join(testDir, 'test-image.jpg');
  const backupDir = join(testDir, '.asset-backup');

  // Mocks setup
  const mockSharpInstance = {
    keepMetadata: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    gif: jest.fn().mockReturnThis(),
    heif: jest.fn().mockReturnThis(),
    tiff: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockImplementation((outputPath) => {
      // Mock writing smaller file
      writeFileSync(outputPath, 'small-data-stub', 'utf8');
      return Promise.resolve();
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock original file (size: 44 bytes)
    writeFileSync(originalFile, 'original-unoptimized-file-data-large-stub', 'utf8');
    
    // Set up sharp constructor mock
    (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);

    // Set up svgo mock
    (optimizeSvgContent as jest.Mock).mockReturnValue({ data: '<svg>small</svg>' });

    // Set up child_process mock
    (exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
      // Extract output path from cmd: it's the last parameter like ... -y "/path/to/file.tmp.mp4"
      const match = cmd.match(/"([^"]+)"$/);
      if (match && match[1]) {
        writeFileSync(match[1], 'small-video-stub', 'utf8');
      }
      cb(null, '', '');
    });
  });

  afterEach(() => {
    if (existsSync(originalFile)) {
      unlinkSync(originalFile);
    }
    
    const tempFile = `${originalFile}.tmp.jpg`;
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  });

  it('should optimize JPEG images and overwrite original when size is reduced', async () => {
    const options: OptimizeOptions = {
      dir: testDir,
      quality: 85,
      video: false,
      cache: false,
      dryRun: false,
      backup: false,
      yes: true,
    };

    const result = await optimizeFile(originalFile, testDir, options);

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.savedBytes).toBeGreaterThan(0);
    expect(sharp).toHaveBeenCalledWith(originalFile, expect.any(Object));
    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith(expect.objectContaining({ quality: 85 }));
  });

  it('should optimize PNG images using sharp', async () => {
    const pngFile = join(testDir, 'test-image.png');
    writeFileSync(pngFile, 'png-unoptimized-stub-data', 'utf8');

    const options: OptimizeOptions = {
      dir: testDir,
      quality: 85,
      video: false,
      cache: false,
      dryRun: false,
      backup: false,
      yes: true,
    };

    try {
      const result = await optimizeFile(pngFile, testDir, options);
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(sharp).toHaveBeenCalledWith(pngFile, expect.any(Object));
      expect(mockSharpInstance.png).toHaveBeenCalledWith(expect.objectContaining({ quality: 85, palette: true }));
    } finally {
      if (existsSync(pngFile)) unlinkSync(pngFile);
      const tempPng = `${pngFile}.tmp.png`;
      if (existsSync(tempPng)) unlinkSync(tempPng);
    }
  });

  it('should optimize WebP images using sharp', async () => {
    const webpFile = join(testDir, 'test-image.webp');
    writeFileSync(webpFile, 'webp-unoptimized-stub-data', 'utf8');

    const options: OptimizeOptions = {
      dir: testDir,
      quality: 85,
      video: false,
      cache: false,
      dryRun: false,
      backup: false,
      yes: true,
    };

    try {
      const result = await optimizeFile(webpFile, testDir, options);
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(sharp).toHaveBeenCalledWith(webpFile, expect.any(Object));
      expect(mockSharpInstance.webp).toHaveBeenCalledWith(expect.objectContaining({ quality: 85, effort: 6 }));
    } finally {
      if (existsSync(webpFile)) unlinkSync(webpFile);
      const tempWebp = `${webpFile}.tmp.webp`;
      if (existsSync(tempWebp)) unlinkSync(tempWebp);
    }
  });

  it('should optimize AVIF images using sharp', async () => {
    const avifFile = join(testDir, 'test-image.avif');
    writeFileSync(avifFile, 'avif-unoptimized-stub-data', 'utf8');

    const options: OptimizeOptions = {
      dir: testDir,
      quality: 85,
      video: false,
      cache: false,
      dryRun: false,
      backup: false,
      yes: true,
    };

    try {
      const result = await optimizeFile(avifFile, testDir, options);
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(sharp).toHaveBeenCalledWith(avifFile, expect.any(Object));
      expect(mockSharpInstance.avif).toHaveBeenCalledWith(expect.objectContaining({ quality: 80, effort: 4 }));
    } finally {
      if (existsSync(avifFile)) unlinkSync(avifFile);
      const tempAvif = `${avifFile}.tmp.avif`;
      if (existsSync(tempAvif)) unlinkSync(tempAvif);
    }
  });

  it('should optimize GIF images using sharp', async () => {
    const gifFile = join(testDir, 'test-image.gif');
    writeFileSync(gifFile, 'gif-unoptimized-stub-data', 'utf8');

    const options: OptimizeOptions = {
      dir: testDir,
      quality: 85,
      video: false,
      cache: false,
      dryRun: false,
      backup: false,
      yes: true,
    };

    try {
      const result = await optimizeFile(gifFile, testDir, options);
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(sharp).toHaveBeenCalledWith(gifFile, expect.any(Object));
      expect(mockSharpInstance.gif).toHaveBeenCalledWith(expect.objectContaining({ effort: 7 }));
    } finally {
      if (existsSync(gifFile)) unlinkSync(gifFile);
      const tempGif = `${gifFile}.tmp.gif`;
      if (existsSync(tempGif)) unlinkSync(tempGif);
    }
  });

  it('should optimize HEIF/HEIC images using sharp', async () => {
    const heicFile = join(testDir, 'test-image.heic');
    writeFileSync(heicFile, 'heic-unoptimized-stub-data', 'utf8');

    const options: OptimizeOptions = {
      dir: testDir,
      quality: 85,
      video: false,
      cache: false,
      dryRun: false,
      backup: false,
      yes: true,
    };

    try {
      const result = await optimizeFile(heicFile, testDir, options);
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(sharp).toHaveBeenCalledWith(heicFile, expect.any(Object));
      expect(mockSharpInstance.heif).toHaveBeenCalledWith(expect.objectContaining({ quality: 85, effort: 4 }));
    } finally {
      if (existsSync(heicFile)) unlinkSync(heicFile);
      const tempHeic = `${heicFile}.tmp.heic`;
      if (existsSync(tempHeic)) unlinkSync(tempHeic);
    }
  });

  it('should optimize TIFF/TIF images using sharp', async () => {
    const tiffFile = join(testDir, 'test-image.tiff');
    writeFileSync(tiffFile, 'tiff-unoptimized-stub-data', 'utf8');

    const options: OptimizeOptions = {
      dir: testDir,
      quality: 85,
      video: false,
      cache: false,
      dryRun: false,
      backup: false,
      yes: true,
    };

    try {
      const result = await optimizeFile(tiffFile, testDir, options);
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(sharp).toHaveBeenCalledWith(tiffFile, expect.any(Object));
      expect(mockSharpInstance.tiff).toHaveBeenCalledWith(expect.objectContaining({ quality: 85, compression: 'lzw' }));
    } finally {
      if (existsSync(tiffFile)) unlinkSync(tiffFile);
      const tempTiff = `${tiffFile}.tmp.tiff`;
      if (existsSync(tempTiff)) unlinkSync(tempTiff);
    }
  });

  it('should skip optimization if compressed file is larger than original', async () => {
    // Configure mock to write a LARGER file
    mockSharpInstance.toFile.mockImplementationOnce((outputPath) => {
      writeFileSync(outputPath, 'stub-that-is-much-larger-than-the-original-data-file', 'utf8');
      return Promise.resolve();
    });

    const options: OptimizeOptions = {
      dir: testDir,
      quality: 85,
      video: false,
      cache: false,
      dryRun: false,
      backup: false,
      yes: true,
    };

    const result = await optimizeFile(originalFile, testDir, options);

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.savedBytes).toBe(0);
  });

  it('should optimize SVGs using svgo', async () => {
    const svgFile = join(testDir, 'test-image.svg');
    writeFileSync(svgFile, '<svg>unoptimized long metadata tags</svg>', 'utf8');

    const options: OptimizeOptions = {
      dir: testDir,
      quality: 85,
      video: false,
      cache: false,
      dryRun: false,
      backup: false,
      yes: true,
    };

    const result = await optimizeFile(svgFile, testDir, options);

    expect(result.success).toBe(true);
    expect(optimizeSvgContent).toHaveBeenCalled();

    if (existsSync(svgFile)) unlinkSync(svgFile);
    const tempSvg = `${svgFile}.tmp.svg`;
    if (existsSync(tempSvg)) unlinkSync(tempSvg);
  });

  it('should optimize video files if video option is enabled', async () => {
    const videoFile = join(testDir, 'test-video.mp4');
    writeFileSync(videoFile, 'large-unoptimized-video-bytes-stub-data', 'utf8');

    const options: OptimizeOptions = {
      dir: testDir,
      quality: 80,
      video: true,
      cache: false,
      dryRun: false,
      backup: false,
      yes: true,
    };

    const result = await optimizeFile(videoFile, testDir, options);

    expect(result.success).toBe(true);
    expect(exec).toHaveBeenCalled();
    // Verify FFmpeg crf math: quality 80 -> maxCrf 35 - 0.8 * (35-18) = 35 - 13.6 = 21
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('-crf 21'),
      expect.any(Function)
    );

    if (existsSync(videoFile)) unlinkSync(videoFile);
    const tempVideo = `${videoFile}.tmp.mp4`;
    if (existsSync(tempVideo)) unlinkSync(tempVideo);
  });

  it('should create backups if backup option is enabled', async () => {
    const options: OptimizeOptions = {
      dir: testDir,
      quality: 85,
      video: false,
      cache: false,
      dryRun: false,
      backup: true,
      yes: true,
    };

    const result = await optimizeFile(originalFile, testDir, options);

    expect(result.success).toBe(true);
    
    // Verify backup exists
    const relativeOrig = relative(testDir, originalFile);
    const backupFile = join(backupDir, relativeOrig);
    
    expect(existsSync(backupFile)).toBe(true);
    expect(readFileSync(backupFile, 'utf8')).toBe('original-unoptimized-file-data-large-stub');

    // Clean up backup file
    unlinkSync(backupFile);
    try {
      unlinkSync(join(backupDir, 'test-image.jpg.tmp.jpg'));
    } catch {}
  });
});

// Helper mock import for relative paths in assertions
function relative(from: string, to: string) {
  const { relative } = require('path');
  return relative(from, to);
}
