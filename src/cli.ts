#!/usr/bin/env node
import { Command } from 'commander';
import { resolve, join, relative } from 'path';
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import pc from 'picocolors';
import prompts from 'prompts';
import os from 'os';
import readline from 'readline';

import { findFiles, formatBytes, getFileHash, isCommandAvailable } from './utils';
import { CacheManager } from './cache';
import { optimizeFile } from './optimizer';
import { OptimizeOptions, OptimizeResult, SummaryStats } from './types';

// Supported extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.heif', '.heic', '.tiff', '.tif'];
const SVG_EXTENSIONS = ['.svg'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];
const ALL_EXTENSIONS = [...IMAGE_EXTENSIONS, ...SVG_EXTENSIONS, ...VIDEO_EXTENSIONS];

class ProgressReporter {
  private total: number;
  private current = 0;
  private savedBytes = 0;
  private activeFile = '';
  private spinnerIndex = 0;
  private spinnerInterval: NodeJS.Timeout | null = null;
  private isInteractive: boolean;
  private verbose: boolean;

  constructor(total: number, verbose = false) {
    this.total = total;
    this.verbose = verbose;
    this.isInteractive = process.stdout.isTTY && !verbose;
  }

  public start() {
    if (this.isInteractive) {
      // Hide cursor to prevent flickering
      process.stdout.write('\x1B[?25l');
      
      const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      this.spinnerInterval = setInterval(() => {
        this.spinnerIndex = (this.spinnerIndex + 1) % spinnerFrames.length;
        this.render();
      }, 80);
    }
  }

  public update(file: string, originalSize: number, optimizedSize: number, success: boolean, skipped: boolean, savedBytes: number) {
    this.current++;
    this.savedBytes += savedBytes;
    this.activeFile = file;

    if (this.verbose) {
      const savingsPercent = originalSize > 0 ? ((savedBytes / originalSize) * 100).toFixed(1) : '0';
      if (success && !skipped) {
        console.log(
          pc.dim(`  [${this.current}/${this.total}] `) +
          pc.green('✔') +
          pc.white(` ${file} `) +
          pc.dim(`(${formatBytes(originalSize)} → ${formatBytes(optimizedSize)}, -${savingsPercent}%)`)
        );
      } else if (skipped) {
        console.log(
          pc.dim(`  [${this.current}/${this.total}] `) +
          pc.yellow('ℹ') +
          pc.gray(` ${file} `) +
          pc.dim('(skipped)')
        );
      } else {
        console.log(
          pc.dim(`  [${this.current}/${this.total}] `) +
          pc.red('✖') +
          pc.red(` ${file} `) +
          pc.dim('(failed)')
        );
      }
    } else {
      this.render();
    }
  }

  private render() {
    if (!this.isInteractive) {
      return;
    }

    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const spinner = pc.cyan(spinnerFrames[this.spinnerIndex]);
    const percent = Math.min(100, Math.round((this.current / this.total) * 100));
    
    // Create progress bar [■■■■■■■░░░░░░░]
    const barWidth = 15;
    const filledWidth = Math.round((percent / 100) * barWidth);
    const emptyWidth = barWidth - filledWidth;
    const bar = pc.green('■'.repeat(filledWidth)) + pc.dim('░'.repeat(emptyWidth));
    
    // Status text
    const status = pc.dim(`${this.current}/${this.total}`);
    const savings = this.savedBytes > 0 ? pc.bold(pc.green(`saved ${formatBytes(this.savedBytes)}`)) : pc.dim('saved 0 B');
    
    // Active file (truncated to fit screen nicely)
    const columns = process.stdout.columns || 80;
    const maxWidth = Math.max(20, columns - 55);
    let displayFile = this.activeFile;
    if (displayFile.length > maxWidth) {
      displayFile = '...' + displayFile.slice(-(maxWidth - 3));
    }
    const fileText = pc.dim(displayFile);

    // Build line
    const line = `${spinner} [${bar}] ${percent}% | ${status} | ${savings} | ${fileText}`;
    
    // Clear current line and write the new status line
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(line);
  }

  public stop() {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    if (this.isInteractive) {
      // Clear line, show cursor
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write('\x1B[?25h');
    }
  }
}

const program = new Command();

program
  .name('asset-minify')
  .description('High-performance CLI asset optimizer for frontend projects')
  .version('1.0.0')
  .option('-d, --dir <path>', 'Directory to optimize (default: public/ if exists, else current directory)')
  .option('-q, --quality <number>', 'Compression quality (1-100, default: 85)', (val) => parseInt(val, 10), 85)
  .option('--dry-run', 'Calculate savings without modifying files', false)
  .option('--no-cache', 'Force re-optimization of all files', false)
  .option('--video', 'Force optimization of videos (bypasses prompt)', false)
  .option('-y, --yes', 'Auto-confirm all interactive prompts', false)
  .option('--backup', 'Create backups of modified files in .asset-backup/', false)
  .option('--exclude <patterns...>', 'Exclude paths matching these glob patterns')
  .option('--verbose', 'Show detailed path logs during optimization', false)
  .action(async (options) => {
    try {
      await runOptimizer(options);
    } catch (error) {
      console.error(pc.red(`\nFatal error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Configure asset-minify inside your project package.json and git hooks')
  .action(async () => {
    try {
      await runInit();
    } catch (error) {
      console.error(pc.red(`\nInitialization error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Parse process arguments
program.parse(process.argv);

/**
 * Concurrency worker pool to limit parallel execution.
 */
async function poolLimit<T, R>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const p = fn(item).then((res) => {
      results.push(res);
    });
    executing.add(p);
    
    const clean = () => executing.delete(p);
    p.then(clean, clean);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}

/**
 * Core Orchestrator for asset optimization.
 */
async function runOptimizer(cliOptions: any) {
  const startTime = Date.now();
  const rootDir = process.cwd();

  // 1. Resolve Target Directory
  let targetDir = cliOptions.dir;
  if (!targetDir) {
    const defaultPublic = resolve(rootDir, 'public');
    if (existsSync(defaultPublic)) {
      targetDir = defaultPublic;
    } else {
      targetDir = rootDir;
    }
  } else {
    targetDir = resolve(rootDir, targetDir);
  }

  if (!existsSync(targetDir)) {
    throw new Error(`Target directory does not exist: ${targetDir}`);
  }

  console.log(pc.cyan(`Scanning assets in: ${pc.bold(targetDir)}`));

  // 2. Scan and Categorize Files
  const excludePatterns = cliOptions.exclude || [];
  const matchedFiles = await findFiles(targetDir, ALL_EXTENSIONS, excludePatterns);

  if (matchedFiles.length === 0) {
    console.log(pc.yellow('No supported files found.'));
    return;
  }

  const imageFiles = matchedFiles.filter(f => {
    const ext = f.substring(f.lastIndexOf('.')).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext) || SVG_EXTENSIONS.includes(ext);
  });
  const videoFiles = matchedFiles.filter(f => {
    const ext = f.substring(f.lastIndexOf('.')).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  });

  console.log(pc.dim(`Found ${imageFiles.length} image(s)/SVG(s) and ${videoFiles.length} video(s).`));

  // 3. Process Video Check and Prompts
  let optimizeVideos = false;
  
  if (videoFiles.length > 0) {
    const ffmpegAvailable = isCommandAvailable('ffmpeg');

    if (!ffmpegAvailable) {
      console.log(pc.yellow(`⚠ Found ${videoFiles.length} video files, but FFmpeg is not installed.`));
      console.log(pc.dim('  Skipping video optimization. Install FFmpeg on your system PATH to optimize video files.'));
    } else if (cliOptions.video || cliOptions.yes) {
      optimizeVideos = true;
    } else {
      // Check if stdin is interactive (TTY)
      const isInteractive = process.stdin.isTTY;
      if (isInteractive) {
        console.log('');
        const response = await prompts({
          type: 'confirm',
          name: 'confirmVideo',
          message: `Found ${videoFiles.length} video files. Video optimization can be resource-intensive. Do you want to optimize them?`,
          initial: false
        });
        optimizeVideos = !!response.confirmVideo;
      } else {
        console.log(pc.dim('  Non-interactive terminal detected. Skipping video optimization by default.'));
        console.log(pc.dim('  Use the --video flag to force video optimization in CI or git hooks.'));
      }
    }
  }

  const options: OptimizeOptions = {
    dir: targetDir,
    quality: cliOptions.quality,
    video: optimizeVideos,
    cache: cliOptions.cache,
    dryRun: cliOptions.dryRun,
    backup: cliOptions.backup,
    yes: cliOptions.yes,
    verbose: cliOptions.verbose,
  };

  // 4. Initialize Cache Manager
  const cacheManager = new CacheManager(rootDir);
  if (options.cache) {
    cacheManager.load();
  }

  // Files queue
  const filesToProcess: { filePath: string; relativePath: string; hash: string }[] = [];
  const skippedCachedFiles: OptimizeResult[] = [];

  // Pre-scan hashes to check cache
  console.log(pc.cyan('Analyzing files and checking cache...'));
  for (const filePath of matchedFiles) {
    const relativePath = relative(rootDir, filePath);
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    
    // Skip videos if video optimization is disabled
    if (VIDEO_EXTENSIONS.includes(ext) && !options.video) {
      continue;
    }

    try {
      const fileHash = await getFileHash(filePath);
      
      if (options.cache) {
        const cached = cacheManager.getValidEntry(relativePath, fileHash, options.quality);
        if (cached) {
          const stats = statSync(filePath);
          skippedCachedFiles.push({
            filePath,
            relativePath,
            extension: ext,
            originalSize: stats.size,
            optimizedSize: stats.size,
            savedBytes: 0,
            success: true,
            skipped: true,
            error: 'Cache hit'
          });
          continue;
        }
      }
      
      filesToProcess.push({ filePath, relativePath, hash: fileHash });
    } catch (err) {
      console.error(pc.red(`Failed to read hash for ${relativePath}: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  if (filesToProcess.length > 0) {
    console.log(
      pc.blue(`Found ${filesToProcess.length} file(s) to optimize`) +
      (skippedCachedFiles.length > 0 ? pc.dim(` (${skippedCachedFiles.length} cached)`) : '')
    );
  }

  if (filesToProcess.length === 0) {
    console.log(pc.green('\nAll assets are already optimized.'));
    printSummary({
      totalFiles: matchedFiles.length,
      processedFiles: 0,
      skippedFiles: skippedCachedFiles.length,
      failedFiles: 0,
      originalTotalSize: skippedCachedFiles.reduce((sum, f) => sum + f.originalSize, 0),
      optimizedTotalSize: skippedCachedFiles.reduce((sum, f) => sum + f.optimizedSize, 0),
      savedTotalBytes: 0,
      byExtension: {},
      durationMs: Date.now() - startTime
    });
    return;
  }

  // 5. Run Concurrency Work Pool
  const cores = Math.max(1, os.cpus().length - 1);
  if (options.verbose) {
    console.log(pc.cyan(`Optimizing assets (${cores} parallel workers)...`));
  } else if (!process.stdout.isTTY) {
    console.log(pc.cyan('Optimizing assets...'));
  }

  const reporter = new ProgressReporter(filesToProcess.length, options.verbose);
  reporter.start();

  const results: OptimizeResult[] = [];
  const failures: { relativePath: string; error: string }[] = [];

  const runTask = async (task: typeof filesToProcess[0]): Promise<OptimizeResult> => {
    const result = await optimizeFile(task.filePath, rootDir, options);

    if (result.success && !result.skipped && options.cache && !options.dryRun) {
      cacheManager.set(task.relativePath, task.hash, result.optimizedSize, options.quality);
    }
    
    if (result.success && !result.skipped) {
      // Success
    } else if (result.skipped) {
      // If skipped because compressed version was larger, cache the current hash to avoid recalculation next time
      if (options.cache && !options.dryRun && result.error === 'Compressed version is larger or equal to original') {
        cacheManager.set(task.relativePath, task.hash, result.originalSize, options.quality);
      }
    } else {
      failures.push({ relativePath: task.relativePath, error: result.error || 'Unknown error' });
    }

    reporter.update(
      task.relativePath,
      result.originalSize,
      result.optimizedSize,
      result.success,
      result.skipped,
      result.savedBytes || 0
    );

    return result;
  };

  // Run the tasks through pool limit
  const activeResults = await poolLimit(cores, filesToProcess, runTask);
  reporter.stop();

  results.push(...activeResults, ...skippedCachedFiles);

  // Save cache
  if (options.cache && !options.dryRun) {
    cacheManager.save();
  }

  // Log failures if any
  if (failures.length > 0) {
    console.log(pc.red('\nFailures:'));
    for (const f of failures) {
      console.log(`  ${pc.red('✖')} ${f.relativePath}: ${f.error}`);
    }
  }

  // 6. Compile and Print Summary Stats
  const durationMs = Date.now() - startTime;
  const stats = compileStats(results, durationMs);
  printSummary(stats);
}

/**
 * Compile details into unified stats.
 */
function compileStats(results: OptimizeResult[], durationMs: number): SummaryStats {
  const stats: SummaryStats = {
    totalFiles: results.length,
    processedFiles: 0,
    skippedFiles: 0,
    failedFiles: 0,
    originalTotalSize: 0,
    optimizedTotalSize: 0,
    savedTotalBytes: 0,
    byExtension: {},
    durationMs,
  };

  for (const r of results) {
    stats.originalTotalSize += r.originalSize;
    stats.optimizedTotalSize += r.optimizedSize;
    stats.savedTotalBytes += r.savedBytes;

    if (!r.success) {
      stats.failedFiles++;
    } else if (r.skipped) {
      stats.skippedFiles++;
    } else {
      stats.processedFiles++;
    }

    const ext = r.extension.toLowerCase();
    if (!stats.byExtension[ext]) {
      stats.byExtension[ext] = {
        originalSize: 0,
        optimizedSize: 0,
        savedBytes: 0,
        count: 0
      };
    }

    const extStat = stats.byExtension[ext];
    extStat.originalSize += r.originalSize;
    extStat.optimizedSize += r.optimizedSize;
    extStat.savedBytes += r.savedBytes;
    extStat.count++;
  }

  return stats;
}

function printSummary(stats: SummaryStats) {
  console.log('\n' + pc.bold(pc.cyan('Asset Optimization Summary')));
  
  const totalSavingsPercent = stats.originalTotalSize > 0 
    ? ((stats.savedTotalBytes / stats.originalTotalSize) * 100).toFixed(1) 
    : '0.0';

  console.log(`  ${pc.dim('Duration:')}          ${(stats.durationMs / 1000).toFixed(2)}s`);
  console.log(`  ${pc.dim('Files:')}             ${stats.processedFiles} optimized, ${stats.skippedFiles} skipped, ${stats.failedFiles} failed`);
  
  if (stats.originalTotalSize > 0) {
    console.log(`  ${pc.dim('Original Size:')}     ${formatBytes(stats.originalTotalSize)}`);
    console.log(`  ${pc.dim('Optimized Size:')}    ${formatBytes(stats.optimizedTotalSize)}`);
    console.log(`  ${pc.dim('Total Saved:')}       ${pc.bold(pc.green(formatBytes(stats.savedTotalBytes)))} (${pc.bold(pc.green(`-${totalSavingsPercent}%`))})`);
  }

  const extensions = Object.keys(stats.byExtension);
  if (extensions.length > 0 && stats.originalTotalSize > 0) {
    console.log('');
    console.log(
      '  ' +
      pc.dim(
        pad('Extension', 12) +
        pad('Count', 8) +
        pad('Original', 12) +
        pad('Optimized', 12) +
        'Savings'
      )
    );
    console.log('  ' + pc.dim('─'.repeat(52)));
    
    for (const ext of extensions) {
      const item = stats.byExtension[ext];
      const savingsPercent = item.originalSize > 0 ? ((item.savedBytes / item.originalSize) * 100).toFixed(1) : '0.0';
      const savingsText = item.savedBytes > 0 
        ? pc.green(`-${savingsPercent}% (${formatBytes(item.savedBytes)})`)
        : pc.dim('0.0%');
      console.log(
        '  ' +
        pad(ext, 12) +
        pad(String(item.count), 8) +
        pad(formatBytes(item.originalSize), 12) +
        pad(formatBytes(item.optimizedSize), 12) +
        savingsText
      );
    }
  }
  console.log('');
}

function pad(str: string, length: number): string {
  return str.padEnd(length).substring(0, length);
}

/**
 * Configure standard scripts and CLI setups.
 */
async function runInit() {
  const rootDir = process.cwd();
  const packageJsonPath = join(rootDir, 'package.json');

  if (!existsSync(packageJsonPath)) {
    console.log(pc.red('Error: package.json not found in current directory. Please run this command inside your project root.'));
    return;
  }

  console.log(pc.cyan('Configuring asset-minify in package.json...'));
  
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    pkg.scripts = pkg.scripts || {};
    
    // Add scripts
    pkg.scripts['optimize-assets'] = 'asset-minify';
    pkg.scripts['optimize-assets:dry'] = 'asset-minify --dry-run';
    
    writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf8');
    console.log(pc.green('Added scripts to package.json:'));
    console.log(pc.dim('  • "optimize-assets": "asset-minify"'));
    console.log(pc.dim('  • "optimize-assets:dry": "asset-minify --dry-run"'));

    console.log(pc.cyan('\nGit pre-commit hook setup guide:'));
    console.log('To automate optimization before commits, you can use Husky and lint-staged.');
    console.log(pc.cyan('\n1. Install dependencies:'));
    console.log(pc.bold('   npm install husky lint-staged --save-dev'));
    console.log(pc.cyan('\n2. Add the following config to your package.json:'));
    
    const configExample = {
      "husky": {
        "hooks": {
          "pre-commit": "lint-staged"
        }
      },
      "lint-staged": {
        "public/**/*.{png,jpg,jpeg,webp,svg,mp4}": [
          "asset-minify --video"
        ]
      }
    };
    
    console.log(pc.dim(JSON.stringify(configExample, null, 2)));
    console.log(pc.green('\nSetup complete! Run optimization using `npm run optimize-assets` or `bun run optimize-assets`.'));
  } catch (error) {
    throw new Error(`Failed to edit package.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}
