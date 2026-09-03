#!/usr/bin/env node

const path = require('path');
const { validateIntegration } = require('./lib/validator');
const { scaffoldHook } = require('./lib/scaffolder');

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  console.log(`
Integration Agent CLI 🔄

Usage:
  node integration-agent.js validate <path>       Validate separation of concerns (no APIs in JSX)
  node integration-agent.js scaffold hook <Name> [--stack=Main]  Scaffold screen coordinator hook
`);
  process.exit(0);
}

if (command === 'validate') {
  const target = args[1] || './src';
  console.log(`🔍 Validating integration boundaries in ${target}...`);
  const findings = validateIntegration(target);

  if (findings.length === 0) {
    console.log('✅ All checked files adhere to clean integration boundaries.');
    process.exit(0);
  } else {
    console.error(`❌ Found ${findings.length} integration violations:`);
    findings.forEach(f => {
      console.error(`  - [${f.ruleId}] ${f.file}:${f.line} -> ${f.message}`);
    });
    process.exit(1);
  }
} else if (command === 'scaffold') {
  const type = args[1];
  const name = args[2];
  if (type === 'hook' && name) {
    const filePath = scaffoldHook(name);
    console.log(`✅ Scaffolded hook at ${filePath}`);
    process.exit(0);
  } else {
    console.error('Usage: node integration-agent.js scaffold hook <ScreenName>');
    process.exit(1);
  }
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
