'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { SEVERITY, CATEGORIES } = require('./constants');

function checkDependencies(targetDir, findings, addFinding, quiet) {
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    const parentPkgJson = path.join(path.dirname(targetDir), 'package.json');
    if (fs.existsSync(parentPkgJson)) {
      analyzeDeps(parentPkgJson, targetDir, findings, addFinding, quiet);
    }
    return;
  }
  analyzeDeps(packageJsonPath, targetDir, findings, addFinding, quiet);
}

function analyzeDeps(pkgPath, targetDir, findings, addFinding, quiet) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    const knownIssues = {
      'react-native-webview': {
        concern: 'Ensure latest version — older versions have XSS vulnerabilities',
        severity: SEVERITY.MEDIUM,
      },
      'expo-secure-store': {
        concern: 'Good choice for secure storage (Expo) — verify you are using it for all sensitive data',
        severity: SEVERITY.INFO,
      },
      'react-native-keychain': {
        concern: 'Good choice for secure storage (bare RN) — verify you are using it for all sensitive data (tokens, passwords, keys)',
        severity: SEVERITY.INFO,
      },
      'react-native-gesture-handler': {
        concern: 'Ensure version ≥2.9 — earlier versions have touch event leaks',
        severity: SEVERITY.LOW,
      },
      'moment': {
        concern: 'moment.js is in maintenance mode. Consider migrating to date-fns or dayjs for smaller bundle size and active security patches',
        severity: SEVERITY.LOW,
      },
    };

    for (const [dep, info] of Object.entries(knownIssues)) {
      if (allDeps[dep]) {
        addFinding(findings, path.relative(targetDir, pkgPath), 0, `${dep}: ${allDeps[dep]}`,
          'DEP-001', `Dependency Notice: ${dep}`, info.severity, CATEGORIES.DEPS, info.concern);
      }
    }

    try {
      const pkgDir = path.dirname(pkgPath);
      if (fs.existsSync(path.join(pkgDir, 'package-lock.json'))) {
        const auditResult = execSync('npm audit --json 2>/dev/null', {
          cwd: pkgDir,
          encoding: 'utf8',
          timeout: 30000,
        });
        const audit = JSON.parse(auditResult);

        if (audit.metadata && audit.metadata.vulnerabilities) {
          const { critical, high, moderate } = audit.metadata.vulnerabilities;

          if (critical > 0) {
            addFinding(findings, 'package.json', 0, `${critical} critical vulnerabilities`,
              'DEP-002', `npm audit: ${critical} Critical Vulnerabilities`, SEVERITY.CRITICAL, CATEGORIES.DEPS,
              'Run `npm audit fix` immediately. For breaking changes, run `npm audit fix --force` (review changes carefully).');
          }
          if (high > 0) {
            addFinding(findings, 'package.json', 0, `${high} high vulnerabilities`,
              'DEP-003', `npm audit: ${high} High Vulnerabilities`, SEVERITY.HIGH, CATEGORIES.DEPS,
              'Run `npm audit fix` to resolve. Review each vulnerability at npmjs.com/advisories.');
          }
          if (moderate > 0) {
            addFinding(findings, 'package.json', 0, `${moderate} moderate vulnerabilities`,
              'DEP-004', `npm audit: ${moderate} Moderate Vulnerabilities`, SEVERITY.MEDIUM, CATEGORIES.DEPS,
              'Run `npm audit` for details. Schedule fixes in your next sprint.');
          }
        }
      }
    } catch {
      // npm audit failed or unavailable — skip silently
    }
  } catch (e) {
    if (!quiet) console.warn(`⚠️  Could not parse ${pkgPath}: ${e.message}`);
  }
}

module.exports = { checkDependencies };
