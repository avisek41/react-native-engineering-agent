'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SOURCE_EXTENSIONS, IGNORE_DIRS, LOW_RISK_DOMAINS, resolveComplianceRefs } = require('./constants');
const { CORE_RULES, FILENAME_RULES } = require('./rules-core');
const { getDomainPack } = require('./rules-domain');
const { getPlatformInverseChecks } = require('./rules-platform');

function walkDir(dir, fileList = [], excludePatterns = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) walkDir(fullPath, fileList, excludePatterns);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (SOURCE_EXTENSIONS.includes(ext) || entry.name.startsWith('.env')) {
        // Check exclude patterns
        if (!isExcluded(fullPath, excludePatterns)) {
          fileList.push(fullPath);
        }
      }
    }
  }
  return fileList;
}

/**
 * Simple glob-like exclude check. Supports:
 *  - "**\/*.test.ts" → matches any file ending in .test.ts
 *  - "**\/__mocks__/**" → matches any path containing __mocks__
 *  - "src/legacy/**" → matches paths starting with src/legacy/
 */
function isExcluded(filePath, patterns) {
  if (!patterns || patterns.length === 0) return false;
  const normalized = filePath.replace(/\\/g, '/');
  for (const pattern of patterns) {
    const p = pattern.replace(/\\/g, '/');
    if (p.startsWith('**/') && p.endsWith('/**')) {
      // directory match: **/dirname/**
      const dirName = p.slice(3, -3);
      if (normalized.includes(`/${dirName}/`)) return true;
    } else if (p.startsWith('**/')) {
      // suffix match: **/*.test.ts
      const suffix = p.slice(3);
      if (normalized.endsWith(suffix)) return true;
    } else if (p.endsWith('/**')) {
      // prefix match: src/legacy/**
      const prefix = p.slice(0, -3);
      if (normalized.includes(prefix)) return true;
    } else {
      // exact match
      if (normalized.includes(p)) return true;
    }
  }
  return false;
}

/**
 * Generates a deterministic finding ID from rule + file + line.
 * Used for baseline diffing and suppression matching.
 */
function generateFindingId(ruleId, relativeFile, line) {
  const key = `${ruleId}::${relativeFile}::${line}`;
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 12);
}

function makeFindingFactory(targetDir, complianceFrameworks) {
  const frameworks = complianceFrameworks || [];
  return function addFinding(findings, file, line, lineContent, rule, message, severity, category, recommendation) {
    const relFile = typeof file === 'string' && file.startsWith(targetDir) ? path.relative(targetDir, file) : file;
    findings.push({
      id: generateFindingId(rule, relFile, line),
      file: relFile,
      line,
      lineContent: (lineContent || '').toString().trim().substring(0, 200),
      rule,
      message,
      severity,
      category,
      recommendation,
      complianceRefs: resolveComplianceRefs(rule, frameworks),
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Runs CORE_RULES + (if domain provided) DOMAIN rules against a single file.
 * This function is scope-agnostic on purpose: root mode calls it once per
 * file across the whole tree (each file resolves its own domain from its
 * parent folder), folder mode calls it once per file within that folder
 * using the single resolved domain, file mode calls it once.
 *
 * @param {object} [customDomainRules] - Optional custom domain rules from config
 */
function scanFile(filePath, targetDir, findings, addFinding, domain, customDomainRules) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const isSourceFile = ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
  const isEnvFile = fileName.startsWith('.env');
  const isJsonFile = ext === '.json';

  // File-name-level checks (e.g. committed .env file)
  for (const rule of FILENAME_RULES) {
    const fileNameRegex = new RegExp(rule.pattern.source);
    if (fileNameRegex.test(fileName)) {
      addFinding(findings, filePath, 0, fileName, rule.id, rule.name, rule.severity, rule.category, rule.recommendation);
    }
  }

  if (isEnvFile) {
    scanEnvFile(filePath, lines, findings, addFinding);
    return;
  }

  if (!isSourceFile && !isJsonFile) return;

  const domainPack = domain ? getDomainPack(domain) : { rules: [] };

  // Merge custom domain rules if present
  let customRules = [];
  if (customDomainRules && domain && customDomainRules[domain]) {
    customRules = customDomainRules[domain].rules || [];
  }

  const allRules = [...CORE_RULES, ...domainPack.rules, ...customRules];

  for (const rule of allRules) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) continue;
      if (rule.category && rule.category.includes('Secrets') && /^\s*import\s/.test(line)) continue;

      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      if (regex.test(line)) {
        if (rule.exclude && rule.exclude.test(line)) continue;
        if (rule.contextExclude && rule.contextExclude.test(content)) continue;
        addFinding(findings, filePath, i + 1, line, rule.id, rule.name, rule.severity, rule.category, rule.recommendation);
      }
    }
  }
}

function scanEnvFile(filePath, lines, findings, addFinding) {
  const { SEVERITY, CATEGORIES } = require('./constants');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const [key, ...valParts] = line.split('=');
    const value = valParts.join('=');
    if (!value || value === '""' || value === "''") continue;
    const sensitiveKeys = /(?:SECRET|KEY|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|AUTH)/i;
    if (sensitiveKeys.test(key)) {
      addFinding(findings, filePath, i + 1, `${key}=***REDACTED***`, 'ENV-001',
        'Sensitive Value in .env File', SEVERITY.HIGH, CATEGORIES.SECRETS,
        'Ensure .env files are in .gitignore. Use CI/CD secret management for production values.');
    }
  }
}

/**
 * Resolves the domain for a given file path relative to the scan target,
 * used in ROOT mode where we walk many folders and need to know, per
 * file, which domain pack (if any) to layer on top of CORE_RULES.
 */
function resolveFileDomain(filePath, targetDir, folderDomains) {
  const rel = path.relative(targetDir, filePath);
  const parts = rel.split(path.sep);
  for (const part of parts) {
    const key = part.toLowerCase();
    if (folderDomains[key]) return folderDomains[key];
  }
  return null;
}

/**
 * Runs the scope-appropriate inverse checks.
 *  - root:   platform-wide checks (cert pinning, obfuscation, root detect,
 *            biometrics, screenshot protection, token expiry) against the
 *            ENTIRE codebase, PLUS each domain's own inverse checks
 *            against the content of files belonging to that domain.
 *  - folder: ONLY that domain's own inverse checks, run against the
 *            concatenated content of files within that single folder.
 *            Platform-wide checks are skipped entirely — this is the
 *            fix for the false-positive problem.
 *  - file:   no inverse checks at all.
 *
 * @param {object} [customDomainRules] - Optional custom domain rules from config
 */
function runInverseChecks({ scope, findings, addFinding, appType, allContent, domainContentMap, customDomainRules }) {
  if (scope.mode === 'file') return;

  if (scope.mode === 'root') {
    const platformChecks = getPlatformInverseChecks(appType);
    for (const check of platformChecks) {
      if (check.test(allContent)) {
        addFinding(findings, '(Project-wide)', 0, '', check.id, check.name, check.severity, check.category, check.recommendation);
      }
    }
    for (const [domainName, content] of Object.entries(domainContentMap)) {
      if (LOW_RISK_DOMAINS.has(domainName) || !content) continue;
      const pack = getDomainPack(domainName);

      // Merge custom inverse checks if present
      let customInverse = [];
      if (customDomainRules && customDomainRules[domainName]) {
        customInverse = customDomainRules[domainName].inverseChecks || [];
      }

      const allInverse = [...(pack.inverseChecks || []), ...customInverse];
      for (const check of allInverse) {
        if (check.test(content)) {
          addFinding(findings, `(${domainName}/ — project-wide)`, 0, '', check.id, check.name, check.severity, check.category, check.recommendation);
        }
      }
    }
    return;
  }

  if (scope.mode === 'folder') {
    if (LOW_RISK_DOMAINS.has(scope.domain)) return;
    const pack = getDomainPack(scope.domain);

    let customInverse = [];
    if (customDomainRules && customDomainRules[scope.domain]) {
      customInverse = customDomainRules[scope.domain].inverseChecks || [];
    }

    const allInverse = [...(pack.inverseChecks || []), ...customInverse];
    for (const check of allInverse) {
      if (check.test(allContent)) {
        addFinding(findings, `(${scope.path}/ — folder-wide)`, 0, '', check.id, check.name, check.severity, check.category, check.recommendation);
      }
    }
  }
}

/**
 * Applies suppression rules to filter out known accepted risks.
 * A suppression matches when both ruleId and filePath match.
 */
function applySuppressions(findings, suppressions) {
  if (!suppressions || suppressions.length === 0) return findings;

  return findings.filter(f => {
    for (const s of suppressions) {
      if (f.rule === s.ruleId && f.file.includes(s.filePath)) {
        return false; // suppressed
      }
    }
    return true;
  });
}

module.exports = {
  walkDir,
  scanFile,
  resolveFileDomain,
  runInverseChecks,
  makeFindingFactory,
  applySuppressions,
  generateFindingId,
};
