import { Command } from 'commander';

describe('CLI Options Parser', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program
      .name('asset-minify')
      .option('-d, --dir <path>', 'Directory')
      .option('-q, --quality <number>', 'Quality', (val) => parseInt(val, 10), 85)
      .option('--dry-run', 'Dry run', false)
      .option('--no-cache', 'No cache', false)
      .option('--video', 'Video', false)
      .option('-y, --yes', 'Yes', false)
      .option('--backup', 'Backup', false)
      .option('--verbose', 'Verbose', false);
  });

  it('should enable verbose logging flag', () => {
    program.parse(['node', 'cli.js', '--verbose']);
    const options = program.opts();
    expect(options.verbose).toBe(true);
  });

  it('should parse quality settings correctly', () => {
    program.parse(['node', 'cli.js', '-q', '50']);
    const options = program.opts();
    expect(options.quality).toBe(50);
  });

  it('should enable dry-run flag', () => {
    program.parse(['node', 'cli.js', '--dry-run']);
    const options = program.opts();
    expect(options.dryRun).toBe(true);
  });

  it('should disable caching via no-cache option', () => {
    program.parse(['node', 'cli.js', '--no-cache']);
    const options = program.opts();
    expect(options.cache).toBe(false);
  });

  it('should parse directory setting', () => {
    program.parse(['node', 'cli.js', '-d', './src/assets']);
    const options = program.opts();
    expect(options.dir).toBe('./src/assets');
  });

  it('should register init command', () => {
    const initCmd = new Command('init');
    program.addCommand(initCmd);
    
    const foundInit = program.commands.find(c => c.name() === 'init');
    expect(foundInit).toBeDefined();
  });
});
