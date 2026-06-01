# asset-minify

[![npm version](https://img.shields.io/npm/v/asset-minify.svg?style=flat-square)](https://www.npmjs.com/package/asset-minify)
[![license](https://img.shields.io/npm/l/asset-minify.svg?style=flat-square)](https://github.com/narottamchy/asset-minify/blob/main/LICENSE)

A high-performance, open-source CLI and programmatic asset optimizer designed for modern frontend applications (Next.js, React, Vue, Svelte, etc.).

`asset-minify` compresses images, SVGs, and videos in-place using smart, visually lossless defaults, saving **50% to 90%** of file size. It features a smart, incremental cache system to only process new or modified assets, making subsequent runs near-instantaneous.

---

## Features

- **Incremental Caching**: Tracks post-optimization file hashes to prevent redundant processing.
- **Advanced Lossless & Lossy Image Compression**:
  - **JPEGs**: Progressive MozJPEG compression (visually lossless).
  - **PNGs**: 100% Lossless compression by default to preserve text, icons, and logo clarity across multiple runs.
  - **WebP & AVIF**: High-efficiency modern web formats with visual tuning.
  - **GIFs**: Animated GIF frame-by-frame re-compression.
  - **HEIF/HEIC & TIFF**: Built-in support for modern camera and raw formats.
- **SVG Optimization**: Strips metadata and editor garbage via SVGO while preserving IDs and viewBox properties.
- **Video Transcoding**: Transcodes large videos (`.mp4`, `.webm`, `.mov`) into web-friendly H.264/AAC formats.
- **Atomic Writes**: Writes to a temporary file before atomically replacing the original, preventing corrupt files on crashes.
- **Progress Reporting**: Custom terminal spinner and progress bar with automatic fallback for non-TTY/CI environments.
- **Dual module support**: Full TypeScript definitions (`.d.ts`) supporting both CommonJS and ES Modules.

---

## Installation

You can run the CLI on the fly without installing:

```bash
# Using npx
npx asset-minify

# Using Bun
bunx asset-minify
```

To install as a development dependency:

```bash
npm install asset-minify --save-dev
```

---

## CLI Reference

### Commands
| Command | Description |
| :--- | :--- |
| `init` | Configure scripts in `package.json` and set up Husky git pre-commit hooks. |

### Options
| Option | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| `--dir <path>` | `-d` | Directory containing assets to optimize | `public/` (if exists), else current directory |
| `--quality <number>`| `-q` | Compression quality level (1-100) | `85` |
| `--dry-run` | | Calculate savings and verify logs without modifying files | `false` |
| `--no-cache` | | Force re-optimization of all files (disable cache) | `false` |
| `--video` | | Force video optimization (bypasses prompt) | `false` |
| `--yes` | `-y` | Auto-confirm all interactive prompts | `false` |
| `--backup` | | Backup modified files in `.asset-backup/` | `false` |
| `--exclude <globs...>`| | Exclude paths matching these glob patterns | `[]` |
| `--verbose` | | Show detailed line-by-line path logs | `false` |
| `--version` | `-V` | Output current CLI version | |
| `--help` | `-h` | Display help screen | |

---

## CLI Examples

```bash
# 1. Run a dry-run to see how many megabytes you would save
npx asset-minify --dry-run

# 2. Compress assets inside a custom directory with 80% quality and skip video prompts
npx asset-minify --dir src/assets --quality 80 --video

# 3. Backup your files and exclude specific folders
npx asset-minify --backup --exclude "**/ignored-assets/**" "**/mock/**"

# 4. Run with detailed verbose logs
npx asset-minify --verbose
```

---

## Git Pre-Commit Hook Integration

To prevent heavy, unoptimized assets from being committed to Git, you can automate this process.

Run the automatic configuration wizard:
```bash
npx asset-minify init
```

### Manual Setup (Husky + lint-staged)

1. Install Husky and lint-staged:
   ```bash
   npm install husky lint-staged --save-dev
   npx husky install
   ```

2. Add the following to your `package.json`:
   ```json
   {
     "lint-staged": {
       "public/**/*.{png,jpg,jpeg,webp,svg,mp4}": [
         "asset-minify --video"
       ]
     }
   }
   ```

3. Add a hook script to `.husky/pre-commit`:
   ```bash
   npx lint-staged
   ```

---

## Programmatic API

You can import and use `asset-minify` directly in Node.js scripts:

```typescript
import { optimizeFile, formatBytes } from 'asset-minify';

const result = await optimizeFile('/absolute/path/to/image.png', '/project/root', {
  dir: '/project/root/public',
  quality: 85,
  video: false,
  cache: true,
  dryRun: false,
  backup: true,
  yes: true
});

if (result.success && !result.skipped) {
  console.log(`Saved ${formatBytes(result.savedBytes)}!`);
}
```

---

## Contributing & Open Source

This project is open-source. Contributions, issues, and feature requests are welcome!

Please check the [Contributing Guidelines](file:///Users/narottamchy/Move37/Brainstrata/packages/asset-minify/CONTRIBUTING.md) for local development setup, test execution guides, and NPM release instructions.

---

## License

MIT © [Narottam Chy](https://github.com/narottamchy)
