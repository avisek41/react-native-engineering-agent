const fs = require('fs');
const path = require('path');
const { RULES, SEVERITY } = require('./constants');

/**
 * Recursively collect files matching extensions
 */
function collectFiles(dirPath, extensions = ['.tsx', '.ts'], excludePatterns = []) {
  let results = [];
  if (!fs.existsSync(dirPath)) return results;

  const stat = fs.statSync(dirPath);
  if (stat.isFile()) {
    if (extensions.some(ext => dirPath.endsWith(ext))) {
      results.push(dirPath);
    }
    return results;
  }

  const list = fs.readdirSync(dirPath);
  for (const file of list) {
    if (file === 'node_modules' || file.startsWith('.')) continue;
    const fullPath = path.join(dirPath, file);
    const itemStat = fs.statSync(fullPath);

    if (itemStat.isDirectory()) {
      results = results.concat(collectFiles(fullPath, extensions, excludePatterns));
    } else if (extensions.some(ext => file.endsWith(ext))) {
      // Check excludes
      const isExcluded = excludePatterns.some(pat => fullPath.includes(pat));
      if (!isExcluded) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Scan a single file against the rule definitions
 */
function validateFile(filePath, rules = RULES) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings = [];

  for (const rule of rules) {
    if (!rule.fileTypes.some(ext => filePath.endsWith(ext))) continue;

    // Ignore test files or theme definitions for hex rule
    if (rule.id === 'UI-HEX-001' && (filePath.includes('theme/color.ts') || filePath.includes('.test.'))) {
      continue;
    }

    lines.forEach((line, index) => {
      // Skip commented lines
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        return;
      }

      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(line)) !== null) {
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          description: rule.description,
          file: filePath,
          line: index + 1,
          snippet: line.trim(),
          match: match[0],
        });
      }
    });
  }

  return findings;
}

/**
 * Scan target directory or file
 */
function validateTarget(targetPath, options = {}) {
  const target = path.resolve(targetPath);
  const files = collectFiles(target);
  const allFindings = [];

  for (const file of files) {
    const findings = validateFile(file);
    if (findings.length > 0) {
      allFindings.push(...findings);
    }
  }

  const summary = {
    totalFilesScanned: files.length,
    totalFindings: allFindings.length,
    errors: allFindings.filter(f => f.severity === SEVERITY.ERROR).length,
    warnings: allFindings.filter(f => f.severity === SEVERITY.WARN).length,
    infos: allFindings.filter(f => f.severity === SEVERITY.INFO).length,
    findings: allFindings,
  };

  return summary;
}

module.exports = {
  validateFile,
  validateTarget,
  collectFiles,
};
