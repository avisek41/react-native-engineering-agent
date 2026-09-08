'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  scanNativeFiles,
  discoverNativeFiles,
  ANDROID_MANIFEST_RULES,
  NETWORK_SECURITY_CONFIG_RULES,
  BUILD_GRADLE_RULES,
  INFO_PLIST_RULES,
} = require('../lib/rules-native');
const { makeFindingFactory } = require('../lib/scanner');

// ────────────────────────────────────────────────────────────────────
// Helper: create a temp project with native files
// ────────────────────────────────────────────────────────────────────
let tmpDir;

function createNativeProject(manifest, networkConfig, buildGradle, infoPlist) {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-native-test-'));
  fs.mkdirSync(path.join(tmpDir, 'android', 'app', 'src', 'main', 'res', 'xml'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'ios', 'MyApp'), { recursive: true });

  if (manifest) {
    fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), manifest);
  }
  if (networkConfig) {
    fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml'), networkConfig);
  }
  if (buildGradle) {
    fs.writeFileSync(path.join(tmpDir, 'android', 'app', 'build.gradle'), buildGradle);
  }
  if (infoPlist) {
    fs.writeFileSync(path.join(tmpDir, 'ios', 'MyApp', 'Info.plist'), infoPlist);
  }

  return tmpDir;
}

function cleanup() {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ════════════════════════════════════════════════════════════════════
// Rule Structure
// ════════════════════════════════════════════════════════════════════

describe('Native Rules Structure', () => {
  it('all Android manifest rules have required fields', () => {
    for (const rule of ANDROID_MANIFEST_RULES) {
      assert.ok(rule.id, `Missing id`);
      assert.ok(rule.id.startsWith('NATIVE-AND-'), `${rule.id} should start with NATIVE-AND-`);
      assert.ok(rule.name, `${rule.id} missing name`);
      assert.ok(rule.pattern, `${rule.id} missing pattern`);
      assert.ok(rule.severity, `${rule.id} missing severity`);
      assert.ok(rule.recommendation, `${rule.id} missing recommendation`);
    }
  });

  it('all iOS rules have required fields', () => {
    for (const rule of INFO_PLIST_RULES) {
      assert.ok(rule.id.startsWith('NATIVE-IOS-'), `${rule.id} should start with NATIVE-IOS-`);
      assert.ok(rule.name);
      assert.ok(rule.pattern);
      assert.ok(rule.severity);
      assert.ok(rule.recommendation);
    }
  });

  it('all rule IDs are unique', () => {
    const allRules = [
      ...ANDROID_MANIFEST_RULES,
      ...NETWORK_SECURITY_CONFIG_RULES,
      ...BUILD_GRADLE_RULES,
      ...INFO_PLIST_RULES,
    ];
    const ids = allRules.map(r => r.id);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, `Duplicate IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  });
});

// ════════════════════════════════════════════════════════════════════
// Android Manifest Scanning
// ════════════════════════════════════════════════════════════════════

describe('Android Manifest Scanning', () => {
  after(() => cleanup());

  it('NATIVE-AND-001: detects usesCleartextTraffic', () => {
    createNativeProject(
      '<manifest><application android:usesCleartextTraffic="true"></application></manifest>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(findings.some(f => f.rule === 'NATIVE-AND-001'));
    cleanup();
  });

  it('NATIVE-AND-002: detects debuggable=true', () => {
    createNativeProject(
      '<manifest><application android:debuggable="true"></application></manifest>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(findings.some(f => f.rule === 'NATIVE-AND-002'));
    cleanup();
  });

  it('NATIVE-AND-003: detects allowBackup=true', () => {
    createNativeProject(
      '<manifest><application android:allowBackup="true"></application></manifest>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(findings.some(f => f.rule === 'NATIVE-AND-003'));
    cleanup();
  });

  it('NATIVE-AND-004: detects exported components', () => {
    createNativeProject(
      '<manifest><activity android:exported="true" android:name=".MainActivity"/></manifest>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(findings.some(f => f.rule === 'NATIVE-AND-004'));
    cleanup();
  });

  it('does not flag secure manifest', () => {
    createNativeProject(
      '<manifest><application android:usesCleartextTraffic="false" android:allowBackup="false"></application></manifest>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    const androidFindings = findings.filter(f => f.rule.startsWith('NATIVE-AND-'));
    assert.equal(androidFindings.length, 0, `Should have zero manifest findings, got: ${androidFindings.map(f => f.rule)}`);
    cleanup();
  });
});

// ════════════════════════════════════════════════════════════════════
// Network Security Config
// ════════════════════════════════════════════════════════════════════

describe('Network Security Config Scanning', () => {
  after(() => cleanup());

  it('NATIVE-AND-006: detects cleartext permitted', () => {
    createNativeProject(null,
      '<network-security-config><base-config cleartextTrafficPermitted="true"/></network-security-config>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(findings.some(f => f.rule === 'NATIVE-AND-006'));
    cleanup();
  });

  it('NATIVE-AND-007: detects user CA trust', () => {
    createNativeProject(null,
      '<network-security-config><base-config><trust-anchors><certificates src="user"/></trust-anchors></base-config></network-security-config>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(findings.some(f => f.rule === 'NATIVE-AND-007'));
    cleanup();
  });
});

// ════════════════════════════════════════════════════════════════════
// Build Gradle
// ════════════════════════════════════════════════════════════════════

describe('Build Gradle Scanning', () => {
  after(() => cleanup());

  it('NATIVE-AND-008: detects minifyEnabled false', () => {
    createNativeProject(null, null,
      'android {\n  buildTypes {\n    release {\n      minifyEnabled false\n    }\n  }\n}'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(findings.some(f => f.rule === 'NATIVE-AND-008'));
    cleanup();
  });

  it('does not flag minifyEnabled true', () => {
    createNativeProject(null, null,
      'android {\n  buildTypes {\n    release {\n      minifyEnabled true\n    }\n  }\n}'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(!findings.some(f => f.rule === 'NATIVE-AND-008'));
    cleanup();
  });
});

// ════════════════════════════════════════════════════════════════════
// iOS Info.plist
// ════════════════════════════════════════════════════════════════════

describe('iOS Info.plist Scanning', () => {
  after(() => cleanup());

  it('NATIVE-IOS-001: detects NSAllowsArbitraryLoads', () => {
    createNativeProject(null, null, null,
      '<?xml version="1.0"?>\n<plist>\n<dict>\n<key>NSAppTransportSecurity</key>\n<dict>\n<key>NSAllowsArbitraryLoads</key>\n<true/>\n</dict>\n</dict>\n</plist>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(findings.some(f => f.rule === 'NATIVE-IOS-001'), `Should detect ATS disabled, got: ${findings.map(f => f.rule)}`);
    cleanup();
  });

  it('NATIVE-IOS-002: detects insecure HTTP exception', () => {
    createNativeProject(null, null, null,
      '<?xml version="1.0"?>\n<plist>\n<dict>\n<key>NSExceptionAllowsInsecureHTTPLoads</key>\n<true/>\n</dict>\n</plist>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(findings.some(f => f.rule === 'NATIVE-IOS-002'));
    cleanup();
  });

  it('NATIVE-IOS-003: detects lowered TLS version', () => {
    createNativeProject(null, null, null,
      '<?xml version="1.0"?>\n<plist>\n<dict>\n<key>NSExceptionMinimumTLSVersion</key>\n<string>TLSv1.0</string>\n</dict>\n</plist>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(findings.some(f => f.rule === 'NATIVE-IOS-003'));
    cleanup();
  });

  it('does not flag secure Info.plist', () => {
    createNativeProject(null, null, null,
      '<?xml version="1.0"?>\n<plist>\n<dict>\n<key>CFBundleName</key>\n<string>MyApp</string>\n</dict>\n</plist>'
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    scanNativeFiles(tmpDir, findings, addFinding, true);
    const iosFindings = findings.filter(f => f.rule.startsWith('NATIVE-IOS-'));
    assert.equal(iosFindings.length, 0);
    cleanup();
  });
});

// ════════════════════════════════════════════════════════════════════
// File Discovery
// ════════════════════════════════════════════════════════════════════

describe('Native File Discovery', () => {
  after(() => cleanup());

  it('discovers Android and iOS files when present', () => {
    createNativeProject('<manifest/>', '<config/>', 'android {}',
      '<?xml version="1.0"?><plist><dict></dict></plist>');
    const files = discoverNativeFiles(tmpDir);
    assert.ok(files.some(f => f.category === 'androidManifest'));
    assert.ok(files.some(f => f.category === 'buildGradle'));
    assert.ok(files.some(f => f.category === 'networkSecurityConfig'));
    assert.ok(files.some(f => f.category === 'infoPlist'));
    cleanup();
  });

  it('returns empty array when no native dirs exist', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-native-empty-'));
    const files = discoverNativeFiles(tmpDir);
    assert.equal(files.length, 0);
    cleanup();
  });

  it('skips Pods directory for iOS', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-native-pods-'));
    fs.mkdirSync(path.join(tmpDir, 'ios', 'Pods'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'ios', 'Pods', 'Info.plist'), '<plist/>');
    const files = discoverNativeFiles(tmpDir);
    assert.ok(!files.some(f => f.relPath.includes('Pods')));
    cleanup();
  });
});

// ════════════════════════════════════════════════════════════════════
// Integration: scanNativeFiles
// ════════════════════════════════════════════════════════════════════

describe('scanNativeFiles integration', () => {
  after(() => cleanup());

  it('returns correct counts', () => {
    createNativeProject(
      '<manifest><application android:debuggable="true" android:usesCleartextTraffic="true"></application></manifest>',
      null, null, null
    );
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    const result = scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.ok(result.filesScanned >= 1);
    assert.ok(result.findingsCount >= 2, `Should find at least 2 issues, got ${result.findingsCount}`);
    cleanup();
  });

  it('returns zero findings for project without native dirs', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-native-none-'));
    const findings = [];
    const addFinding = makeFindingFactory(tmpDir, []);
    const result = scanNativeFiles(tmpDir, findings, addFinding, true);
    assert.equal(result.filesScanned, 0);
    assert.equal(result.findingsCount, 0);
    cleanup();
  });
});
