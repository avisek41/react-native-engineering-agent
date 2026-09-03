#!/usr/bin/env node

/**
 * UI Agent CLI
 * Usage:
 *   node ui-agent.js validate ./src/screens
 *   node ui-agent.js scaffold screen <ScreenName> [--stack <Main|Auth>]
 *   node ui-agent.js scaffold component <ComponentName>
 */

const path = require('path');
const { validateTarget } = require('./lib/validator');
const { printConsoleReport, generateMarkdownReport } = require('./lib/reporter');
const { scaffoldScreen, scaffoldComponent } = require('./lib/scaffolder');

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
UI Agent CLI 🎨

Usage:
  node ui-agent/ui-agent.js <command> [options]

Commands:
  validate <path>                 Scan target directory or file for UI token and rule violations
  scaffold screen <ScreenName>    Scaffold a complete screen module with types, index & strings
  scaffold component <Name>       Scaffold a reusable UI primitive under src/components/ui/
  help                            Show this help message

Options:
  --stack <Main|Auth>             Stack name for screen scaffolding (default: Main)
  --format <console|md>           Output format for validation report (default: console)

Examples:
  node ui-agent/ui-agent.js validate ./src/screens
  node ui-agent/ui-agent.js scaffold screen PlayerStats --stack Main
  node ui-agent/ui-agent.js scaffold component BadgeTag
`);
}

async function run() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'validate') {
    const targetPath = args[1] || './src';
    const summary = validateTarget(targetPath);

    const formatIndex = args.indexOf('--format');
    const format = formatIndex !== -1 ? args[formatIndex + 1] : 'console';

    if (format === 'md') {
      console.log(generateMarkdownReport(summary));
    } else {
      printConsoleReport(summary);
    }

    if (summary.errors > 0) {
      process.exit(1);
    }
    return;
  }

  if (command === 'scaffold') {
    const subCommand = args[1];
    const name = args[2];

    if (!subCommand || !name) {
      console.error('❌ Error: Missing arguments for scaffold. Usage: ui-agent scaffold <screen|component> <Name>');
      process.exit(1);
    }

    if (subCommand === 'screen') {
      const stackIndex = args.indexOf('--stack');
      const stack = stackIndex !== -1 ? args[stackIndex + 1] : 'Main';

      try {
        const result = scaffoldScreen(name, { stack });
        console.log(`\n✅ Successfully scaffolded screen "${name}" in ${result.screenDir}:`);
        result.files.forEach(f => console.log(`   📄 ${f}`));
        console.log('\nNext steps:');
        console.log('1. Add layout and presentational components.');
        console.log('2. Register route in src/navigation/NavigationUtilis.ts & MainStack.');
        console.log('3. Run "node ui-agent/ui-agent.js validate" to verify token compliance.\n');
      } catch (err) {
        console.error(`❌ Scaffolding failed: ${err.message}`);
        process.exit(1);
      }
      return;
    }

    if (subCommand === 'component') {
      try {
        const result = scaffoldComponent(name);
        console.log(`\n✅ Successfully scaffolded component "${name}" in ${result.componentDir}:`);
        result.files.forEach(f => console.log(`   📄 ${f}`));
        console.log('\nNext steps:');
        console.log('1. Add component markup and styles using design tokens.');
        console.log('2. Export from src/components/ui/index.ts and src/components/index.ts.\n');
      } catch (err) {
        console.error(`❌ Scaffolding failed: ${err.message}`);
        process.exit(1);
      }
      return;
    }

    console.error(`❌ Unknown scaffold target: ${subCommand}`);
    process.exit(1);
  }

  console.error(`❌ Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

run();
