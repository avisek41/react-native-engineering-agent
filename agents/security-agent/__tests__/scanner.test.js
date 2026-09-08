'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  walkDir,
  scanFile,
  resolveFileDomain,
  applySuppressions,
  makeFindingFactory,
  generateFindingId,
} = require('../lib/scanner');
const { FOLDER_DOMAINS } = require('../lib/constants');
const { buildMergedDomains } = require('../lib/scope');

// ────────────────────────────────────────────────────────────────────
// Helper: create a temp directory structure for filesystem tests
// ────────────────────────────────────────────────────────────────────
let tmpDir;

function createTempProject() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-agent-test-'));
  // Create a minimal project structure
  fs.mkdirSync(path.join(tmpDir, 'src', 'services'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src', 'navigation'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src', 'api'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'node_modules', 'some-pkg'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '__tests__'), { recursive: true });

  // Source files
  fs.writeFileSync(path.join(tmpDir, 'src', 'services', 'auth.ts'), "const token = 'safe';\n");
  fs.writeFileSync(path.join(tmpDir, 'src', 'navigation', 'linking.ts'), "export const routes = {};\n");
  fs.writeFileSync(path.join(tmpDir, 'src', 'components', 'Button.tsx'), "<Button />\n");
  fs.writeFileSync(path.join(tmpDir, 'src', 'api', 'client.ts'), "export const api = {};\n");
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), "import './services/auth';\n");

  // Files that should be excluded
  fs.writeFileSync(path.join(tmpDir, 'node_modules', 'some-pkg', 'index.js'), "module.exports = {};\n");
  fs.writeFileSync(path.join(tmpDir, '__tests__', 'auth.test.ts'), "test('auth', () => {});\n");

  // Non-source files
  fs.writeFileSync(path.join(tmpDir, 'src', 'data.txt'), "not a source file\n");

  return tmpDir;
}

function cleanupTempProject() {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ════════════════════════════════════════════════════════════════════
// walkDir
// ════════════════════════════════════════════════════════════════════

describe('walkDir', () => {
  before(() => createTempProject());
  after(() => cleanupTempProject());

  it('recursively discovers source files', () => {
    const files = walkDir(path.join(tmpDir, 'src'));
    assert.ok(files.length > 0, 'Should find source files');
    assert.ok(files.some(f => f.endsWith('auth.ts')));
    assert.ok(files.some(f => f.endsWith('linking.ts')));
    assert.ok(files.some(f => f.endsWith('Button.tsx')));
    assert.ok(files.some(f => f.endsWith('client.ts')));
    assert.ok(files.some(f => f.endsWith('index.ts')));
  });

  it('skips node_modules', () => {
    const files = walkDir(tmpDir);
    assert.ok(!files.some(f => f.includes('node_modules')), 'Should skip node_modules');
  });

  it('skips __tests__ directories', () => {
    const files = walkDir(tmpDir);
    assert.ok(!files.some(f => f.includes(path.join('__tests__', 'auth.test.ts'))),
      'Should skip __tests__ directories');
  });

  it('skips non-source files (e.g., .txt)', () => {
    const files = walkDir(path.join(tmpDir, 'src'));
    assert.ok(!files.some(f => f.endsWith('.txt')), 'Should skip .txt files');
  });

  it('does not escape the requested root directory', () => {
    const srcDir = path.join(tmpDir, 'src', 'services');
    const files = walkDir(srcDir);
    for (const f of files) {
      assert.ok(f.startsWith(srcDir), `File ${f} escapes root ${srcDir}`);
    }
  });

  it('respects exclude patterns', () => {
    // isExcluded uses literal endsWith for **/suffix patterns, and path.includes for **/dir/** patterns
    const files = walkDir(path.join(tmpDir, 'src'), [], ['**/components/**']);
    assert.ok(!files.some(f => f.includes(path.sep + 'components' + path.sep)), 'Should exclude components dir');
    assert.ok(files.some(f => f.endsWith('.ts')), 'Should keep .ts files outside excluded dir');
  });
});

// ════════════════════════════════════════════════════════════════════
// isExcluded (tested indirectly through walkDir)
// ════════════════════════════════════════════════════════════════════

describe('Exclusion Matching (via walkDir)', () => {
  before(() => createTempProject());
  after(() => cleanupTempProject());

  it('suffix pattern (**/Button.tsx) excludes matching files', () => {
    const files = walkDir(path.join(tmpDir, 'src'), [], ['**/Button.tsx']);
    assert.ok(!files.some(f => f.endsWith('Button.tsx')));
  });

  it('directory pattern (**/__tests__/**) would exclude test dirs', () => {
    // __tests__ is already in IGNORE_DIRS, but customDomainRules may add patterns
    // Test with a custom exclude for services
    const files = walkDir(path.join(tmpDir, 'src'), [], ['**/services/**']);
    assert.ok(!files.some(f => f.includes(path.sep + 'services' + path.sep)));
  });

  it('non-matching patterns leave files intact', () => {
    const files = walkDir(path.join(tmpDir, 'src'), [], ['**/nonexistent/**']);
    assert.ok(files.length > 0, 'Non-matching pattern should not exclude anything');
  });
});

// ════════════════════════════════════════════════════════════════════
// resolveFileDomain
// ════════════════════════════════════════════════════════════════════

describe('resolveFileDomain', () => {
  const mergedDomains = buildMergedDomains();

  it('resolves services domain', () => {
    const domain = resolveFileDomain('/project/src/services/auth.ts', '/project/src', mergedDomains);
    assert.equal(domain, 'services');
  });

  it('resolves navigation domain', () => {
    const domain = resolveFileDomain('/project/src/navigation/linking.ts', '/project/src', mergedDomains);
    assert.equal(domain, 'navigation');
  });

  it('resolves api domain', () => {
    const domain = resolveFileDomain('/project/src/api/client.ts', '/project/src', mergedDomains);
    assert.equal(domain, 'api');
  });

  it('resolves components domain', () => {
    const domain = resolveFileDomain('/project/src/components/Button.tsx', '/project/src', mergedDomains);
    assert.equal(domain, 'components');
  });

  it('resolves store domain', () => {
    const domain = resolveFileDomain('/project/src/store/authSlice.ts', '/project/src', mergedDomains);
    assert.equal(domain, 'store');
  });

  it('returns null for files not in a recognized domain', () => {
    const domain = resolveFileDomain('/project/src/index.ts', '/project/src', mergedDomains);
    assert.equal(domain, null);
  });
});

// ════════════════════════════════════════════════════════════════════
// applySuppressions
// ════════════════════════════════════════════════════════════════════

describe('applySuppressions', () => {
  const findings = [
    { rule: 'NET-003', file: 'src/services/healthCheck.ts', message: 'Missing timeout' },
    { rule: 'NET-001', file: 'src/configs/baseURL.ts', message: 'HTTP URL' },
    { rule: 'SEC-002', file: 'src/services/authService.ts', message: 'Hardcoded secret' },
    { rule: 'LOG-004', file: 'src/utils/logger.ts', message: 'Console log' },
  ];

  it('suppresses matching rule ID + file path', () => {
    const suppressions = [{ ruleId: 'NET-003', filePath: 'src/services/healthCheck.ts' }];
    const result = applySuppressions(findings, suppressions);
    assert.equal(result.length, 3);
    assert.ok(!result.some(f => f.rule === 'NET-003'));
  });

  it('does not suppress when rule ID matches but file path does not', () => {
    const suppressions = [{ ruleId: 'NET-003', filePath: 'src/api/otherFile.ts' }];
    const result = applySuppressions(findings, suppressions);
    assert.equal(result.length, 4, 'Nothing should be suppressed');
  });

  it('does not suppress when file path matches but rule ID does not', () => {
    const suppressions = [{ ruleId: 'SEC-999', filePath: 'src/services/healthCheck.ts' }];
    const result = applySuppressions(findings, suppressions);
    assert.equal(result.length, 4);
  });

  it('unrelated findings are always preserved', () => {
    const suppressions = [{ ruleId: 'NET-003', filePath: 'src/services/healthCheck.ts' }];
    const result = applySuppressions(findings, suppressions);
    assert.ok(result.some(f => f.rule === 'LOG-004'));
    assert.ok(result.some(f => f.rule === 'SEC-002'));
  });

  it('multiple suppressions behave independently', () => {
    const suppressions = [
      { ruleId: 'NET-003', filePath: 'src/services/healthCheck.ts' },
      { ruleId: 'LOG-004', filePath: 'src/utils/logger.ts' },
    ];
    const result = applySuppressions(findings, suppressions);
    assert.equal(result.length, 2);
    assert.ok(!result.some(f => f.rule === 'NET-003'));
    assert.ok(!result.some(f => f.rule === 'LOG-004'));
    assert.ok(result.some(f => f.rule === 'NET-001'));
    assert.ok(result.some(f => f.rule === 'SEC-002'));
  });

  it('returns all findings when suppressions is empty', () => {
    const result = applySuppressions(findings, []);
    assert.equal(result.length, 4);
  });

  it('returns all findings when suppressions is null', () => {
    const result = applySuppressions(findings, null);
    assert.equal(result.length, 4);
  });
});

// ════════════════════════════════════════════════════════════════════
// Finding ID Stability (Deterministic SHA-256)
// ════════════════════════════════════════════════════════════════════

describe('Finding ID Stability', () => {
  it('produces deterministic IDs for the same input', () => {
    const id1 = generateFindingId('SEC-002', 'src/services/auth.ts', 10);
    const id2 = generateFindingId('SEC-002', 'src/services/auth.ts', 10);
    assert.equal(id1, id2, 'Same input should produce same ID');
  });

  it('produces different IDs for different rules', () => {
    const id1 = generateFindingId('SEC-001', 'src/services/auth.ts', 10);
    const id2 = generateFindingId('SEC-002', 'src/services/auth.ts', 10);
    assert.notEqual(id1, id2);
  });

  it('produces different IDs for different files', () => {
    const id1 = generateFindingId('SEC-002', 'src/services/auth.ts', 10);
    const id2 = generateFindingId('SEC-002', 'src/api/client.ts', 10);
    assert.notEqual(id1, id2);
  });

  it('produces different IDs for different lines', () => {
    const id1 = generateFindingId('SEC-002', 'src/services/auth.ts', 10);
    const id2 = generateFindingId('SEC-002', 'src/services/auth.ts', 20);
    assert.notEqual(id1, id2);
  });

  it('IDs are 12-character hex strings', () => {
    const id = generateFindingId('NET-001', 'src/config.ts', 5);
    assert.match(id, /^[0-9a-f]{12}$/);
  });
});

// ════════════════════════════════════════════════════════════════════
// makeFindingFactory
// ════════════════════════════════════════════════════════════════════

describe('makeFindingFactory', () => {
  it('creates findings with correct fields', () => {
    const findings = [];
    const addFinding = makeFindingFactory('/project/src', []);
    addFinding(findings, '/project/src/auth.ts', 5, 'const x = 1;', 'SEC-001', 'Test', { level: 4, label: 'CRITICAL' }, 'Secrets', 'Fix it');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].file, 'auth.ts');
    assert.equal(findings[0].line, 5);
    assert.equal(findings[0].rule, 'SEC-001');
    assert.ok(findings[0].id);
    assert.ok(findings[0].timestamp);
  });

  it('generates relative file paths', () => {
    const findings = [];
    const addFinding = makeFindingFactory('/project/src', []);
    addFinding(findings, '/project/src/services/auth.ts', 1, '', 'SEC-001', 'Test', {}, '', '');
    assert.equal(findings[0].file, path.join('services', 'auth.ts'));
  });

  it('resolves compliance references when frameworks are specified', () => {
    const findings = [];
    const addFinding = makeFindingFactory('/project/src', ['OWASP-MASVS']);
    addFinding(findings, '/project/src/auth.ts', 1, '', 'SEC-001', 'Test', {}, '', '');
    assert.ok(Array.isArray(findings[0].complianceRefs));
  });
});

// ════════════════════════════════════════════════════════════════════
// Scanner integration with fixtures
// ════════════════════════════════════════════════════════════════════

describe('Scanner integration with fixtures', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  it('detects vulnerabilities in vulnerable-sample.ts', () => {
    const findings = [];
    const addFinding = makeFindingFactory(fixturesDir, []);
    scanFile(path.join(fixturesDir, 'vulnerable-sample.ts'), fixturesDir, findings, addFinding, null, null);

    assert.ok(findings.length > 0, 'Should detect vulnerabilities');

    // Check for specific expected findings
    const ruleIds = findings.map(f => f.rule);
    assert.ok(ruleIds.includes('SEC-001'), 'Should detect SEC-001 (API key)');
    assert.ok(ruleIds.includes('NET-001'), 'Should detect NET-001 (HTTP URL)');
    assert.ok(ruleIds.includes('NET-002'), 'Should detect NET-002 (SSL disabled)');
    assert.ok(ruleIds.includes('GEN-001'), 'Should detect GEN-001 (eval)');
  });

  it('produces zero findings for clean-sample.ts', () => {
    const findings = [];
    const addFinding = makeFindingFactory(fixturesDir, []);
    scanFile(path.join(fixturesDir, 'clean-sample.ts'), fixturesDir, findings, addFinding, null, null);

    // Filter out informational-only findings (LOG-004 console.log is INFO-level and may be acceptable)
    const nonInfoFindings = findings.filter(f => f.severity && f.severity.level > 0);
    assert.equal(nonInfoFindings.length, 0, `Clean sample should have zero non-info findings, got: ${nonInfoFindings.map(f => f.rule).join(', ')}`);
  });
});
