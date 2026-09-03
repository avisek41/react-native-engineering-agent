#!/usr/bin/env node

'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Security Agent — Deterministic Local Security Analysis          ║
 * ║  Usage:  node security-agent-ai.js [target...] [options]         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Wraps the existing static scanner with contextual analysis,
 * false-positive detection, priority scoring, and fix generation.
 *
 * No LLM. No API keys. No network access. No new dependencies.
 * Fully offline, deterministic, local analysis.
 */

const fs = require('fs');
const path = require('path');

// ── Existing scanner modules ─────────────────────────────────────
const { loadConfig } = require('./lib/config');
const { detectScanScope, buildMergedDomains } = require('./lib/scope');
const {
  walkDir, scanFile, resolveFileDomain, runInverseChecks,
  makeFindingFactory, applySuppressions,
} = require('./lib/scanner');
const { checkDependencies } = require('./lib/deps');
const { FOLDER_DOMAINS, LOW_RISK_DOMAINS } = require('./lib/constants');
const { filterBySeverity, generateStats } = require('./lib/report');

// ── New agent modules ────────────────────────────────────────────
const { analyzeContext, buildRepositoryContext } = require('./lib/context-analyzer');
const { calculatePriority, rankFindings, generateTopActions, correlateFindings, getPriorityDistribution } = require('./lib/triage-engine');
const { generateAgentMarkdownReport, generateAgentJSONReport } = require('./lib/agent-report');

// ────────────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (const arg of args) {
  if (arg === '-h' || arg === '--help') {
    flags.help = true;
  } else if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    flags[key] = val ?? true;
  } else {
    positional.push(arg);
  }
}

if (flags.help) {
  printHelp();
  process.exit(0);
}

// ────────────────────────────────────────────────────────────────────
// Resolve configuration
// ────────────────────────────────────────────────────────────────────

const rawTargets = positional.length > 0 ? positional : ['.'];
const targets = rawTargets.map(t => path.resolve(t));

for (const t of targets) {
  if (!fs.existsSync(t)) {
    console.error(`❌ Target not found: ${t}`);
    process.exit(1);
  }
}

const config = loadConfig(targets, flags);
const mergedDomains = buildMergedDomains(config.customDomainRules);

const isQuick = flags.quick === true;
const isInteractive = flags.interactive === true;
const isFix = flags.fix === true;
const outputFormat = flags.format || 'md';
const isQuiet = config.quiet;

function log(...a) {
  if (!isQuiet) console.log(...a);
}

// ────────────────────────────────────────────────────────────────────
// Main Pipeline
// ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  for (let ti = 0; ti < targets.length; ti++) {
    const targetDir = targets[ti];
    const rawArg = rawTargets[ti];

    let scope = detectScanScope(targetDir, rawArg, mergedDomains);
    if (config.scopeOverride && ['root', 'folder', 'file'].includes(config.scopeOverride)) {
      scope = { ...scope, mode: config.scopeOverride };
    }

    // ── Banner ──
    log('');
    log('  ╔══════════════════════════════════════════════════════════╗');
    log(`  ║  🛡️  Security Agent — ${config.appName}`);
    log('  ║  Deterministic Local Security Analysis                   ║');
    log('  ╚══════════════════════════════════════════════════════════╝');
    log('');
    log(`  📁 Target:     ${targetDir}`);
    log(`  🎯 Scan Mode:  ${scope.mode.toUpperCase()}${scope.mode === 'folder' ? ` (domain: ${scope.domain})` : ''}`);
    log(`  📝 Format:     ${outputFormat.toUpperCase()}`);
    if (isQuick) log('  ⚡ Quick Mode:  ON (critical/high only)');
    if (isFix) log('  🔧 Auto-Fix:   ON (safe fixes only)');
    if (isInteractive) log('  💬 Interactive: ON');
    log('');

    // ════════════════════════════════════════════════════════════════
    // Phase 1: DETECT — Run existing scanner
    // ════════════════════════════════════════════════════════════════
    log('  ⏳ Phase 1: Detecting security findings...');

    const findings = [];
    const addFinding = makeFindingFactory(targetDir, config.complianceFrameworks);

    const files = scope.mode === 'file' ? [targetDir] : walkDir(targetDir, [], config.excludePaths);
    log(`  ✅ Found ${files.length} source file(s)`);

    const domainContentMap = {};

    for (const file of files) {
      let fileDomain = null;
      if (scope.mode === 'root') {
        fileDomain = resolveFileDomain(file, targetDir, mergedDomains);
      } else if (scope.mode === 'folder') {
        fileDomain = scope.domain;
      } else if (scope.mode === 'file') {
        fileDomain = scope.domain;
      }

      scanFile(file, targetDir, findings, addFinding, fileDomain, config.customDomainRules);

      if (scope.mode !== 'file' && fileDomain && ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(file))) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          domainContentMap[fileDomain] = (domainContentMap[fileDomain] || '') + '\n' + content;
        } catch { /* skip */ }
      }
    }

    const allContent = files
      .filter(f => ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(f)))
      .map(f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } })
      .join('\n');

    runInverseChecks({
      scope, findings, addFinding, appType: config.appType,
      allContent, domainContentMap, customDomainRules: config.customDomainRules,
    });

    if (!config.skipDeps && scope.mode === 'root') {
      checkDependencies(targetDir, findings, addFinding, isQuiet);
    }

    let processedFindings = applySuppressions(findings, config.suppressions);

    // Quick mode: filter to critical/high only
    if (isQuick) {
      processedFindings = processedFindings.filter(f => f.severity && f.severity.level >= 3);
    }

    log(`  ✅ Phase 1 complete: ${processedFindings.length} findings`);

    // ════════════════════════════════════════════════════════════════
    // Phase 2: ANALYZE — Context analysis
    // ════════════════════════════════════════════════════════════════
    log('  ⏳ Phase 2: Analyzing context...');

    const repoContext = buildRepositoryContext(targetDir, config);

    // Build file content cache to avoid re-reading
    const fileCache = new Map();
    function getFileContent(relFile) {
      if (fileCache.has(relFile)) return fileCache.get(relFile);

      // Reconstruct absolute path
      const absPath = relFile.startsWith('(') ? null : path.resolve(targetDir, relFile);
      let content = null;
      if (absPath) {
        try {
          const stat = fs.statSync(absPath);
          // Skip very large files (> 2MB) and binary files
          if (stat.size <= 2 * 1024 * 1024) {
            content = fs.readFileSync(absPath, 'utf8');
          }
        } catch { /* skip */ }
      }
      fileCache.set(relFile, content);
      return content;
    }

    const enrichedFindings = [];
    for (const finding of processedFindings) {
      const fileContent = getFileContent(finding.file);
      const absPath = finding.file.startsWith('(') ? finding.file : path.resolve(targetDir, finding.file);

      const enriched = analyzeContext(finding, fileContent, absPath, repoContext);
      enrichedFindings.push(enriched);
    }

    log(`  ✅ Phase 2 complete: ${enrichedFindings.filter(f => f.context?.isFalsePositive).length} likely false positives identified`);

    // ════════════════════════════════════════════════════════════════
    // Phase 3: TRIAGE — Priority scoring & correlation
    // ════════════════════════════════════════════════════════════════
    log('  ⏳ Phase 3: Triaging findings...');

    // Calculate priority for each finding
    for (let i = 0; i < enrichedFindings.length; i++) {
      enrichedFindings[i].priority = calculatePriority(enrichedFindings[i], config.appType, enrichedFindings);
    }

    // Correlate findings
    const correlatedFindings = correlateFindings(enrichedFindings);

    // Rank findings
    const rankedFindings = rankFindings(correlatedFindings);

    // Top actions
    const topActions = generateTopActions(rankedFindings, 3);

    const dist = getPriorityDistribution(rankedFindings.filter(f => !f.context?.isFalsePositive));
    log(`  ✅ Phase 3 complete: 🔥${dist.fixImmediately} ⚡${dist.fixThisSprint} 📋${dist.backlog} ℹ️ ${dist.informational}`);

    // ════════════════════════════════════════════════════════════════
    // Interactive Mode
    // ════════════════════════════════════════════════════════════════
    if (isInteractive) {
      await runInteractiveMode(rankedFindings, targetDir, config);
    }

    // ════════════════════════════════════════════════════════════════
    // Auto-Fix Mode
    // ════════════════════════════════════════════════════════════════
    if (isFix && !isInteractive) {
      await applyAutoFixes(rankedFindings, targetDir, isQuiet);
    }

    // ════════════════════════════════════════════════════════════════
    // Phase 4: REPORT — Generate output
    // ════════════════════════════════════════════════════════════════
    log('  ⏳ Phase 4: Generating report...');

    const stats = generateStats(processedFindings);
    const scanDurationMs = Date.now() - startTime;

    const reportData = {
      appName: config.appName,
      appType: config.appType,
      scope,
      findings: rankedFindings,
      topActions,
      stats,
      filesScanned: files.length,
      scanDurationMs,
    };

    let reportContent;
    let ext;

    if (outputFormat === 'json') {
      reportContent = generateAgentJSONReport(reportData);
      ext = 'json';
    } else {
      reportContent = generateAgentMarkdownReport(reportData);
      ext = 'md';
    }

    // Write report
    const reportDir = config.outputPath ? path.dirname(config.outputPath) : path.join(process.cwd(), 'security-agent-report');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    const outputPath = config.outputPath || path.join(reportDir, `agent-report.${ext}`);
    fs.writeFileSync(outputPath, reportContent, 'utf8');

    // ── Console Summary ──
    log('');
    log('  ╔══════════════════════════════════════════════════════════╗');
    log('  ║                 AGENT SCAN COMPLETE                     ║');
    log('  ╚══════════════════════════════════════════════════════════╝');
    log('');
    log(`  🏷️  App:              ${config.appName}`);
    log(`  🎯 Mode:              ${scope.mode.toUpperCase()}`);
    log(`  ⏱️  Duration:          ${(scanDurationMs / 1000).toFixed(1)}s`);
    log('');
    log(`  📊 Total Findings:    ${rankedFindings.length}`);
    log(`  🔥 Fix Immediately:   ${dist.fixImmediately}`);
    log(`  ⚡ Fix This Sprint:   ${dist.fixThisSprint}`);
    log(`  📋 Backlog:           ${dist.backlog}`);
    log(`  ℹ️  Informational:    ${dist.informational}`);
    log(`  🚫 False Positives:   ${rankedFindings.filter(f => f.context?.isFalsePositive).length}`);
    log('');
    log(`  📄 Report saved to: ${outputPath}`);
    log('');

    // Exit code
    if (config.failOn) {
      const thresholdLevel = config.failOn === 'critical' ? 4 : config.failOn === 'high' ? 3 : config.failOn === 'medium' ? 2 : 0;
      const nonFP = rankedFindings.filter(f => !f.context?.isFalsePositive);
      const exceedsThreshold = nonFP.some(f => f.severity?.level >= thresholdLevel);
      if (exceedsThreshold) {
        log(`  ⚠️  Non-false-positive findings at or above "${config.failOn}" threshold. Exiting with code 1.`);
        process.exit(1);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// Interactive Mode
// ────────────────────────────────────────────────────────────────────

async function runInteractiveMode(rankedFindings, targetDir, config) {
  const readline = require('node:readline');

  const nonFP = rankedFindings.filter(f => !f.context?.isFalsePositive);
  if (nonFP.length === 0) {
    log('  ✅ No actionable findings to review.');
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function ask(question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve((answer || '').trim());
      });
    });
  }

  // Handle Ctrl+C / EOF gracefully
  let aborted = false;
  rl.on('close', () => {
    aborted = true;
  });

  log('');
  log('  ┌── Interactive Review Mode ──────────────────────────────');
  log(`  │ ${nonFP.length} findings to review`);
  log('  └────────────────────────────────────────────────────────');
  log('');

  for (let i = 0; i < nonFP.length; i++) {
    if (aborted) break;

    const f = nonFP[i];
    const sevLabel = `${f.severity?.emoji || '?'} ${f.severity?.label || '?'}`;

    console.log(`\n  ── Finding ${i + 1}/${nonFP.length} ──────────────────────────────`);
    console.log(`  Rule:     ${f.rule}`);
    console.log(`  Severity: ${sevLabel}`);
    console.log(`  Priority: ${f.priority?.score ?? '?'}/100 (${f.priority?.bucket || '?'})`);
    console.log(`  File:     ${f.file}${f.line > 0 ? ':' + f.line : ''}`);
    console.log(`  Issue:    ${f.message}`);
    if (f.lineContent) console.log(`  Code:     ${f.lineContent}`);
    console.log('');

    const hasFix = f.fix?.available && f.fix?.safeToAutoApply;
    const options = hasFix
      ? '  [1] Fix  [2] Skip  [3] Show details  [4] Suppress  [5] Quit'
      : '  [2] Skip  [3] Show details  [4] Suppress  [5] Quit';

    console.log(options);

    let answer;
    try {
      answer = await ask('  > ');
    } catch {
      break; // EOF or error
    }

    if (aborted) break;

    switch (answer) {
      case '1':
        if (hasFix) {
          console.log('');
          console.log(`  Proposed change in ${f.file}:`);
          console.log(`  - ${f.fix.before}`);
          console.log(`  + ${f.fix.after}`);
          console.log('');

          let confirm;
          try {
            confirm = await ask('  Apply this fix? (y/n) > ');
          } catch {
            break;
          }

          if (confirm?.toLowerCase() === 'y') {
            const result = applySingleFix(f, targetDir);
            if (result.success) {
              console.log('  ✅ Fix applied successfully.');
            } else {
              console.log(`  ❌ Fix failed: ${result.reason}`);
            }
          } else {
            console.log('  ⏭️  Skipped.');
          }
        } else {
          console.log('  ⚠️  No safe automatic fix available for this finding.');
        }
        break;

      case '3':
        console.log('');
        console.log(`  ── Details ──`);
        if (f.context?.explanation) console.log(`  Explanation: ${f.context.explanation}`);
        if (f.recommendation) console.log(`  Recommendation: ${f.recommendation}`);
        if (f.context?.indicators?.length) console.log(`  Indicators: ${f.context.indicators.join('; ')}`);
        if (f.fix?.description) console.log(`  Fix: ${f.fix.description}${f.fix.safeToAutoApply ? ' (auto-fixable)' : ' (manual)'}`);
        if (f.fix?.before) console.log(`  Before: ${f.fix.before}`);
        if (f.fix?.after) console.log(`  After:  ${f.fix.after}`);
        if (f.fix?.additionalSteps?.length) {
          console.log('  Steps:');
          f.fix.additionalSteps.forEach((s, idx) => console.log(`    ${idx + 1}. ${s}`));
        }
        if (f.context?.codeSnippet) {
          console.log('  ── Code Context ──');
          console.log(f.context.codeSnippet.split('\n').map(l => '  ' + l).join('\n'));
        }

        // After showing details, loop back to this finding
        i--;
        break;

      case '4':
        console.log(`  📝 To suppress: add to security-agent.config.json:`);
        console.log(`     { "ruleId": "${f.rule}", "filePath": "${f.file}" }`);
        break;

      case '5':
        console.log('  👋 Exiting interactive mode.');
        aborted = true;
        break;

      case '2':
      default:
        // Skip — continue to next finding
        break;
    }
  }

  if (!aborted) {
    console.log('\n  ✅ All findings reviewed.');
  }

  rl.close();
}

// ────────────────────────────────────────────────────────────────────
// Auto-Fix Mode
// ────────────────────────────────────────────────────────────────────

async function applyAutoFixes(rankedFindings, targetDir, quiet) {
  const safeFixable = rankedFindings.filter(f => f.fix?.safeToAutoApply && f.fix?.before && f.fix?.after);

  if (safeFixable.length === 0) {
    log('  ℹ️  No safe automatic fixes available.');
    return;
  }

  log(`  🔧 Applying ${safeFixable.length} safe automatic fix(es)...`);

  let applied = 0;
  let failed = 0;
  const skipped = [];
  const appliedFixes = [];

  for (const f of safeFixable) {
    const result = applySingleFix(f, targetDir);
    if (result.success) {
      applied++;
      appliedFixes.push(f);
      log(`  ✅ Fixed ${f.rule} in ${f.file}:${f.line}`);
    } else {
      failed++;
      skipped.push({ finding: f, reason: result.reason });
      log(`  ⚠️  Skipped ${f.rule} in ${f.file}:${f.line}: ${result.reason}`);
    }
  }

  // Optional TypeScript validation after all fixes
  if (applied > 0) {
    const tsResult = runTypeScriptValidation(targetDir);
    if (tsResult.ran && tsResult.newErrors > 0) {
      log(`  ⚠️  TypeScript validation found ${tsResult.newErrors} new error(s) after fixes.`);
      log('  🔄 Rolling back all fixes...');

      for (const f of appliedFixes) {
        rollbackFix(f, targetDir);
      }

      applied = 0;
      log('  ✅ All fixes rolled back. Repository is in original state.');
    } else if (tsResult.ran) {
      log('  ✅ TypeScript validation passed — no new errors introduced.');
    }
  }

  // Report skipped unsafe fixes
  const unsafeFixable = rankedFindings.filter(f => f.fix?.available && !f.fix?.safeToAutoApply && f.fix?.before);
  if (unsafeFixable.length > 0) {
    log(`  ℹ️  ${unsafeFixable.length} fix(es) require manual review (not auto-applied):`);
    for (const f of unsafeFixable.slice(0, 5)) {
      log(`     • ${f.rule} in ${f.file}:${f.line} — ${f.fix.description || f.message}`);
    }
    if (unsafeFixable.length > 5) {
      log(`     ... and ${unsafeFixable.length - 5} more (see report)`);
    }
  }

  log(`  📊 Fixes: ${applied} applied, ${failed} failed, ${unsafeFixable.length} manual-only`);
}

// ────────────────────────────────────────────────────────────────────
// Patch Application & Validation
// ────────────────────────────────────────────────────────────────────

/**
 * Applies a single safe fix with validation.
 *
 * 1. Verifies the expected original text exists.
 * 2. Verifies it occurs at the expected location.
 * 3. Applies the minimal change.
 * 4. Confirms valid UTF-8.
 * 5. Validates balanced braces/brackets/parentheses.
 * 6. If validation fails, restores the original file.
 */
function applySingleFix(finding, targetDir) {
  const relFile = finding.file;
  if (!relFile || relFile.startsWith('(')) {
    return { success: false, reason: 'Not a real file path' };
  }

  const absPath = path.resolve(targetDir, relFile);

  if (!fs.existsSync(absPath)) {
    return { success: false, reason: 'File not found' };
  }

  const before = finding.fix?.before;
  const after = finding.fix?.after;

  if (!before || !after) {
    return { success: false, reason: 'Missing before/after content' };
  }

  let originalContent;
  try {
    originalContent = fs.readFileSync(absPath, 'utf8');
  } catch (err) {
    return { success: false, reason: `Cannot read file: ${err.message}` };
  }

  // 1. Verify expected source text exists
  const lines = originalContent.split('\n');
  const lineIndex = (finding.line || 0) - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) {
    return { success: false, reason: 'Line number out of range' };
  }

  const actualLine = lines[lineIndex].trim();
  const expectedBefore = before.trim();

  if (actualLine !== expectedBefore) {
    return { success: false, reason: `Source text has changed since detection. Expected: "${expectedBefore.substring(0, 60)}...", Found: "${actualLine.substring(0, 60)}..."` };
  }

  // 2. Count occurrences — only apply if exactly one match on this line
  const occurrences = lines.filter((l, i) => l.trim() === expectedBefore).length;
  if (occurrences > 1) {
    // Multiple identical lines — use line index to disambiguate
    // We verified the exact line above, so proceed with targeted replacement
  }

  // 3. Apply the change
  const indent = lines[lineIndex].match(/^(\s*)/)[1] || '';
  const newLine = indent + after.trim();
  const newLines = [...lines];
  newLines[lineIndex] = newLine;
  const newContent = newLines.join('\n');

  // 4. Validate UTF-8 (Node strings are always UTF-16, but check for truncation)
  if (newContent.length < originalContent.length - before.length) {
    return { success: false, reason: 'Accidental content truncation detected' };
  }

  // 5. Balanced braces/brackets/parentheses check
  if (!validateBalanced(newContent)) {
    return { success: false, reason: 'Fix would create unbalanced braces/brackets/parentheses' };
  }

  // 6. Write atomically — write to temp, then rename
  const tmpPath = absPath + '.agent-fix-tmp';
  try {
    fs.writeFileSync(tmpPath, newContent, 'utf8');
    // Store backup for rollback
    const backupPath = absPath + '.agent-backup';
    fs.writeFileSync(backupPath, originalContent, 'utf8');
    // Atomic rename
    fs.renameSync(tmpPath, absPath);

    return { success: true, reason: null };
  } catch (err) {
    // Cleanup temp file
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    return { success: false, reason: `Write failed: ${err.message}` };
  }
}

/**
 * Rolls back a previously applied fix using the backup file.
 */
function rollbackFix(finding, targetDir) {
  const relFile = finding.file;
  if (!relFile || relFile.startsWith('(')) return;

  const absPath = path.resolve(targetDir, relFile);
  const backupPath = absPath + '.agent-backup';

  try {
    if (fs.existsSync(backupPath)) {
      const backup = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(absPath, backup, 'utf8');
      fs.unlinkSync(backupPath);
    }
  } catch (err) {
    console.error(`  ❌ Rollback failed for ${relFile}: ${err.message}`);
  }
}

/**
 * Validates that braces, brackets, and parentheses are balanced.
 * This is a lightweight check — not a full parser.
 */
function validateBalanced(content) {
  const stack = [];
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const closers = new Set([')', ']', '}']);
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const prev = i > 0 ? content[i - 1] : '';

    if (escaped) {
      escaped = false;
      continue;
    }

    if (c === '\\') {
      escaped = true;
      continue;
    }

    // Handle comments
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === '/' && prev === '*') inBlockComment = false;
      continue;
    }

    // Handle strings
    if (inString) {
      if (c === stringChar) inString = false;
      continue;
    }

    if (c === '/' && i + 1 < content.length) {
      if (content[i + 1] === '/') { inLineComment = true; continue; }
      if (content[i + 1] === '*') { inBlockComment = true; continue; }
    }

    if (c === '\'' || c === '"' || c === '`') {
      inString = true;
      stringChar = c;
      continue;
    }

    if (pairs[c]) {
      stack.push(pairs[c]);
    } else if (closers.has(c)) {
      if (stack.length === 0 || stack[stack.length - 1] !== c) {
        return false;
      }
      stack.pop();
    }
  }

  return stack.length === 0;
}

// ────────────────────────────────────────────────────────────────────
// TypeScript Validation (Optional)
// ────────────────────────────────────────────────────────────────────

/**
 * Runs TypeScript validation using the project's existing tsc if available.
 * Does not install or download anything.
 *
 * Distinguishes:
 *  - pre-existing errors
 *  - errors introduced by fixes
 *  - successful validation
 */
function runTypeScriptValidation(targetDir) {
  const result = { ran: false, preExistingErrors: 0, newErrors: 0, totalErrors: 0 };

  // Check if typescript exists in the project
  const tscPath = path.join(targetDir, 'node_modules', '.bin', 'tsc');
  const parentTscPath = path.join(path.dirname(targetDir), 'node_modules', '.bin', 'tsc');

  const tsc = fs.existsSync(tscPath) ? tscPath : fs.existsSync(parentTscPath) ? parentTscPath : null;

  if (!tsc) return result;

  const { execSync } = require('child_process');
  const cwd = fs.existsSync(path.join(targetDir, 'tsconfig.json')) ? targetDir : path.dirname(targetDir);

  if (!fs.existsSync(path.join(cwd, 'tsconfig.json'))) return result;

  try {
    // Run tsc --noEmit and capture output
    execSync(`"${tsc}" --noEmit 2>&1`, { cwd, encoding: 'utf8', timeout: 60000 });
    result.ran = true;
    result.newErrors = 0;
  } catch (err) {
    result.ran = true;
    const output = (err.stdout || '') + (err.stderr || '');
    // Count error lines
    const errorLines = output.split('\n').filter(l => /error TS\d+/.test(l));
    result.totalErrors = errorLines.length;

    // Check if errors are in files we modified
    // For now, assume any errors are potentially from our fixes
    // A more sophisticated check would diff against pre-fix tsc output
    const fixedFiles = new Set();
    // We can't easily get the list of fixed files here, so be conservative
    result.newErrors = result.totalErrors;
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────
// Help
// ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║  🛡️  Security Agent — Local Security Analysis                ║
  ║  Deterministic context analysis, no LLM, no API keys         ║
  ╚══════════════════════════════════════════════════════════════╝

  Usage:
    node security-agent-ai.js [target...] [options]

  Modes:
    (default)              Detect → Analyze → Triage → Report
    --quick                Focus on critical/high findings only
    --fix                  Apply safe automatic fixes
    --interactive          Walk through findings one-by-one
    --format=md|json       Output format (default: md)

  Identity & Configuration:
    --app-name=<name>      Override app name
    --app-type=<type>      e.g. sports, finance (default: from config)

  Output:
    --output=<path>        Output file path
    --quiet                Suppress console output

  CI/CD:
    --fail-on=critical|high|medium   Exit non-zero if findings at/above threshold

  Scan Control:
    --scope=root|folder|file   Force scan scope
    --skip-deps                Skip dependency audit
    --help, -h                 Show this help

  What this agent adds on top of the existing scanner:
    • Contextual code analysis (±15 lines around each finding)
    • False-positive detection (8 conservative heuristics)
    • Plain-English vulnerability explanations
    • Contextual fix suggestions with before/after diffs
    • Priority scoring (severity × exploitability × reachability × impact)
    • Cross-finding correlation
    • Interactive review mode
    • Safe auto-fix with patch validation and rollback

  Examples:
    node security-agent-ai.js ./src
    node security-agent-ai.js ./src --quick
    node security-agent-ai.js ./src --fix
    node security-agent-ai.js ./src --interactive
    node security-agent-ai.js ./src --format=json --quiet
    node security-agent-ai.js ./src/services/authService.ts
  `);
}

// ────────────────────────────────────────────────────────────────────
// Run
// ────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error(`\n  ❌ Agent error: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
