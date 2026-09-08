'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { analyzeContext, buildRepositoryContext } = require('../lib/context-analyzer');
const { SEVERITY, CATEGORIES } = require('../lib/constants');

// ────────────────────────────────────────────────────────────────────
// Helper: create a minimal finding for testing
// ────────────────────────────────────────────────────────────────────
function makeFinding(overrides = {}) {
  return {
    id: 'test-id',
    file: 'src/services/authService.ts',
    line: 5,
    lineContent: "const secret = 'hardcoded_secret_value';",
    rule: 'SEC-002',
    message: 'Hardcoded Secret/Password',
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.SECRETS,
    recommendation: 'Use environment variables.',
    ...overrides,
  };
}

function makeRepoContext(overrides = {}) {
  return {
    targetDir: '/project',
    appType: 'general',
    appName: 'TestApp',
    hasKeychain: false,
    hasEncryptedStorage: false,
    hasMMKV: false,
    hasConfig: false,
    hasSecureStore: false,
    hasSentry: false,
    hasBiometrics: false,
    hasBabelConsoleRemoval: false,
    hasHermes: false,
    dependencies: {},
    devDependencies: {},
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// Heuristic 1: Comment/JSDoc detection
// ════════════════════════════════════════════════════════════════════

describe('FP Heuristic 1: Comment Detection', () => {
  it('flags findings inside single-line comments as FP', () => {
    const fileContent = "line1\nline2\nline3\nline4\n// const secret = 'hardcoded_secret_value';\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/src/services/authService.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /comment/i.test(i)));
  });

  it('flags findings inside JSDoc block comments as FP', () => {
    const fileContent = "line1\nline2\nline3\nline4\n * @param secret The secret value\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/src/services/authService.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /comment/i.test(i)));
  });

  it('does not flag real code lines as comment FP', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'hardcoded_secret_value';\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/src/services/authService.ts', makeRepoContext());
    assert.ok(!result.context.indicators.some(i => /comment/i.test(i)));
  });
});

// ════════════════════════════════════════════════════════════════════
// Heuristic 2: Test/mock file detection
// ════════════════════════════════════════════════════════════════════

describe('FP Heuristic 2: Test File Detection', () => {
  it('flags findings in .test.ts files', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'test_value';\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/src/services/auth.test.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /test|spec|mock/i.test(i)));
  });

  it('flags findings in __tests__ directory', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'test_value';\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/__tests__/auth.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /test|spec|mock/i.test(i)));
  });

  it('flags findings in __mocks__ directory', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'mock_value';\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/__mocks__/auth.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /test|spec|mock/i.test(i)));
  });

  it('does not flag production files as test FP', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'real_value';\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/src/services/authService.ts', makeRepoContext());
    assert.ok(!result.context.indicators.some(i => /test|spec|mock/i.test(i)));
  });
});

// ════════════════════════════════════════════════════════════════════
// Heuristic 3: .d.ts / type definition detection
// ════════════════════════════════════════════════════════════════════

describe('FP Heuristic 3: Type Definition Detection', () => {
  it('flags findings in .d.ts files', () => {
    const fileContent = "line1\nline2\nline3\nline4\ndeclare const API_KEY: string;\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/src/types/env.d.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /type|interface/i.test(i)));
  });

  it('flags findings on interface/type declaration lines', () => {
    const fileContent = "line1\nline2\nline3\nline4\nexport interface AuthConfig { secret: string; }\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/src/types/auth.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /type|interface/i.test(i)));
  });

  it('does not flag runtime code in .ts files as type definition', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'hardcoded';\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/src/services/auth.ts', makeRepoContext());
    assert.ok(!result.context.indicators.some(i => /type|interface/i.test(i)));
  });
});

// ════════════════════════════════════════════════════════════════════
// Heuristic 4: __DEV__ guard detection
// ════════════════════════════════════════════════════════════════════

describe('FP Heuristic 4: __DEV__ Guard Detection', () => {
  it('flags findings inside __DEV__ blocks', () => {
    const fileContent = [
      'import stuff;',
      '',
      'if (__DEV__) {',
      '  const secret = "debug_only_value";',
      '}',
      'export {};',
    ].join('\n');
    const finding = makeFinding({ line: 4 });
    const result = analyzeContext(finding, fileContent, '/project/src/services/auth.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /__DEV__/i.test(i)));
  });

  it('does not flag findings outside __DEV__ blocks', () => {
    const fileContent = [
      'import stuff;',
      '',
      'const secret = "production_value";',
      '',
      'if (__DEV__) {',
      '  console.log("dev mode");',
      '}',
    ].join('\n');
    const finding = makeFinding({ line: 3 });
    const result = analyzeContext(finding, fileContent, '/project/src/services/auth.ts', makeRepoContext());
    assert.ok(!result.context.indicators.some(i => /__DEV__/i.test(i)));
  });
});

// ════════════════════════════════════════════════════════════════════
// Heuristic 5: Environment/config reference detection
// ════════════════════════════════════════════════════════════════════

describe('FP Heuristic 5: Environment Reference Detection', () => {
  it('flags env references for non-SEC rules', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst url = process.env.API_URL;\nline6";
    const finding = makeFinding({ line: 5, rule: 'NET-001' });
    const result = analyzeContext(finding, fileContent, '/project/src/config.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /environment|config/i.test(i)));
  });

  it('does not dismiss SEC rules that match env patterns', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst key = process.env.SECRET_KEY;\nline6";
    const finding = makeFinding({ line: 5, rule: 'SEC-001' });
    const result = analyzeContext(finding, fileContent, '/project/src/config.ts', makeRepoContext());
    // SEC rules should NOT get the env-reference FP indicator
    assert.ok(!result.context.indicators.some(i => /environment|config/i.test(i)));
  });
});

// ════════════════════════════════════════════════════════════════════
// Heuristic 6: Placeholder/label value detection
// ════════════════════════════════════════════════════════════════════

describe('FP Heuristic 6: Placeholder Detection', () => {
  it('flags placeholder values in SEC rules', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'your_api_key_here';\nline6";
    const finding = makeFinding({ line: 5, rule: 'SEC-001' });
    const result = analyzeContext(finding, fileContent, '/project/src/config.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /placeholder|label|non-sensitive/i.test(i)));
  });

  it('flags TODO/CHANGEME values', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'CHANGEME_before_deploy';\nline6";
    const finding = makeFinding({ line: 5, rule: 'SEC-002' });
    const result = analyzeContext(finding, fileContent, '/project/src/config.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /placeholder|label|non-sensitive/i.test(i)));
  });

  it('does not flag real secret values as placeholder', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'sk_live_real_production_key_9x8z';\nline6";
    const finding = makeFinding({ line: 5, rule: 'SEC-001' });
    const result = analyzeContext(finding, fileContent, '/project/src/config.ts', makeRepoContext());
    assert.ok(!result.context.indicators.some(i => /placeholder|label|non-sensitive/i.test(i)));
  });
});

// ════════════════════════════════════════════════════════════════════
// Heuristic 7: Babel console removal detection
// ════════════════════════════════════════════════════════════════════

describe('FP Heuristic 7: Babel Console Removal', () => {
  it('flags LOG rules when babel console removal is configured', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconsole.log('debug info');\nline6";
    const finding = makeFinding({ line: 5, rule: 'LOG-004', message: 'Console.log in Production Code' });
    const ctx = makeRepoContext({ hasBabelConsoleRemoval: true });
    const result = analyzeContext(finding, fileContent, '/project/src/utils/logger.ts', ctx);
    assert.ok(result.context.indicators.some(i => /babel.*console/i.test(i)));
  });

  it('does not flag LOG rules when babel console removal is absent', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconsole.log('debug info');\nline6";
    const finding = makeFinding({ line: 5, rule: 'LOG-004', message: 'Console.log in Production Code' });
    const ctx = makeRepoContext({ hasBabelConsoleRemoval: false });
    const result = analyzeContext(finding, fileContent, '/project/src/utils/logger.ts', ctx);
    assert.ok(!result.context.indicators.some(i => /babel.*console/i.test(i)));
  });

  it('does not apply babel heuristic to non-LOG rules', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'value';\nline6";
    const finding = makeFinding({ line: 5, rule: 'SEC-002' });
    const ctx = makeRepoContext({ hasBabelConsoleRemoval: true });
    const result = analyzeContext(finding, fileContent, '/project/src/config.ts', ctx);
    assert.ok(!result.context.indicators.some(i => /babel.*console/i.test(i)));
  });
});

// ════════════════════════════════════════════════════════════════════
// Heuristic 8: Import statement detection
// ════════════════════════════════════════════════════════════════════

describe('FP Heuristic 8: Import Statement Detection', () => {
  it('flags findings on import lines (non-STR-002)', () => {
    const fileContent = "line1\nline2\nline3\nline4\nimport { secretHelper } from 'utils/secrets';\nline6";
    const finding = makeFinding({ line: 5, rule: 'SEC-001' });
    const result = analyzeContext(finding, fileContent, '/project/src/auth.ts', makeRepoContext());
    assert.ok(result.context.indicators.some(i => /import/i.test(i)));
  });

  it('does not flag STR-002 import findings (that IS the rule purpose)', () => {
    const fileContent = "line1\nline2\nline3\nline4\nimport AsyncStorage from '@react-native-async-storage/async-storage';\nline6";
    const finding = makeFinding({ line: 5, rule: 'STR-002' });
    const result = analyzeContext(finding, fileContent, '/project/src/storage.ts', makeRepoContext());
    assert.ok(!result.context.indicators.some(i => /import statement/i.test(i)));
  });

  it('does not flag non-import lines', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'hardcoded';\nline6";
    const finding = makeFinding({ line: 5, rule: 'SEC-001' });
    const result = analyzeContext(finding, fileContent, '/project/src/auth.ts', makeRepoContext());
    assert.ok(!result.context.indicators.some(i => /import statement/i.test(i)));
  });
});

// ════════════════════════════════════════════════════════════════════
// Overall analyzeContext behavior
// ════════════════════════════════════════════════════════════════════

describe('analyzeContext general behavior', () => {
  it('returns enriched finding with context, fix, and original fields', () => {
    const fileContent = "line1\nline2\nline3\nline4\nconst secret = 'hardcoded';\nline6";
    const finding = makeFinding({ line: 5 });
    const result = analyzeContext(finding, fileContent, '/project/src/auth.ts', makeRepoContext());
    assert.ok('context' in result);
    assert.ok('fix' in result);
    assert.ok('rule' in result);
    assert.ok('id' in result);
    assert.equal(typeof result.context.isFalsePositive, 'boolean');
    assert.equal(typeof result.context.confidence, 'number');
    assert.ok(result.context.status);
  });

  it('does not crash on null/undefined file content', () => {
    const finding = makeFinding({ line: 1 });
    const result = analyzeContext(finding, null, '/project/src/auth.ts', makeRepoContext());
    assert.ok('context' in result);
    assert.equal(typeof result.context.isFalsePositive, 'boolean');
  });

  it('does not crash on out-of-range line numbers', () => {
    const fileContent = 'single line';
    const finding = makeFinding({ line: 999 });
    const result = analyzeContext(finding, fileContent, '/project/src/auth.ts', makeRepoContext());
    assert.ok('context' in result);
  });
});
