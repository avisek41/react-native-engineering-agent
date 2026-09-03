'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_FILENAME = 'security-agent.config.json';

/**
 * Loads and merges configuration from multiple sources.
 * Priority (highest wins): CLI flags > config file > defaults.
 *
 * @param {string[]} targets - Resolved target directory paths
 * @param {object}   flags   - Parsed CLI flag map
 * @returns {object} resolvedConfig
 */
function loadConfig(targets, flags) {
  const primaryTarget = targets[0] || process.cwd();

  // ── 1. Locate config file ──────────────────────────────────────────
  const configFile = findConfigFile(primaryTarget);
  const fileConfig = configFile ? parseConfigFile(configFile) : {};

  // ── 2. Resolve app identity ────────────────────────────────────────
  const appName = resolveAppName(primaryTarget, flags, fileConfig);
  const appType = resolveAppType(flags, fileConfig);

  // ── 3. Merge everything ────────────────────────────────────────────
  const config = {
    // Identity
    appName,
    appType,

    // Output defaults
    defaultFormat:  flags.format      || fileConfig.defaultFormat   || 'html',
    defaultSeverity: flags.severity   || fileConfig.defaultSeverity || 'all',

    // Paths
    targets,
    excludePaths:   fileConfig.excludePaths || [],

    // Domain extensions
    customDomainRules: fileConfig.customDomainRules || {},

    // Suppressions (known accepted risks)
    suppressions:   fileConfig.suppressions || [],

    // Compliance
    complianceFrameworks: fileConfig.complianceFrameworks || [],

    // CI/CD
    failOn:         flags['fail-on']   || fileConfig.failOn   || null,
    baselinePath:   flags.baseline     || null,
    quiet:          flags.quiet === true,
    skipDeps:       flags['skip-deps'] === true,
    noOpen:         flags['no-open'] === true,

    // History
    historyDir:     flags['history-dir'] || fileConfig.historyDir || null,

    // Scope override
    scopeOverride:  flags.scope || null,

    // Output path override
    outputPath:     flags.output || null,
  };

  return config;
}

// ────────────────────────────────────────────────────────────────────────
// Config file discovery
// ────────────────────────────────────────────────────────────────────────

/**
 * Walks upward from targetDir looking for security-agent.config.json.
 * Checks: targetDir itself, its parent (for when targeting ./src), and cwd.
 */
function findConfigFile(targetDir) {
  const candidates = [
    path.join(targetDir, CONFIG_FILENAME),
    path.join(path.dirname(targetDir), CONFIG_FILENAME),
    path.join(process.cwd(), CONFIG_FILENAME),
  ];

  // Deduplicate (resolve to absolute) and return first that exists
  const seen = new Set();
  for (const candidate of candidates) {
    const abs = path.resolve(candidate);
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function parseConfigFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    // Warn on unknown keys (non-fatal)
    const KNOWN_KEYS = new Set([
      'appName', 'appType', 'defaultFormat', 'defaultSeverity',
      'excludePaths', 'customDomainRules', 'suppressions',
      'complianceFrameworks', 'failOn', 'historyDir',
    ]);
    for (const key of Object.keys(parsed)) {
      if (!KNOWN_KEYS.has(key)) {
        console.warn(`  ⚠️  Unknown config key "${key}" in ${path.basename(filePath)} — ignored.`);
      }
    }

    return parsed;
  } catch (e) {
    console.warn(`  ⚠️  Could not parse config file ${filePath}: ${e.message}`);
    return {};
  }
}

// ────────────────────────────────────────────────────────────────────────
// App identity resolution
// ────────────────────────────────────────────────────────────────────────

/**
 * Resolves app name with priority:
 *   1. --app-name CLI flag
 *   2. config file appName
 *   3. target project's package.json "name"
 *   4. path.basename(targetDir)
 */
function resolveAppName(targetDir, flags, fileConfig) {
  if (flags['app-name']) return flags['app-name'];
  if (fileConfig.appName) return fileConfig.appName;

  // Try package.json in targetDir or its parent
  const pkgName = readPackageJsonName(targetDir);
  if (pkgName) return pkgName;

  return path.basename(path.resolve(targetDir));
}

function resolveAppType(flags, fileConfig) {
  if (flags['app-type']) return flags['app-type'].toLowerCase();
  if (fileConfig.appType) return fileConfig.appType.toLowerCase();
  return 'general';
}

/**
 * Reads the "name" field from the nearest package.json.
 */
function readPackageJsonName(targetDir) {
  const candidates = [
    path.join(targetDir, 'package.json'),
    path.join(path.dirname(targetDir), 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];

  // Deduplicate and return first that exists
  const seen = new Set();
  for (const p of candidates) {
    const abs = path.resolve(p);
    if (seen.has(abs)) continue;
    seen.add(abs);
    try {
      if (fs.existsSync(abs)) {
        const pkg = JSON.parse(fs.readFileSync(abs, 'utf8'));
        if (pkg.name && typeof pkg.name === 'string') return pkg.name;
      }
    } catch {
      // skip
    }
  }
  return null;
}

module.exports = { loadConfig, findConfigFile };
