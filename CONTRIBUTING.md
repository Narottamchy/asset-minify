# Contributing to asset-minify

Thank you for your interest in contributing to `asset-minify`! This document guides you through setting up your local environment, writing tests, and publishing updates.

---

## Local Development Setup

This project is built using TypeScript and utilizes `tsup` for bundling, and `jest` for testing. We recommend using `bun` for package management and scripts.

### 1. Install Dependencies
Clone the repository and install the dependencies:
```bash
bun install
```

### 2. Built Scripts
Verify the project builds cleanly:
```bash
bun run build
```
This generates ES Module (`.mjs`) and CommonJS (`.js`) bundles, along with TypeScript type declarations (`.d.ts`), inside the `dist/` directory.

### 3. Running Unit Tests
We use Jest for unit testing. Make sure all tests pass before making any changes:
```bash
bun run test
```

### 4. Local CLI Testing
To test the CLI locally against real files:
```bash
# Run the CLI directly using Node
node dist/cli.js --dir <path-to-test-folder> --dry-run

# Or link the CLI globally to test the executable command anywhere on your system
npm link
# Now you can run `asset-minify` directly in any directory
```

---

## Code Guidelines

- **TypeScript**: Write all code in TypeScript. Ensure types are clean and descriptive.
- **Tests**: Add corresponding unit tests in `tests/` for any new features or format support.
- **Terminal UX**: Keep console output minimal, professional, and clear. Avoid adding unnecessary emojis or noisy logging.

---

## Maintainer Guide: Releasing to NPM

If you are a maintainer publishing updates to the public NPM registry under `asset-minify`, follow these steps:

### 1. Versioning
Increment the version using Semantic Versioning commands:
```bash
npm version patch # Bug fixes (1.0.0 -> 1.0.1)
npm version minor # New features (1.0.0 -> 1.1.0)
npm version major # Breaking changes (1.0.0 -> 2.0.0)
```

### 2. Publishing
Log in to your NPM account and publish the package using your authenticator (2FA) OTP code:
```bash
# Log in (if not already authenticated)
npm login

# Build package
bun run build

# Publish package
npm publish --otp=YOUR_2FA_CODE
```

### 3. Git Tags
Push the generated version tags to GitHub:
```bash
git push origin main --tags
```
