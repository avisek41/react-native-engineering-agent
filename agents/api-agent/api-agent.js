#!/usr/bin/env node

/**
 * API Agent CLI Runner
 * Provides static validation, rule enforcement, and boilerplate scaffolding.
 */

const ApiValidator = require('./lib/validator');
const ApiScaffolder = require('./lib/scaffolder');
const ApiReport = require('./lib/report');
const { EXIT_CODES } = require('./lib/constants');

function parseArgs(args) {
  const flags = {};
  const positional = [];

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value !== undefined ? value : true;
    } else {
      positional.push(arg);
    }
  }

  return { command: positional[0], target: positional[1], flags };
}

function printHelp() {
  console.log(`
🔌 API Agent CLI

Usage:
  node api-agent/api-agent.js <command> [target] [options]

Commands:
  validate [path]          Run static rules against target path (default: ./src)
  scaffold <type>          Scaffold API files (type: query | infinite | mutation)
  help                     Show this help message

Options:
  --name=<moduleName>      Name for the scaffolded module (e.g. userProfile)
  --endpoint=<path>        Endpoint path (e.g. /user/profile)
  --method=<GET|POST|...>  HTTP method for mutation or fetcher
  --json                   Output report in JSON format
  --dry-run                Preview generated files without writing to disk
`);
}

function main() {
  const args = process.argv.slice(2);
  const { command, target, flags } = parseArgs(args);

  if (!command || command === 'help' || flags.help || flags.h) {
    printHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (command === 'validate') {
    const scanPath = target || './src';
    const validator = new ApiValidator();
    const findings = validator.scan(scanPath);
    ApiReport.printFindings(findings, flags);

    const hasErrors = findings.some(f => f.severity === 'error');
    process.exit(hasErrors ? EXIT_CODES.VALIDATION_ERROR : EXIT_CODES.SUCCESS);
  }

  if (command === 'scaffold') {
    const type = target || 'query';
    const name = flags.name || 'newModule';
    const endpoint = flags.endpoint || `/${name}`;
    const method = flags.method || (type === 'mutation' ? 'POST' : 'GET');

    const scaffolder = new ApiScaffolder({
      name,
      endpoint,
      method,
      type,
    });

    const result = scaffolder.generate(flags['dry-run']);
    console.log(`\n✨ Successfully scaffolded ${type} module '${result.pascalName}':`);
    result.createdFiles.forEach(f => console.log(`  - ${f}`));
    console.log('\nRemember to append barrel exports to:');
    console.log('  - src/types/index.ts');
    console.log('  - src/hooks/index.ts');
    console.log('  - src/api/endPoints.ts\n');
    process.exit(EXIT_CODES.SUCCESS);
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(EXIT_CODES.RUNTIME_ERROR);
}

main();
