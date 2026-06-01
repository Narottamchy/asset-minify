import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { CacheManager } from '../src/cache';

describe('CacheManager', () => {
  const testDir = __dirname;
  const testCacheFile = '.test-cache.json';
  const testCachePath = join(testDir, testCacheFile);

  beforeEach(() => {
    if (existsSync(testCachePath)) {
      unlinkSync(testCachePath);
    }
  });

  afterEach(() => {
    if (existsSync(testCachePath)) {
      unlinkSync(testCachePath);
    }
  });

  it('should initialize with empty cache when file does not exist', () => {
    const manager = new CacheManager(testDir, testCacheFile);
    manager.load();
    
    const entry = manager.getValidEntry('logo.png', 'somehash', 85);
    expect(entry).toBeNull();
  });

  it('should set, save and retrieve cache entries', () => {
    const manager = new CacheManager(testDir, testCacheFile);
    manager.load();
    
    manager.set('logo.png', 'hash123', 5000, 85);
    manager.save();

    expect(existsSync(testCachePath)).toBe(true);

    const secondManager = new CacheManager(testDir, testCacheFile);
    secondManager.load();

    const validEntry = secondManager.getValidEntry('logo.png', 'hash123', 85);
    expect(validEntry).not.toBeNull();
    expect(validEntry?.size).toBe(5000);
    expect(validEntry?.hash).toBe('hash123');
    expect(validEntry?.quality).toBe(85);
  });

  it('should return null for getValidEntry if hash does not match', () => {
    const manager = new CacheManager(testDir, testCacheFile);
    manager.load();
    manager.set('logo.png', 'hash123', 5000, 85);

    const invalidHash = manager.getValidEntry('logo.png', 'hash456', 85);
    expect(invalidHash).toBeNull();
  });

  it('should return null for getValidEntry if quality settings change', () => {
    const manager = new CacheManager(testDir, testCacheFile);
    manager.load();
    manager.set('logo.png', 'hash123', 5000, 85);

    const invalidQuality = manager.getValidEntry('logo.png', 'hash123', 50);
    expect(invalidQuality).toBeNull();
  });

  it('should recover gracefully from corrupted cache files', () => {
    // Write corrupted JSON
    writeFileSync(testCachePath, '{ invalid: json }', 'utf8');

    const manager = new CacheManager(testDir, testCacheFile);
    
    // Suppress console.warn for tests
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    expect(() => manager.load()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();

    const entry = manager.getValidEntry('logo.png', 'hash123', 85);
    expect(entry).toBeNull();

    warnSpy.mockRestore();
  });
});
