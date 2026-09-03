const fs = require('fs');
const path = require('path');
const { RULE_IDS, SEVERITIES } = require('./constants');

/**
 * Static AST / Code analysis validator for API, types, and hooks layers
 */
class ApiValidator {
  constructor(config = {}) {
    this.config = config;
    this.findings = [];
  }

  /**
   * Scan a target path (file or directory)
   */
  scan(targetPath) {
    const resolvedPath = path.resolve(process.cwd(), targetPath);

    if (!fs.existsSync(resolvedPath)) {
      this.findings.push({
        ruleId: 'SYS-001',
        severity: SEVERITIES.ERROR,
        message: `Target path does not exist: ${targetPath}`,
        filePath: targetPath,
        line: 1,
      });
      return this.findings;
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      this.scanDirectory(resolvedPath);
    } else {
      this.scanFile(resolvedPath);
    }

    return this.findings;
  }

  scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '__mocks__' && file !== 'coverage') {
          this.scanDirectory(fullPath);
        }
      } else if (/\.(ts|tsx)$/.test(file) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')) {
        this.scanFile(fullPath);
      }
    }
  }

  scanFile(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Rule 1: Pure Types (API-001) - Types files in src/types must not import runtime values
    if (
      relativePath.includes('src/types/') &&
      !relativePath.endsWith('.d.ts') &&
      !relativePath.endsWith('index.ts') &&
      !relativePath.endsWith('navigation.types.ts')
    ) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Allow pure type imports (e.g. `import type { ... } from './...'`)
        if (/^\s*import\s+(?!type\s+)/.test(line) && !line.includes('from \'./') && !line.includes('from "./')) {
          this.findings.push({
            ruleId: RULE_IDS.PURE_TYPES,
            severity: SEVERITIES.ERROR,
            message: 'Pure types file must not import runtime values. Use `import type` for sibling type imports.',
            filePath: relativePath,
            line: i + 1,
          });
        }
      }
    }

    // Rule 2: Forbid direct axios / raw fetch in API files (API-004)
    if (relativePath.includes('src/api/') && !relativePath.endsWith('apiClient.ts')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/import\s+axios\b/.test(line) || /\baxios\.(get|post|put|delete|patch)\b/.test(line)) {
          this.findings.push({
            ruleId: RULE_IDS.FORBID_AXIOS,
            severity: SEVERITIES.ERROR,
            message: 'Direct axios usage forbidden. Use apiRequest from api/apiClient.',
            filePath: relativePath,
            line: i + 1,
          });
        }
        if (/\bfetch\s*\(/.test(line)) {
          this.findings.push({
            ruleId: RULE_IDS.FORBID_AXIOS,
            severity: SEVERITIES.ERROR,
            message: 'Direct fetch() usage forbidden. Use apiRequest from api/apiClient.',
            filePath: relativePath,
            line: i + 1,
          });
        }
      }
    }

    // Rule 3: Infinite Query Select (API-006)
    if (relativePath.includes('src/hooks/queries/') && relativePath.includes('InfiniteQuery')) {
      if (!content.includes('select:')) {
        this.findings.push({
          ruleId: RULE_IDS.SELECT_IN_INFINITE_QUERY,
          severity: SEVERITIES.ERROR,
          message: 'useInfiniteQuery must specify a select: (data) => ({ items, total }) mapper.',
          filePath: relativePath,
          line: 1,
        });
      }
      if (!content.includes('staleTime:') || !content.includes('gcTime:')) {
        this.findings.push({
          ruleId: RULE_IDS.STALE_AND_GC_TIME,
          severity: SEVERITIES.WARN,
          message: 'useInfiniteQuery should explicitly specify staleTime and gcTime.',
          filePath: relativePath,
          line: 1,
        });
      }
    }

    // Rule 4: Relative types imports in API files
    if (relativePath.includes('src/api/') && !relativePath.endsWith('index.ts') && !relativePath.endsWith('endPoints.ts') && !relativePath.endsWith('apiClient.ts')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/from\s+['"]\.\.\/types\b/.test(line) || /from\s+['"]\.\/.*types['"]/.test(line)) {
          this.findings.push({
            ruleId: RULE_IDS.PURE_TYPES,
            severity: SEVERITIES.ERROR,
            message: "Import types strictly from 'types' barrel, not relative paths.",
            filePath: relativePath,
            line: i + 1,
          });
        }
      }
    }
  }
}

module.exports = ApiValidator;
