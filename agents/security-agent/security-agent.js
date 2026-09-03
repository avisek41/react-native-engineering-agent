#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Universal App Security Scanner v3 — Static Security Analyzer    ║
 * ║  Usage:  node security-agent.js [target...] [options]            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * THREE SCAN MODES (auto-detected from target path, no flag needed):
 *
 *   ROOT    → node security-agent.js .          (or ./src, or project root)
 *             Runs every per-file rule pack PLUS all project-wide
 *             "should exist somewhere" checks (cert pinning, code
 *             obfuscation, root/jailbreak detection, biometrics,
 *             screenshot protection, token-expiry handling) PLUS
 *             dependency audit.
 *
 *   FOLDER  → node security-agent.js ./src/navigation
 *             Runs every per-file rule pack PLUS a folder-specific
 *             rule pack matched to that folder's purpose (navigation
 *             gets deep-link/auth-guard checks, services gets
 *             token-refresh/retry checks, components gets WebView
 *             checks, etc). Project-wide platform checks (root
 *             detection, obfuscation, biometrics) are correctly
 *             OMITTED here — they don't belong to a single folder.
 *
 *   FILE    → node security-agent.js ./src/services/authService.ts
 *             Runs only per-file rules. No inverse/project-wide
 *             checks at all (nothing to be "missing" from one file).
 *
 * Override auto-detection with --scope=root|folder|file if needed.
 */

const fs = require('fs');
const path = require('path');

const { loadConfig } = require('./lib/config');
const { detectScanScope, buildMergedDomains } = require('./lib/scope');
const { walkDir, scanFile, resolveFileDomain, runInverseChecks, makeFindingFactory, applySuppressions } = require('./lib/scanner');
const { checkDependencies } = require('./lib/deps');
const { FOLDER_DOMAINS, LOW_RISK_DOMAINS } = require('./lib/constants');
const {
  filterBySeverity, generateStats, getScoreGrade,
  generateHTMLReport, generateMarkdownReport, generateJSONReport, generateSARIFReport,
} = require('./lib/report');

// ────────────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    flags[key] = val ?? true;
  } else if (arg === '-h' || arg === '--help') {
    flags.help = true;
  } else {
    positional.push(arg);
  }
}

if (flags.help) {
  console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║     🛡️  Universal App Security Scanner v3.0                  ║
  ║     Static Security Analysis for JS/TS & React Native        ║
  ╚══════════════════════════════════════════════════════════════╝

  Usage:
    node security-agent.js [target...] [options]

  Scan Modes (auto-detected, override with --scope):
    root    Full project / ./src — all rules + platform-wide checks
    folder  A feature folder (services, navigation, screens, ...) —
            all rules + that folder's domain-specific checks only
    file    A single file — per-file rules only, no inverse checks

  Identity & Configuration:
    --app-name=<name>        Override resolved app name
    --app-type=<type>        e.g. sports, finance (default: from config or 'general')
    Config file: place security-agent.config.json in your project root.

  Output Options:
    --format=html|md|json|sarif  Output format (default: html)
    --output=<path>              Output file path
    --severity=all|high|critical Minimum severity to report

  CI/CD Options:
    --fail-on=critical|high|medium   Exit non-zero if findings at/above threshold
    --baseline=<path>                Path to previous JSON report; only fail on NEW findings
    --quiet                          Suppress console output (machine-readable only)

  History & Trend:
    --history-dir=<path>     Append run stats to a JSONL file for trend tracking

  Scan Control:
    --scope=root|folder|file Force a scan scope instead of auto-detect
    --skip-deps              Skip dependency vulnerability check
    --no-open                Don't auto-open HTML report
    --help, -h               Show this help

  Multi-Target:
    Pass multiple directories to scan each independently:
    node security-agent.js ./app-a ./app-b --format=json

  Examples:
    node security-agent.js ./src
    node security-agent.js ./src/navigation
    node security-agent.js ./src/services/authService.ts
    node security-agent.js ./src/store --format=md
    node security-agent.js ./src --format=sarif --fail-on=high --quiet
    node security-agent.js ./src --baseline=previous-report.json
    node security-agent.js ./app-a ./app-b --format=json
  `);
  process.exit(0);
}

// ────────────────────────────────────────────────────────────────────
// Resolve targets — support multiple positional args
// ────────────────────────────────────────────────────────────────────
const rawTargets = positional.length > 0 ? positional : ['.'];
const targets = rawTargets.map(t => path.resolve(t));

// Validate all targets exist
for (const t of targets) {
  if (!fs.existsSync(t)) {
    console.error(`❌ Target not found: ${t}`);
    process.exit(1);
  }
}

// ────────────────────────────────────────────────────────────────────
// Load & merge configuration
// ────────────────────────────────────────────────────────────────────
const config = loadConfig(targets, flags);

// Build merged domain map (built-in + custom from config)
const mergedDomains = buildMergedDomains(config.customDomainRules);

// Logger helper: respects --quiet
function log(...args) {
  if (!config.quiet) console.log(...args);
}

// ────────────────────────────────────────────────────────────────────
// Load baseline for diffing (if --baseline is set)
// ────────────────────────────────────────────────────────────────────
let baselineFindings = null;
if (config.baselinePath) {
  try {
    const baselineRaw = fs.readFileSync(path.resolve(config.baselinePath), 'utf8');
    const baselineData = JSON.parse(baselineRaw);
    // Build a Set of finding keys from baseline for fast lookup
    if (baselineData.findings && Array.isArray(baselineData.findings)) {
      baselineFindings = new Set(
        baselineData.findings.map(f => `${f.rule}::${f.file}::${f.line}`)
      );
    }
  } catch (e) {
    if (!config.quiet) console.warn(`  ⚠️  Could not load baseline file: ${e.message}. Proceeding without baseline.`);
  }
}

// ────────────────────────────────────────────────────────────────────
// Load history data for trend chart (if --history-dir is set)
// ────────────────────────────────────────────────────────────────────
let historyData = null;
if (config.historyDir) {
  const historyFile = path.join(path.resolve(config.historyDir), 'scan-history.jsonl');
  if (fs.existsSync(historyFile)) {
    try {
      const lines = fs.readFileSync(historyFile, 'utf8').trim().split('\n').filter(Boolean);
      historyData = lines.map(l => JSON.parse(l));
    } catch {
      // corrupted history — ignore
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// Run scan for each target
// ────────────────────────────────────────────────────────────────────
let overallExitCode = 0;

for (let ti = 0; ti < targets.length; ti++) {
  const targetDir = targets[ti];
  const rawArg = rawTargets[ti];

  // Resolve per-target scope
  let scope = detectScanScope(targetDir, rawArg, mergedDomains);
  if (config.scopeOverride && ['root', 'folder', 'file'].includes(config.scopeOverride)) {
    scope = { ...scope, mode: config.scopeOverride };
  }

  // ── Banner ──
  if (targets.length > 1) {
    log('');
    log(`  ┌── Target ${ti + 1}/${targets.length}: ${targetDir}`);
    log(`  │`);
  } else {
    log('');
    log('  ╔══════════════════════════════════════════════════════════╗');
    log(`  ║       🛡️  ${config.appName}`);
    log('  ║       Universal App Security Scanner v3.0                ║');
    log('  ╚══════════════════════════════════════════════════════════╝');
    log('');
  }

  log(`  📁 Target:     ${targetDir}`);
  log(`  🎯 Scan Mode:  ${scope.mode.toUpperCase()}${scope.mode === 'folder' ? ` (domain: ${scope.domain})` : ''}`);
  log(`  📝 Format:     ${config.defaultFormat.toUpperCase()}`);
  log(`  🎯 Min Sev:    ${config.defaultSeverity}`);
  log('');

  const findings = [];
  const addFinding = makeFindingFactory(targetDir, config.complianceFrameworks);

  // 1. Discover files
  log('  ⏳ Scanning files...');
  const files = scope.mode === 'file' ? [targetDir] : walkDir(targetDir, [], config.excludePaths);
  log(`  ✅ Found ${files.length} source file(s)`);

  // 2. Scan each file with CORE rules + appropriate domain pack
  log('  ⏳ Analyzing security patterns...');

  // Track per-domain concatenated content for ROOT mode's domain-scoped
  // inverse checks (e.g. navigation's auth-guard check should only see
  // navigation files, not the whole codebase diluted together).
  const domainContentMap = {};

  for (const file of files) {
    let fileDomain = null;

    if (scope.mode === 'root') {
      fileDomain = resolveFileDomain(file, targetDir, mergedDomains);
    } else if (scope.mode === 'folder') {
      fileDomain = scope.domain;
    } else if (scope.mode === 'file') {
      fileDomain = scope.domain; // inferred from parent dir, used for labeling/rules
    }

    scanFile(file, targetDir, findings, addFinding, fileDomain, config.customDomainRules);

    // Build domain content map (skip in file mode — no inverse checks anyway)
    if (scope.mode !== 'file' && fileDomain && ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(file))) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        domainContentMap[fileDomain] = (domainContentMap[fileDomain] || '') + '\n' + content;
      } catch {
        // unreadable file — skip
      }
    }
  }

  // 3. Scope-appropriate inverse checks
  log('  ⏳ Running scope-appropriate inverse checks...');
  const allContent = files
    .filter(f => ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(f)))
    .map(f => {
      try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
    })
    .join('\n');

  runInverseChecks({
    scope, findings, addFinding, appType: config.appType,
    allContent, domainContentMap, customDomainRules: config.customDomainRules,
  });

  // 4. Dependency check (root mode only by default)
  if (!config.skipDeps && scope.mode === 'root') {
    log('  ⏳ Checking dependencies...');
    checkDependencies(targetDir, findings, addFinding, config.quiet);
  } else if (!config.skipDeps && scope.mode !== 'root') {
    log('  ℹ️  Skipping dependency audit (only runs at root scope; use --scope=root or scan the project root for this).');
  }

  // 5. Apply suppressions
  let processedFindings = applySuppressions(findings, config.suppressions);

  // 6. Filter by severity
  const filteredFindings = filterBySeverity(processedFindings, config.defaultSeverity);
  const stats = generateStats(filteredFindings);
  const scoreInfo = getScoreGrade(stats.score);

  // 7. Generate Report
  const outputFormat = config.defaultFormat;
  let reportContent;
  let ext;
  switch (outputFormat) {
    case 'md':
      reportContent = generateMarkdownReport(filteredFindings, scope, config.appType, config.appName);
      ext = 'md';
      break;
    case 'json':
      reportContent = generateJSONReport(filteredFindings, scope, config.appType, config.appName);
      ext = 'json';
      break;
    case 'sarif':
      reportContent = generateSARIFReport(filteredFindings, scope, config.appType, config.appName);
      ext = 'sarif';
      break;
    default:
      reportContent = generateHTMLReport(filteredFindings, scope, config.appType, config.appName, historyData);
      ext = 'html';
  }

  // Determine output path
  const scopeSuffix = scope.mode === 'folder' ? `-${scope.domain}` : scope.mode === 'file' ? `-file` : '';
  const nameSuffix = targets.length > 1 ? `-${path.basename(targetDir)}` : '';
  const reportDir = config.outputPath ? path.dirname(config.outputPath) : path.join(process.cwd(), 'security-agent-report');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const outputPath = config.outputPath || path.join(reportDir, `security-report${nameSuffix}${scopeSuffix}.${ext}`);
  fs.writeFileSync(outputPath, reportContent, 'utf8');

  // 8. Append to history (if --history-dir is set)
  if (config.historyDir) {
    const histDir = path.resolve(config.historyDir);
    if (!fs.existsSync(histDir)) fs.mkdirSync(histDir, { recursive: true });
    const historyFile = path.join(histDir, 'scan-history.jsonl');
    const historyEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      appName: config.appName,
      score: stats.score,
      critical: stats.critical,
      high: stats.high,
      medium: stats.medium,
      low: stats.low,
      info: stats.info,
      total: stats.total,
    });
    fs.appendFileSync(historyFile, historyEntry + '\n', 'utf8');
  }

  // 9. Auto-open HTML report in browser
  if (ext === 'html' && !config.noOpen && targets.length === 1) {
    const { execSync } = require('child_process');
    const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
      execSync(`${openCmd} "${outputPath}"`, { stdio: 'ignore' });
      log('');
      log('  🌐 Opening report in browser...');
    } catch {
      // Silently fail if browser can't open (e.g., headless CI)
    }
  }

  // 10. Console Summary
  log('');
  log('  ╔══════════════════════════════════════════════════════════╗');
  log('  ║                    SCAN COMPLETE                        ║');
  log('  ╚══════════════════════════════════════════════════════════╝');
  log('');
  log(`  🏷️  App:           ${config.appName}`);
  log(`  🎯 Mode:           ${scope.mode.toUpperCase()}${scope.mode === 'folder' ? ` (${scope.domain})` : ''}`);
  log(`  🏆 Security Score: ${stats.score}/100 (${scoreInfo.grade} - ${scoreInfo.label})`);
  log('');
  log(`  🔴 Critical: ${stats.critical}`);
  log(`  🟠 High:     ${stats.high}`);
  log(`  🟡 Medium:   ${stats.medium}`);
  log(`  🔵 Low:      ${stats.low}`);
  log(`  ⚪ Info:     ${stats.info}`);
  log(`  ────────────────────`);
  log(`  📊 Total:    ${stats.total}`);
  log('');
  log(`  📄 Report saved to: ${outputPath}`);
  log('');

  // 11. Determine exit code based on --fail-on threshold
  const failThreshold = config.failOn;
  if (failThreshold) {
    // Determine which findings to check (all, or only new if baseline)
    let checkFindings = filteredFindings;
    if (baselineFindings) {
      checkFindings = filteredFindings.filter(f => {
        const key = `${f.rule}::${f.file}::${f.line}`;
        return !baselineFindings.has(key);
      });
      if (checkFindings.length > 0) {
        log(`  🆕 ${checkFindings.length} new finding(s) vs baseline.`);
      } else {
        log('  ✅ No new findings vs baseline.');
      }
    }

    const thresholdLevel = failThreshold === 'critical' ? 4 : failThreshold === 'high' ? 3 : failThreshold === 'medium' ? 2 : 0;
    const exceedsThreshold = checkFindings.some(f => f.severity.level >= thresholdLevel);

    if (exceedsThreshold) {
      log(`  ⚠️  Findings at or above "${failThreshold}" threshold detected. Exiting with code 1.`);
      overallExitCode = 1;
    }
  } else {
    // Legacy behavior: exit 1 on critical
    if (stats.critical > 0) {
      log('  ⚠️  Critical issues detected. Please review the report immediately.');
      overallExitCode = 1;
    }
  }

  // Multi-target separator
  if (targets.length > 1 && ti < targets.length - 1) {
    log('  └──────────────────────────────────────────────────────');
  }
}

process.exit(overallExitCode);
