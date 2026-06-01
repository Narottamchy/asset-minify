import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, existsSync } from 'fs';
import { join } from 'path';
import { formatBytes, getFileHash, isCommandAvailable, findFiles } from '../src/utils';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('Utility Functions', () => {
  const testFileDir = join(__dirname, 'temp_utils_test');
  const testFilePath = join(testFileDir, 'test_hash.txt');

  beforeAll(() => {
    if (!existsSync(testFileDir)) {
      mkdirSync(testFileDir, { recursive: true });
    }
    writeFileSync(testFilePath, 'Hello World! asset-minify test data', 'utf8');
  });

  afterAll(() => {
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
    if (existsSync(testFileDir)) {
      rmdirSync(testFileDir);
    }
  });

  describe('getFileHash', () => {
    it('should generate a valid SHA-256 hash for a file', async () => {
      const hash = await getFileHash(testFilePath);
      expect(hash).toHaveLength(64);
      expect(hash).toBe('62c410a64aae5d6e96be6d075a2985e38abe01a6cb10247c30ebfd3f40c2c809');
    });

    it('should reject if the file does not exist', async () => {
      const missingPath = join(testFileDir, 'missing.txt');
      await expect(getFileHash(missingPath)).rejects.toThrow('File not found');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should format negative bytes correctly', () => {
      expect(formatBytes(-1024)).toBe('-1 KB');
      expect(formatBytes(-1048576)).toBe('-1 MB');
    });
  });

  describe('isCommandAvailable', () => {
    it('should return true when execSync runs successfully', () => {
      (execSync as jest.Mock).mockReturnValue(Buffer.from('/usr/bin/ffmpeg'));
      expect(isCommandAvailable('ffmpeg')).toBe(true);
    });

    it('should return false when execSync throws', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('command not found');
      });
      expect(isCommandAvailable('ffmpeg')).toBe(false);
    });
  });

  describe('findFiles', () => {
    it('should find matching files with correct extensions', async () => {
      const subDir = join(testFileDir, 'sub');
      if (!existsSync(subDir)) {
        mkdirSync(subDir, { recursive: true });
      }
      const imagePath1 = join(testFileDir, 'img1.png');
      const imagePath2 = join(subDir, 'img2.jpg');
      const svgPath = join(testFileDir, 'vector.svg');
      const textPath = join(testFileDir, 'note.txt');

      writeFileSync(imagePath1, 'img1', 'utf8');
      writeFileSync(imagePath2, 'img2', 'utf8');
      writeFileSync(svgPath, 'svg', 'utf8');
      writeFileSync(textPath, 'text', 'utf8');

      const found = await findFiles(testFileDir, ['.png', '.jpg']);
      
      // Clean up
      unlinkSync(imagePath1);
      unlinkSync(imagePath2);
      unlinkSync(svgPath);
      unlinkSync(textPath);
      rmdirSync(subDir);

      expect(found).toHaveLength(2);
      expect(found.some(f => f.endsWith('img1.png'))).toBe(true);
      expect(found.some(f => f.endsWith('img2.jpg'))).toBe(true);
    });
  });
});
