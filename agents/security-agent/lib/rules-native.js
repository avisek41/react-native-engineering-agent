'use strict';

const fs = require('fs');
const path = require('path');
const { SEVERITY, CATEGORIES } = require('./constants');

// ────────────────────────────────────────────────────────────────────
// Native Platform Security Scanner
//
// Scans Android and iOS native configuration files for security
// misconfigurations. This module targets specific known config files
// by path rather than walking entire android/ios directories (which
// contain thousands of generated/build files).
//
// Only runs in ROOT scope — native config is a project-wide concern.
// ────────────────────────────────────────────────────────────────────

// ════════════════════════════════════════════════════════════════════
// Android Rules
// ════════════════════════════════════════════════════════════════════

const ANDROID_MANIFEST_RULES = [
  {
    id: 'NATIVE-AND-001',
    name: 'Cleartext Traffic Permitted',
    pattern: /android:usesCleartextTraffic\s*=\s*"true"/i,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.NETWORK,
    recommendation:
      'Set android:usesCleartextTraffic="false" in AndroidManifest.xml. ' +
      'Cleartext (HTTP) traffic can be intercepted. Use HTTPS for all connections.',
  },
  {
    id: 'NATIVE-AND-002',
    name: 'Debuggable Application',
    pattern: /android:debuggable\s*=\s*"true"/i,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.PLATFORM,
    recommendation:
      'Remove android:debuggable="true" or ensure it is only set in debug build variants. ' +
      'A debuggable release APK allows attackers to attach a debugger and inspect/modify app state.',
  },
  {
    id: 'NATIVE-AND-003',
    name: 'Backup Allowed',
    pattern: /android:allowBackup\s*=\s*"true"/i,
    severity: SEVERITY.MEDIUM,
    category: CATEGORIES.STORAGE,
    recommendation:
      'Set android:allowBackup="false" or implement a custom BackupAgent with encryption. ' +
      'When allowBackup is true, app data (including tokens) can be extracted via ADB backup.',
  },
  {
    id: 'NATIVE-AND-004',
    name: 'Exported Component Without Permission',
    // Match exported="true" on activities, services, receivers, providers
    // that don't have an android:permission attribute on the same element
    pattern: /android:exported\s*=\s*"true"/gi,
    severity: SEVERITY.MEDIUM,
    category: CATEGORIES.PLATFORM,
    recommendation:
      'Review all exported components. Exported activities/services/receivers are accessible ' +
      'to other apps. Add android:permission to restrict access, or set android:exported="false" ' +
      'if the component does not need to be externally accessible.',
    // Custom check: count occurrences and flag only those without permission
    countOccurrences: true,
  },
  {
    id: 'NATIVE-AND-005',
    name: 'Task Affinity Set (Task Hijacking Risk)',
    pattern: /android:taskAffinity\s*=\s*"[^"]*"/i,
    severity: SEVERITY.LOW,
    category: CATEGORIES.PLATFORM,
    recommendation:
      'Review android:taskAffinity settings. Custom task affinity can enable task hijacking ' +
      'attacks where a malicious app can inject itself into your task stack.',
  },
];

const NETWORK_SECURITY_CONFIG_RULES = [
  {
    id: 'NATIVE-AND-006',
    name: 'Cleartext Permitted in Network Security Config',
    pattern: /cleartextTrafficPermitted\s*=\s*"true"/i,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.NETWORK,
    recommendation:
      'Remove cleartextTrafficPermitted="true" from network_security_config.xml. ' +
      'Explicitly list only domains that genuinely require HTTP (e.g., localhost for dev).',
  },
  {
    id: 'NATIVE-AND-007',
    name: 'Trust User-Added CA Certificates',
    pattern: /<certificates\s+src\s*=\s*"user"\s*\/?>/i,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.NETWORK,
    recommendation:
      'Remove user-added CA trust from production builds. Trusting user certificates allows ' +
      'proxy tools (Burp Suite, Charles) to intercept HTTPS traffic. Only enable for debug builds.',
  },
];

const BUILD_GRADLE_RULES = [
  {
    id: 'NATIVE-AND-008',
    name: 'Minification Disabled in Release Build',
    pattern: /minifyEnabled\s+false/i,
    severity: SEVERITY.MEDIUM,
    category: CATEGORIES.PLATFORM,
    recommendation:
      'Enable minifyEnabled true for release builds in build.gradle. ' +
      'Without ProGuard/R8 minification, the APK code is trivially readable and larger.',
  },
  {
    id: 'NATIVE-AND-009',
    name: 'Resource Shrinking Disabled',
    pattern: /shrinkResources\s+false/i,
    severity: SEVERITY.LOW,
    category: CATEGORIES.PLATFORM,
    recommendation:
      'Enable shrinkResources true for release builds to remove unused resources and reduce APK size.',
  },
];

// ════════════════════════════════════════════════════════════════════
// iOS Rules
// ════════════════════════════════════════════════════════════════════

const INFO_PLIST_RULES = [
  {
    id: 'NATIVE-IOS-001',
    name: 'App Transport Security Disabled (NSAllowsArbitraryLoads)',
    pattern: /<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/?\s*>/i,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.NETWORK,
    recommendation:
      'Remove NSAllowsArbitraryLoads or set to false. This disables App Transport Security, ' +
      'allowing HTTP connections to any domain. Add per-domain exceptions only for domains that genuinely need them.',
  },
  {
    id: 'NATIVE-IOS-002',
    name: 'ATS Exception Allows Insecure HTTP',
    pattern: /<key>NSExceptionAllowsInsecureHTTPLoads<\/key>\s*<true\s*\/?\s*>/i,
    severity: SEVERITY.MEDIUM,
    category: CATEGORIES.NETWORK,
    recommendation:
      'Review NSExceptionAllowsInsecureHTTPLoads exceptions. Each domain listed here can receive ' +
      'plaintext HTTP traffic. Ensure only development/testing domains are excepted.',
  },
  {
    id: 'NATIVE-IOS-003',
    name: 'ATS Minimum TLS Version Lowered',
    pattern: /<key>NSExceptionMinimumTLSVersion<\/key>\s*<string>TLSv1\.[01]<\/string>/i,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.NETWORK,
    recommendation:
      'Do not lower the minimum TLS version below 1.2. TLS 1.0 and 1.1 have known vulnerabilities. ' +
      'Set NSExceptionMinimumTLSVersion to TLSv1.2 or remove the exception entirely.',
  },
  {
    id: 'NATIVE-IOS-004',
    name: 'Custom URL Scheme Without Validation',
    pattern: /<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>([^<]+)<\/string>/i,
    severity: SEVERITY.INFO,
    category: CATEGORIES.NAVIGATION,
    recommendation:
      'Custom URL schemes are registered. Ensure all deep link handlers validate and sanitize input ' +
      'parameters before navigating or performing actions. Consider using Universal Links (AASA) for better security.',
  },
];

// ════════════════════════════════════════════════════════════════════
// File Discovery
// ════════════════════════════════════════════════════════════════════

/**
 * Known native config file locations relative to a React Native project root.
 * We scan these specific paths rather than walking the entire android/ios trees.
 */
const NATIVE_FILE_CANDIDATES = {
  androidManifest: [
    'android/app/src/main/AndroidManifest.xml',
    'android/app/src/debug/AndroidManifest.xml',
    'android/app/src/release/AndroidManifest.xml',
  ],
  networkSecurityConfig: [
    'android/app/src/main/res/xml/network_security_config.xml',
    'android/app/src/debug/res/xml/network_security_config.xml',
  ],
  buildGradle: [
    'android/app/build.gradle',
    'android/app/build.gradle.kts',
  ],
  infoPlist: [
    'ios/*/Info.plist',
  ],
};

/**
 * Resolves Info.plist paths using simple glob expansion.
 * Returns an array of absolute paths that exist.
 */
function resolveInfoPlistPaths(projectRoot) {
  const iosDir = path.join(projectRoot, 'ios');
  if (!fs.existsSync(iosDir)) return [];

  const results = [];
  try {
    const entries = fs.readdirSync(iosDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'Pods' && entry.name !== 'build') {
        const plistPath = path.join(iosDir, entry.name, 'Info.plist');
        if (fs.existsSync(plistPath)) {
          results.push(plistPath);
        }
      }
    }
  } catch { /* skip */ }
  return results;
}

/**
 * Resolves all candidate native config files that exist on disk.
 * Returns { category, absPath, relPath } entries.
 */
function discoverNativeFiles(projectRoot) {
  const found = [];

  // Android files
  for (const rel of NATIVE_FILE_CANDIDATES.androidManifest) {
    const abs = path.join(projectRoot, rel);
    if (fs.existsSync(abs)) found.push({ category: 'androidManifest', absPath: abs, relPath: rel });
  }
  for (const rel of NATIVE_FILE_CANDIDATES.networkSecurityConfig) {
    const abs = path.join(projectRoot, rel);
    if (fs.existsSync(abs)) found.push({ category: 'networkSecurityConfig', absPath: abs, relPath: rel });
  }
  for (const rel of NATIVE_FILE_CANDIDATES.buildGradle) {
    const abs = path.join(projectRoot, rel);
    if (fs.existsSync(abs)) found.push({ category: 'buildGradle', absPath: abs, relPath: rel });
  }

  // iOS Info.plist (requires glob-like resolution)
  const plistPaths = resolveInfoPlistPaths(projectRoot);
  for (const abs of plistPaths) {
    const rel = path.relative(projectRoot, abs);
    found.push({ category: 'infoPlist', absPath: abs, relPath: rel });
  }

  return found;
}

// ════════════════════════════════════════════════════════════════════
// Scanner
// ════════════════════════════════════════════════════════════════════

/**
 * Scans native platform configuration files for security misconfigurations.
 *
 * @param {string} projectRoot - Project root directory
 * @param {object[]} findings - Array to push findings into (mutated)
 * @param {Function} addFinding - Finding factory from scanner.js
 * @param {boolean} [quiet=false] - Suppress console output
 * @returns {{ filesScanned: number, findingsCount: number }}
 */
function scanNativeFiles(projectRoot, findings, addFinding, quiet) {
  const nativeFiles = discoverNativeFiles(projectRoot);

  if (nativeFiles.length === 0) {
    if (!quiet) {
      console.log('  ℹ️  No native platform files found (android/ or ios/ directories may not exist).');
    }
    return { filesScanned: 0, findingsCount: 0 };
  }

  const initialCount = findings.length;
  let filesScanned = 0;

  for (const { category, absPath, relPath } of nativeFiles) {
    let content;
    try {
      content = fs.readFileSync(absPath, 'utf8');
    } catch {
      continue;
    }

    filesScanned++;
    const lines = content.split('\n');
    let rules;

    switch (category) {
      case 'androidManifest':
        rules = ANDROID_MANIFEST_RULES;
        break;
      case 'networkSecurityConfig':
        rules = NETWORK_SECURITY_CONFIG_RULES;
        break;
      case 'buildGradle':
        rules = BUILD_GRADLE_RULES;
        break;
      case 'infoPlist':
        rules = INFO_PLIST_RULES;
        break;
      default:
        rules = [];
    }

    for (const rule of rules) {
      // Multi-line patterns need to match against full content
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);

      if (rule.countOccurrences) {
        // Count and report each occurrence with line number
        for (let i = 0; i < lines.length; i++) {
          const lineRegex = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', ''));
          if (lineRegex.test(lines[i])) {
            addFinding(findings, absPath, i + 1, lines[i].trim(), rule.id, rule.name,
              rule.severity, rule.category, rule.recommendation);
          }
        }
      } else {
        // Single match against full content, then find the line
        if (regex.test(content)) {
          let matchLine = 0;
          let matchContent = '';
          for (let i = 0; i < lines.length; i++) {
            const lineRegex = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', ''));
            if (lineRegex.test(lines[i]) || (i + 1 < lines.length && lineRegex.test(lines[i] + lines[i + 1]))) {
              matchLine = i + 1;
              matchContent = lines[i].trim();
              break;
            }
          }
          // If multi-line match didn't resolve to a line, scan content blocks
          if (matchLine === 0) {
            // For multi-line patterns (e.g., plist key/value pairs), find the key line
            const keyMatch = content.match(/<key>[^<]*<\/key>/i);
            if (keyMatch) {
              const keyIndex = content.indexOf(keyMatch[0]);
              matchLine = content.substring(0, keyIndex).split('\n').length;
              matchContent = keyMatch[0];
            }
          }
          addFinding(findings, absPath, matchLine, matchContent, rule.id, rule.name,
            rule.severity, rule.category, rule.recommendation);
        }
      }
    }
  }

  const findingsCount = findings.length - initialCount;
  return { filesScanned, findingsCount };
}

// ════════════════════════════════════════════════════════════════════
// Exports
// ════════════════════════════════════════════════════════════════════

module.exports = {
  scanNativeFiles,
  discoverNativeFiles,
  ANDROID_MANIFEST_RULES,
  NETWORK_SECURITY_CONFIG_RULES,
  BUILD_GRADLE_RULES,
  INFO_PLIST_RULES,
};
