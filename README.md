# asset-minify

[![npm version](https://img.shields.io/npm/v/@narottamchy/asset-minify.svg?style=flat-square)](https://www.npmjs.com/package/@narottamchy/asset-minify)
[![license](https://img.shields.io/npm/l/@narottamchy/asset-minify.svg?style=flat-square)](https://github.com/narottamchy/asset-minify/blob/main/LICENSE)

A high-performance CLI and programmatic asset optimizer designed for frontend applications (Next.js, React, Vue, Svelte, etc.).

`asset-minify` compresses images, SVGs, and videos in-place using smart, visually lossless defaults, saving 50% to 90% of file size. Featuring an incremental cache system, it only processes new or modified assets, keeping subsequent runs near-instantaneous.

---

## Features

- **Incremental Cache**: Tracks file hashes and parameters to only process new or modified files.
- **Advanced Image Compression**:
  - **JPEGs**: Advanced MozJPEG progressive compression (visually lossless).
  - **PNGs**: True lossless compression (quality 100) or palette-quantized near-lossless compression (quality < 100).
  - **WebP & AVIF**: High-efficiency modern formats with visual tuning.
  - **GIFs**: Re-compresses animated GIF frames.
- **SVG Optimization**: Strips metadata and editor artifacts via SVGO while preserving IDs and viewBox properties.
- **Video Transcoding**: Transcodes large videos (`.mp4`, `.webm`, `.mov`) to web-friendly H.264/AAC formats. Detects interactive shells and prompts before slow compression runs.
- **Atomic Writes**: Writes to a temporary file before atomically replacing the original to prevent file corruption.
- **Progress Reporting**: Minimalist, interactive terminal progress bar with automatic fallback for CI/non-TTY environments.
- **Dual module support**: Includes full TypeScript definitions supporting both CommonJS and ES Modules.

---

## Installation

```bash
# Run on the fly without installing (after publishing to NPM)
npx @narottamchy/asset-minify

# Or with Bun
bunx @narottamchy/asset-minify
```

To install as a development dependency:

```bash
npm install @narottamchy/asset-minify --save-dev
```

### Local Development & Testing

To test the CLI locally before publishing it:

```bash
# 1. Build the package
bun run build

# 2. Run the CLI directly
node dist/cli.js --dry-run

# 3. Or link the CLI globally to test the executable command anywhere on your system
npm link
# Now you can run `asset-minify` in any folder!
```

---

## CLI Usage

```text
Usage: asset-minify [options] [command]

High-performance CLI asset optimizer for frontend projects

Options:
  -V, --version            output the version number
  -d, --dir <path>         Directory to optimize (default: public/ if exists,
                           else current directory)
  -q, --quality <number>   Compression quality (1-100, default: 85) (default:
                           85)
  --dry-run                Calculate savings without modifying files (default:
                           false)
  --no-cache               Force re-optimization of all files
  --video                  Force optimization of videos (bypasses prompt)
                           (default: false)
  -y, --yes                Auto-confirm all interactive prompts (default:
                           false)
  --backup                 Create backups of modified files in .asset-backup/
                           (default: false)
  --exclude <patterns...>  Exclude paths matching these glob patterns
  --verbose                Show detailed path logs during optimization
                           (default: false)
  -h, --help               display help for command

Commands:
  init                     Configure asset-minify inside your project
                           package.json and git hooks
```

### Examples

```bash
# Dry-run to see how many megabytes you would save without writing changes
npx asset-minify --dry-run

# Compress assets inside a custom directory with 80% quality and skip video prompting
npx asset-minify --dir src/assets --quality 80 --video

# Backup original files and exclude specific folders
npx asset-minify --backup --exclude "**/ignored-assets/**" "**/mock/**"
```

---

## Git Pre-Commit Hook Integration

To prevent unoptimized assets from being pushed to Git, you can automate this using Git hooks.

Run the configuration wizard:
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

You can import and use `@narottamchy/asset-minify` directly in Node.js scripts:

```typescript
import { optimizeFile, CacheManager, formatBytes } from '@narottamchy/asset-minify';

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

## Publishing to NPM

If you are maintaining or deploying this package, follow these steps:

### 1. Build Verification
Verify that the package builds cleanly with ESM and CommonJS outputs:
```bash
npm run build
```
This outputs the bundle files to the `dist/` directory.

### 2. Version Updates
Increment the version using Semantic Versioning commands:
```bash
npm version patch # Bug fixes (1.0.0 -> 1.0.1)
npm version minor # New features (1.0.0 -> 1.1.0)
npm version major # Breaking changes (1.0.0 -> 2.0.0)
```

### 3. NPM Publication
Ensure you are logged in to the registry, then publish:
```bash
npm login
npm publish
```
*(For scoped packages, use `npm publish --access public`)*.

---

## License

MIT © [Narottam Chy](https://github.com/narottamchy)
