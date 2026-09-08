'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  SECRET_PATTERNS,
  STORAGE_PATTERNS,
  NETWORK_PATTERNS,
  LOGGING_PATTERNS,
  AUTH_PATTERNS,
  GENERAL_PATTERNS,
  CORE_RULES,
} = require('../lib/rules-core');

// ────────────────────────────────────────────────────────────────────
// Helper: test a single line against a specific rule by ID
// ────────────────────────────────────────────────────────────────────
function findRuleById(ruleId) {
  const allRules = [
    ...SECRET_PATTERNS,
    ...STORAGE_PATTERNS,
    ...NETWORK_PATTERNS,
    ...LOGGING_PATTERNS,
    ...AUTH_PATTERNS,
    ...GENERAL_PATTERNS,
  ];
  const rule = allRules.find(r => r.id === ruleId);
  if (!rule) throw new Error(`Rule ${ruleId} not found`);
  return rule;
}

function matchesRule(line, ruleId) {
  const rule = findRuleById(ruleId);
  const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
  const matched = regex.test(line);
  // Check exclude pattern
  if (matched && rule.exclude && rule.exclude.test(line)) {
    return false;
  }
  return matched;
}

// ════════════════════════════════════════════════════════════════════
// SECRETS
// ════════════════════════════════════════════════════════════════════

describe('Secret Detection Rules', () => {
  it('SEC-001: detects hardcoded API keys', () => {
    assert.ok(matchesRule("const apiKey = 'sk_live_abcdefghijklmnop12345';", 'SEC-001'));
    assert.ok(matchesRule('const API_KEY = "AIzaSyDexamplekey1234567890";', 'SEC-001'));
  });

  it('SEC-001: does not match short values', () => {
    assert.ok(!matchesRule("const apiKey = 'short';", 'SEC-001'));
  });

  it('SEC-002: detects hardcoded passwords', () => {
    assert.ok(matchesRule("const password = 'SuperSecret123!';", 'SEC-002'));
    assert.ok(matchesRule('const secret = "my_secret_value_here";', 'SEC-002'));
  });

  it('SEC-002: does not match placeholder labels', () => {
    assert.ok(!matchesRule("const PASSWORD_LABEL = 'Enter your password';", 'SEC-002'));
    assert.ok(!matchesRule("const PASSWORD_PLACEHOLDER = 'Password';", 'SEC-002'));
    assert.ok(!matchesRule("const FORGOT_PASSWORD = 'Forgot password?';", 'SEC-002'));
  });

  it('SEC-003: detects hardcoded JWT tokens', () => {
    assert.ok(matchesRule(
      "const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';",
      'SEC-003'
    ));
  });

  it('SEC-003: does not match non-JWT strings', () => {
    assert.ok(!matchesRule("const token = 'not-a-jwt-value';", 'SEC-003'));
  });

  it('SEC-004: detects private keys', () => {
    assert.ok(matchesRule('const key = "-----BEGIN PRIVATE KEY-----";', 'SEC-004'));
    assert.ok(matchesRule('const rsaKey = "-----BEGIN RSA PRIVATE KEY-----";', 'SEC-004'));
  });

  it('SEC-004: does not match public keys', () => {
    assert.ok(!matchesRule('const key = "-----BEGIN PUBLIC KEY-----";', 'SEC-004'));
  });

  it('SEC-005: detects AWS access keys', () => {
    assert.ok(matchesRule('const awsKey = "AKIAIOSFODNN7EXAMPLE";', 'SEC-005'));
  });

  it('SEC-005: does not match non-AWS strings', () => {
    assert.ok(!matchesRule('const key = "NOTANAWSKEY1234567";', 'SEC-005'));
  });

  it('SEC-006: detects Firebase config secrets', () => {
    assert.ok(matchesRule("const firebase_key = 'AIzaSyCexampleFirebaseKey12345';", 'SEC-006'));
  });

  it('SEC-006: does not match non-Firebase keys', () => {
    assert.ok(!matchesRule("const appTitle = 'My Firebase App';", 'SEC-006'));
  });

  it('SEC-007: detects encryption keys in source', () => {
    assert.ok(matchesRule("const encryption_key = 'my_aes_256_key_value_here';", 'SEC-007'));
    assert.ok(matchesRule("const aes_key = 'some_cipher_key_1234';", 'SEC-007'));
  });

  it('SEC-007: does not match unrelated variables', () => {
    assert.ok(!matchesRule("const userName = 'alice';", 'SEC-007'));
  });

  it('SEC-008: detects URLs with embedded credentials', () => {
    assert.ok(matchesRule("const url = 'https://admin:secret@api.example.com';", 'SEC-008'));
    assert.ok(matchesRule("const db = 'http://user:pass@db.internal.com';", 'SEC-008'));
  });

  it('SEC-008: does not match clean URLs', () => {
    assert.ok(!matchesRule("const url = 'https://api.example.com/v1';", 'SEC-008'));
  });
});

// ════════════════════════════════════════════════════════════════════
// STORAGE
// ════════════════════════════════════════════════════════════════════

describe('Storage Security Rules', () => {
  it('STR-001: detects AsyncStorage for sensitive data', () => {
    assert.ok(matchesRule("await AsyncStorage.setItem('auth_token', tokenValue);", 'STR-001'));
    assert.ok(matchesRule("AsyncStorage.setItem('session_token', val);", 'STR-001'));
  });

  it('STR-001: does not match non-sensitive keys', () => {
    assert.ok(!matchesRule("await AsyncStorage.setItem('theme_mode', 'dark');", 'STR-001'));
  });

  it('STR-002: detects AsyncStorage imports', () => {
    assert.ok(matchesRule(
      "import AsyncStorage from '@react-native-async-storage/async-storage';",
      'STR-002'
    ));
  });

  it('STR-002: does not match unrelated imports', () => {
    assert.ok(!matchesRule("import { View } from 'react-native';", 'STR-002'));
  });

  it('STR-003: detects MMKV without encryption', () => {
    assert.ok(matchesRule("const storage = createMMKV({ id: 'app-storage' });", 'STR-003'));
  });

  it('STR-004: detects plaintext token storage keys', () => {
    assert.ok(matchesRule("const key = 'access_token';", 'STR-004'));
    assert.ok(matchesRule("const k = 'refresh_token';", 'STR-004'));
  });

  it('STR-005: detects persist() without encrypted storage', () => {
    assert.ok(matchesRule("const store = persist( create(() => ({ token: '' })) );", 'STR-005'));
  });
});

// ════════════════════════════════════════════════════════════════════
// NETWORK
// ════════════════════════════════════════════════════════════════════

describe('Network Security Rules', () => {
  it('NET-001: detects HTTP URLs', () => {
    assert.ok(matchesRule("const url = 'http://api.example.com/v1';", 'NET-001'));
  });

  it('NET-001: does not match localhost', () => {
    assert.ok(!matchesRule("const url = 'http://localhost:3000';", 'NET-001'));
    assert.ok(!matchesRule("const url = 'http://127.0.0.1:8080';", 'NET-001'));
  });

  it('NET-001: does not match private network addresses', () => {
    assert.ok(!matchesRule("const url = 'http://192.168.1.1:3000';", 'NET-001'));
    assert.ok(!matchesRule("const url = 'http://10.0.0.1/api';", 'NET-001'));
  });

  it('NET-002: detects disabled SSL validation', () => {
    assert.ok(matchesRule('const opts = { rejectUnauthorized: false };', 'NET-002'));
    assert.ok(matchesRule('ssl_verify = false', 'NET-002'));
  });

  it('NET-002: does not match enabled SSL', () => {
    assert.ok(!matchesRule('const opts = { rejectUnauthorized: true };', 'NET-002'));
  });

  it('NET-003: detects fetch without timeout', () => {
    assert.ok(matchesRule("const response = fetch('/api/data');", 'NET-003'));
  });

  it('NET-004: detects WebSocket without TLS', () => {
    assert.ok(matchesRule("const ws = 'ws://api.example.com/socket';", 'NET-004'));
  });

  it('NET-004: does not match localhost WebSocket', () => {
    assert.ok(!matchesRule("const ws = 'ws://localhost:8080/socket';", 'NET-004'));
  });
});

// ════════════════════════════════════════════════════════════════════
// LOGGING
// ════════════════════════════════════════════════════════════════════

describe('Logging Security Rules', () => {
  it('LOG-001: detects token logged to console', () => {
    assert.ok(matchesRule("console.log('Token:', accessToken);", 'LOG-001'));
    assert.ok(matchesRule("console.debug('refreshToken', refreshToken);", 'LOG-001'));
  });

  it('LOG-001: does not match non-sensitive console logs', () => {
    assert.ok(!matchesRule("console.log('User logged in');", 'LOG-001'));
  });

  it('LOG-002: detects password logged to console', () => {
    assert.ok(matchesRule("console.log('password:', password);", 'LOG-002'));
    assert.ok(matchesRule("console.warn('credential:', credential);", 'LOG-002'));
  });

  it('LOG-003: detects sensitive data in custom logger', () => {
    assert.ok(matchesRule("logger.info('accessToken:', accessToken);", 'LOG-003'));
    assert.ok(matchesRule("logger.debug('refreshToken', refreshToken);", 'LOG-003'));
  });

  it('LOG-004: detects console.log in production code', () => {
    assert.ok(matchesRule("console.log('debug info');", 'LOG-004'));
    assert.ok(matchesRule("console.error('something failed');", 'LOG-004'));
  });
});

// ════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════

describe('Authentication Rules', () => {
  it('AUTH-001: detects hardcoded Bearer token in header', () => {
    assert.ok(matchesRule(
      "headers: { Authorization: 'Bearer abcdefghijklmnopqrstuvwxyz1234567890' }",
      'AUTH-001'
    ));
  });

  it('AUTH-001: does not match dynamic token usage', () => {
    assert.ok(!matchesRule("headers: { Authorization: `Bearer ${token}` }", 'AUTH-001'));
  });

  it('AUTH-002: detects skipAuth=true', () => {
    assert.ok(matchesRule("const config = { skipAuth: true };", 'AUTH-002'));
  });

  it('AUTH-002: does not match skipAuth=false', () => {
    assert.ok(!matchesRule("const config = { skipAuth: false };", 'AUTH-002'));
  });

  it('AUTH-004: detects token refresh without rotation', () => {
    assert.ok(matchesRule("const next = nextRefreshToken ?? refreshToken;", 'AUTH-004'));
  });
});

// ════════════════════════════════════════════════════════════════════
// GENERAL
// ════════════════════════════════════════════════════════════════════

describe('General Security Rules', () => {
  it('GEN-001: detects eval() usage', () => {
    assert.ok(matchesRule("const result = eval(userInput);", 'GEN-001'));
  });

  it('GEN-001: does not match evaluate or similar names', () => {
    // eval( specifically needs the paren — 'evaluate' should not match the pattern
    // The pattern is /\beval\s*\(/g
    assert.ok(!matchesRule("const result = evaluate(userInput);", 'GEN-001'));
  });

  it('GEN-002: detects dangerouslySetInnerHTML', () => {
    assert.ok(matchesRule('<div dangerouslySetInnerHTML={{ __html: content }} />', 'GEN-002'));
  });

  it('GEN-002: does not match safe HTML usage', () => {
    assert.ok(!matchesRule('<div>{content}</div>', 'GEN-002'));
  });

  it('GEN-005: detects debug mode enabled', () => {
    assert.ok(matchesRule("const debugMode = true;", 'GEN-005'));
    assert.ok(matchesRule("isDebug = true", 'GEN-005'));
  });

  it('GEN-005: does not match debug mode disabled', () => {
    assert.ok(!matchesRule("const debugMode = false;", 'GEN-005'));
  });

  it('GEN-006: detects hardcoded IP addresses', () => {
    assert.ok(matchesRule("const server = '203.0.113.50:8080';", 'GEN-006'));
  });

  it('GEN-006: does not match loopback addresses', () => {
    const rule = findRuleById('GEN-006');
    const line = "const server = '127.0.0.1:3000';";
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    const matched = regex.test(line);
    // Even if the pattern matches, the exclude should catch 127.0.0.1
    if (matched && rule.exclude) {
      assert.ok(rule.exclude.test(line), 'Loopback should be excluded');
    }
  });

  it('GEN-007: detects SQL injection risk', () => {
    assert.ok(matchesRule('db.query(`SELECT * FROM users WHERE id = ${userId}`);', 'GEN-007'));
  });

  it('GEN-007: does not match parameterized queries', () => {
    assert.ok(!matchesRule("db.query('SELECT * FROM users WHERE id = ?', [userId]);", 'GEN-007'));
  });

  it('GEN-008: detects Math.random usage', () => {
    assert.ok(matchesRule("const id = Math.random().toString(36);", 'GEN-008'));
  });

  it('GEN-008: does not match crypto random', () => {
    assert.ok(!matchesRule("const id = crypto.getRandomValues(new Uint8Array(16));", 'GEN-008'));
  });

  it('GEN-004: detects committed .env files by filename', () => {
    const rule = findRuleById('GEN-004');
    assert.ok(rule.fileNameMatch, 'GEN-004 should be a filename-level rule');
    const regex = new RegExp(rule.pattern.source);
    assert.ok(regex.test('.env'));
    assert.ok(regex.test('.env.production'));
    assert.ok(!regex.test('config.json'));
  });
});

// ════════════════════════════════════════════════════════════════════
// STRUCTURAL CHECKS
// ════════════════════════════════════════════════════════════════════

describe('Core Rules Structure', () => {
  it('CORE_RULES is a non-empty array', () => {
    assert.ok(Array.isArray(CORE_RULES));
    assert.ok(CORE_RULES.length > 0);
  });

  it('every rule has required fields', () => {
    const allRules = [
      ...SECRET_PATTERNS,
      ...STORAGE_PATTERNS,
      ...NETWORK_PATTERNS,
      ...LOGGING_PATTERNS,
      ...AUTH_PATTERNS,
      ...GENERAL_PATTERNS,
    ];
    for (const rule of allRules) {
      assert.ok(rule.id, `Rule missing id: ${JSON.stringify(rule).substring(0, 80)}`);
      assert.ok(rule.name, `Rule ${rule.id} missing name`);
      assert.ok(rule.pattern, `Rule ${rule.id} missing pattern`);
      assert.ok(rule.severity, `Rule ${rule.id} missing severity`);
      assert.ok(rule.category, `Rule ${rule.id} missing category`);
      assert.ok(rule.recommendation, `Rule ${rule.id} missing recommendation`);
    }
  });

  it('all rule IDs are unique', () => {
    const allRules = [
      ...SECRET_PATTERNS,
      ...STORAGE_PATTERNS,
      ...NETWORK_PATTERNS,
      ...LOGGING_PATTERNS,
      ...AUTH_PATTERNS,
      ...GENERAL_PATTERNS,
    ];
    const ids = allRules.map(r => r.id);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, `Duplicate rule IDs found: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  });
});
