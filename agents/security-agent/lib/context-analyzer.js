'use strict';

const fs = require('fs');
const path = require('path');

// ────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────

const CONTEXT_RADIUS = 15;

const FP_STATUS = {
  CONFIRMED: 'confirmed',
  LIKELY: 'likely',
  UNCERTAIN: 'uncertain',
  LIKELY_FALSE_POSITIVE: 'likely_false_positive',
};

// ────────────────────────────────────────────────────────────────────
// Repository Context Builder
// ────────────────────────────────────────────────────────────────────

/**
 * Inspects the project once to build context about installed packages,
 * babel config, and other security-relevant settings.
 * This avoids repeated filesystem checks per-finding.
 */
function buildRepositoryContext(targetDir, config) {
  const ctx = {
    targetDir,
    appType: (config && config.appType) || 'general',
    appName: (config && config.appName) || 'App',

    // Installed security-relevant packages
    hasKeychain: false,
    hasEncryptedStorage: false,
    hasMMKV: false,
    hasConfig: false,       // react-native-config
    hasSecureStore: false,   // expo-secure-store
    hasSentry: false,
    hasBiometrics: false,

    // Build config
    hasBabelConsoleRemoval: false,
    hasHermes: false,

    // Dependency map (for fix generation)
    dependencies: {},
    devDependencies: {},
  };

  // Read package.json
  const pkgCandidates = [
    path.join(targetDir, 'package.json'),
    path.join(path.dirname(targetDir), 'package.json'),
  ];

  for (const pkgPath of pkgCandidates) {
    try {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        ctx.dependencies = pkg.dependencies || {};
        ctx.devDependencies = pkg.devDependencies || {};

        ctx.hasKeychain = 'react-native-keychain' in allDeps;
        ctx.hasEncryptedStorage = 'react-native-encrypted-storage' in allDeps;
        ctx.hasMMKV = 'react-native-mmkv' in allDeps;
        ctx.hasConfig = 'react-native-config' in allDeps;
        ctx.hasSecureStore = 'expo-secure-store' in allDeps;
        ctx.hasSentry = '@sentry/react-native' in allDeps;
        ctx.hasBiometrics = 'react-native-biometrics' in allDeps ||
                            'react-native-touch-id' in allDeps;
        ctx.hasHermes = !!(pkg.react && pkg.react.hermes);
        break;
      }
    } catch { /* skip */ }
  }

  // Check babel config for console removal
  const babelCandidates = [
    path.join(targetDir, 'babel.config.js'),
    path.join(path.dirname(targetDir), 'babel.config.js'),
    path.join(targetDir, '.babelrc'),
    path.join(path.dirname(targetDir), '.babelrc'),
  ];

  for (const babelPath of babelCandidates) {
    try {
      if (fs.existsSync(babelPath)) {
        const babelContent = fs.readFileSync(babelPath, 'utf8');
        if (/transform-remove-console|babel-plugin-transform-remove-console/i.test(babelContent)) {
          ctx.hasBabelConsoleRemoval = true;
        }
        break;
      }
    } catch { /* skip */ }
  }

  return ctx;
}

// ────────────────────────────────────────────────────────────────────
// Main Analysis Entry Point
// ────────────────────────────────────────────────────────────────────

/**
 * Analyzes a single finding in context.
 * Returns an enriched finding with context, fix, and priority info.
 *
 * @param {object} finding - Original scanner finding
 * @param {string} fileContent - Full content of the source file
 * @param {string} filePath - Absolute path to the source file
 * @param {object} repoContext - Repository context from buildRepositoryContext
 * @returns {object} Enriched finding
 */
function analyzeContext(finding, fileContent, filePath, repoContext) {
  try {
    const lines = fileContent ? fileContent.split('\n') : [];
    const lineIndex = (finding.line || 0) - 1; // Convert 1-indexed to 0-indexed

    // Extract code snippet
    const codeSnippet = extractCodeSnippet(lines, lineIndex, CONTEXT_RADIUS);

    // Assess false positive
    const fpResult = assessFalsePositive(finding, fileContent, filePath, lines, lineIndex, repoContext);

    // Generate explanation
    const explanation = generateExplanation(finding, filePath, lines, lineIndex, repoContext);

    // Generate fix
    const fix = generateFix(finding, fileContent, filePath, lines, lineIndex, repoContext);

    return {
      ...finding,
      context: {
        codeSnippet,
        explanation,
        isFalsePositive: fpResult.status === FP_STATUS.LIKELY_FALSE_POSITIVE,
        falsePositiveReason: fpResult.reason,
        confidence: fpResult.confidence,
        status: fpResult.status,
        indicators: fpResult.indicators,
      },
      fix,
    };
  } catch (err) {
    // Never crash the scan because one finding cannot be analyzed
    return {
      ...finding,
      context: {
        codeSnippet: '',
        explanation: finding.recommendation || finding.message || '',
        isFalsePositive: false,
        falsePositiveReason: null,
        confidence: 0.5,
        status: FP_STATUS.UNCERTAIN,
        indicators: [`Analysis error: ${err.message}`],
      },
      fix: { available: false, safeToAutoApply: false, description: null, before: null, after: null, additionalSteps: [] },
    };
  }
}

// ────────────────────────────────────────────────────────────────────
// Code Snippet Extraction
// ────────────────────────────────────────────────────────────────────

function extractCodeSnippet(lines, lineIndex, radius) {
  if (!lines.length || lineIndex < 0) return '';

  const start = Math.max(0, lineIndex - radius);
  const end = Math.min(lines.length - 1, lineIndex + radius);
  const snippetLines = [];

  for (let i = start; i <= end; i++) {
    const marker = i === lineIndex ? ' >> ' : '    ';
    snippetLines.push(`${String(i + 1).padStart(5)}${marker}${lines[i]}`);
  }

  return snippetLines.join('\n');
}

// ────────────────────────────────────────────────────────────────────
// False Positive Detection
// ────────────────────────────────────────────────────────────────────

function assessFalsePositive(finding, fileContent, filePath, lines, lineIndex, repoContext) {
  const indicators = [];
  let fpScore = 0; // Higher = more likely false positive

  const line = lineIndex >= 0 && lineIndex < lines.length ? lines[lineIndex] : '';

  // 1. Comment check
  if (isCommentLine(line)) {
    fpScore += 40;
    indicators.push('Finding is inside a comment');
  }

  // 2. Test file check
  if (isTestFile(filePath)) {
    fpScore += 35;
    indicators.push('Finding is in a test/spec/mock file');
  }

  // 3. Type definition check
  if (isTypeDefinition(filePath, line)) {
    fpScore += 40;
    indicators.push('Finding is in a type/interface definition');
  }

  // 4. __DEV__ guard check
  if (isDevGuarded(lines, lineIndex)) {
    fpScore += 30;
    indicators.push('Finding is inside a __DEV__ conditional block');
  }

  // 5. Environment/config reference check
  if (isEnvReference(line, finding)) {
    fpScore += 45;
    indicators.push('Value appears to be an environment/config reference, not a hardcoded secret');
  }

  // 6. Placeholder/label value check
  if (isPlaceholderValue(line, finding)) {
    fpScore += 40;
    indicators.push('Value appears to be a placeholder, label, or non-sensitive constant');
  }

  // 7. Babel console removal (for LOG-* rules)
  if (finding.rule && finding.rule.startsWith('LOG') && repoContext && repoContext.hasBabelConsoleRemoval) {
    fpScore += 25;
    indicators.push('Project has babel-plugin-transform-remove-console configured');
  }

  // 8. Import statement check
  if (/^\s*import\s/.test(line) && finding.rule && !finding.rule.startsWith('STR-002')) {
    fpScore += 35;
    indicators.push('Finding is on an import statement');
  }

  // Determine status
  let status;
  let confidence;

  if (fpScore >= 60) {
    status = FP_STATUS.LIKELY_FALSE_POSITIVE;
    confidence = Math.min(0.95, 0.5 + (fpScore - 60) / 100);
  } else if (fpScore >= 35) {
    status = FP_STATUS.UNCERTAIN;
    confidence = 0.4 + (fpScore / 200);
  } else if (fpScore >= 15) {
    status = FP_STATUS.LIKELY;
    confidence = 0.7 + (fpScore / 200);
  } else {
    status = FP_STATUS.CONFIRMED;
    confidence = 0.85;
  }

  return {
    status,
    confidence,
    reason: indicators.length > 0 ? indicators[0] : null,
    indicators,
  };
}

function isCommentLine(line) {
  if (!line) return false;
  const trimmed = line.trim();
  return trimmed.startsWith('//') ||
         trimmed.startsWith('*') ||
         trimmed.startsWith('/*') ||
         trimmed.startsWith('#') ||
         trimmed.startsWith('/**');
}

function isTestFile(filePath) {
  if (!filePath) return false;
  const fp = filePath.toLowerCase();
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(fp) ||
         /\/__tests__\//.test(fp) ||
         /\/__mocks__\//.test(fp) ||
         /\/test\//.test(fp) ||
         /\.stories\.(ts|tsx|js|jsx)$/.test(fp);
}

function isTypeDefinition(filePath, line) {
  if (!filePath) return false;
  if (/\.d\.ts$/.test(filePath)) return true;
  if (!line) return false;
  const trimmed = line.trim();
  return /^\s*(?:export\s+)?(?:type|interface)\s/.test(trimmed) ||
         /^\s*(?:export\s+)?declare\s/.test(trimmed);
}

function isDevGuarded(lines, lineIndex) {
  if (!lines || lineIndex < 0) return false;

  // Scan up to 10 lines above for __DEV__ guard
  const searchStart = Math.max(0, lineIndex - 10);
  let braceDepth = 0;

  for (let i = lineIndex; i >= searchStart; i--) {
    const l = lines[i];
    if (!l) continue;

    // Count braces going backward
    for (let c = l.length - 1; c >= 0; c--) {
      if (l[c] === '}') braceDepth++;
      if (l[c] === '{') braceDepth--;
    }

    // If we find __DEV__ at a level that encloses our line
    if (/__DEV__/.test(l) && /if\s*\(\s*__DEV__/.test(l) && braceDepth <= 0) {
      return true;
    }
  }

  return false;
}

function isEnvReference(line, finding) {
  if (!line || !finding) return false;
  // Check if the line references env vars or config objects
  return /(?:process\.env\.|Config\.|ENV\.|import\.meta\.env\.)/.test(line) &&
         !finding.rule?.startsWith('SEC-'); // Don't dismiss SEC rules that matched env patterns
}

function isPlaceholderValue(line, finding) {
  if (!line) return false;
  const ruleId = finding.rule || '';
  // Only applies to secret-type rules
  if (!ruleId.startsWith('SEC-') && !ruleId.startsWith('AUTH-001')) return false;

  return /(?:placeholder|example|sample|test|dummy|mock|fake|xxx|your[_-]?(?:api|key|token)|TODO|FIXME|CHANGEME|REPLACE_ME)/i.test(line);
}

// ────────────────────────────────────────────────────────────────────
// Explanation Generation
// ────────────────────────────────────────────────────────────────────

const EXPLANATIONS = {
  'SEC-001': (f, fp) => `A hardcoded API key was found${fp ? ' (in ' + fp + ')' : ''}. ` +
    'Anyone who decompiles the APK/IPA can extract this key and use it to make authenticated API calls. ' +
    'Keys embedded in the JavaScript bundle are trivially extractable.',

  'SEC-002': (f, fp) => `A hardcoded password or secret was found${fp ? ' (in ' + fp + ')' : ''}. ` +
    'Secrets in source code are visible to anyone with access to the repository or the compiled app bundle.',

  'SEC-003': (f, fp) => `A hardcoded authentication token was found${fp ? ' (in ' + fp + ')' : ''}. ` +
    'Tokens should be fetched at runtime from an auth server, not embedded in source code.',

  'SEC-004': () => 'A private key is embedded in source code. ' +
    'Private keys in the JS bundle can be extracted by anyone who downloads the app. ' +
    'This could allow an attacker to impersonate the app or decrypt sensitive data.',

  'SEC-005': () => 'AWS access key credentials are embedded in the source code. ' +
    'An attacker could use these to access your AWS resources, potentially incurring costs or accessing data.',

  'SEC-006': () => 'Firebase configuration with a secret value is hardcoded in source. ' +
    'Firebase config should live in native config files (google-services.json / GoogleService-Info.plist).',

  'SEC-007': () => 'An encryption key is hardcoded in source code. ' +
    'Anyone who extracts the JS bundle can read this key and decrypt data protected by it.',

  'SEC-008': () => 'A URL contains embedded credentials (user:pass@host). ' +
    'These credentials are visible in source code and potentially in network logs.',

  'STR-001': () => 'Sensitive data (tokens/passwords) is being stored in AsyncStorage, which is unencrypted. ' +
    'On a rooted/jailbroken device, anyone can read AsyncStorage contents.',

  'STR-002': () => 'AsyncStorage is imported. This is informational — verify it is not used for sensitive data like tokens or passwords.',

  'STR-003': () => 'MMKV is created without an encryption key. If sensitive data is stored here, it is readable on rooted devices.',

  'NET-001': (f) => {
    const url = extractUrlFromLine(f.lineContent);
    return `A non-HTTPS URL${url ? ' (' + url + ')' : ''} is used. ` +
      'HTTP traffic can be intercepted and modified by anyone on the same network (man-in-the-middle attack).';
  },

  'NET-002': () => 'SSL/TLS certificate validation is explicitly disabled. ' +
    'This allows man-in-the-middle attacks where an attacker can intercept and modify all traffic between the app and server.',

  'NET-003': () => 'A network request does not have an explicit timeout. ' +
    'Without a timeout, the request could hang indefinitely on poor mobile connections.',

  'NET-004': (f) => {
    const url = extractUrlFromLine(f.lineContent);
    return `An unencrypted WebSocket connection${url ? ' (' + url + ')' : ''} is used. ` +
      'Use wss:// for encrypted WebSocket connections in production.';
  },

  'LOG-001': () => 'An authentication token is being logged to the console. ' +
    'Console output appears in system logs and can be captured by log aggregation tools or accessed on rooted devices.',

  'LOG-002': () => 'A password or credential is being logged to the console. ' +
    'This exposes sensitive authentication data in system logs.',

  'LOG-003': () => 'Sensitive data (tokens/passwords) is passed to a logger. ' +
    'Even custom loggers can leak sensitive data if not properly configured for production.',

  'LOG-004': () => 'A console.log statement exists in production code. ' +
    'Console output is visible in system logs and can leak information about app internals.',

  'AUTH-001': () => 'A hardcoded Bearer token is in an Authorization header. ' +
    'Tokens must be fetched dynamically from secure storage, never hardcoded.',

  'AUTH-002': () => 'An endpoint is configured with skipAuth=true. ' +
    'Verify only truly public endpoints (login, register, health) bypass authentication.',

  'AUTH-004': () => 'Token refresh logic may reuse the same refresh token. ' +
    'Without rotation, a stolen refresh token grants indefinite access.',

  'GEN-001': () => 'eval() is used, which executes arbitrary strings as code. ' +
    'If the input comes from an untrusted source (deep link, WebView, API), this is a direct code injection vector.',

  'GEN-002': () => 'innerHTML or dangerouslySetInnerHTML is used, which can execute injected scripts. ' +
    'If the HTML content comes from an untrusted source, this enables cross-site scripting (XSS).',

  'GEN-005': () => 'A debug mode flag is enabled. If this ships to production, it may expose ' +
    'verbose logging, development endpoints, or bypass security checks.',

  'GEN-006': () => 'A hardcoded IP address is used. This reduces flexibility and may expose ' +
    'internal infrastructure details. Use domain names or environment variables.',

  'GEN-007': () => 'A template literal is used in a SQL query, which is vulnerable to SQL injection. ' +
    'Use parameterized queries instead.',

  'GEN-008': () => 'Math.random() is used, which is not cryptographically secure. ' +
    'For tokens, IDs, or any security-sensitive random values, use crypto.getRandomValues().',

  'CFG-001': () => 'A third-party SDK config (Firebase, Sentry, Maps) contains a secret value hardcoded in a shared config file. ' +
    'These values ship in the JS bundle and are extractable.',

  'CFG-002': () => 'A feature flag is disabling a security control. If this is not gated by __DEV__, ' +
    'it could ship to production and bypass security.',

  'ENV-001': () => 'A sensitive value is present in a .env file. Ensure .env files are in .gitignore ' +
    'and never committed to version control with real secrets.',
};

function generateExplanation(finding, filePath, lines, lineIndex, repoContext) {
  const ruleId = finding.rule || '';
  const generator = EXPLANATIONS[ruleId];

  if (generator) {
    const fileRef = filePath ? path.basename(filePath) : finding.file || '';
    return generator(finding, fileRef);
  }

  // Fallback: construct explanation from available data
  const parts = [];
  if (finding.message) parts.push(finding.message + '.');
  if (finding.recommendation) parts.push(finding.recommendation);
  return parts.join(' ') || 'Security finding detected. Review the flagged code.';
}

function extractUrlFromLine(lineContent) {
  if (!lineContent) return null;
  const match = lineContent.match(/['"`]((?:https?|wss?):\/\/[^'"`\s]+)['"`]/);
  return match ? match[1] : null;
}

// ────────────────────────────────────────────────────────────────────
// Fix Generation
// ────────────────────────────────────────────────────────────────────

const NO_FIX = { available: false, safeToAutoApply: false, description: null, before: null, after: null, additionalSteps: [] };

function generateFix(finding, fileContent, filePath, lines, lineIndex, repoContext) {
  const ruleId = finding.rule || '';
  const line = lineIndex >= 0 && lineIndex < lines.length ? lines[lineIndex] : '';

  try {
    const generator = FIX_GENERATORS[ruleId];
    if (generator) {
      return generator(finding, line, lines, lineIndex, repoContext);
    }

    // Check category-level generators
    for (const [prefix, gen] of Object.entries(FIX_PREFIX_GENERATORS)) {
      if (ruleId.startsWith(prefix)) {
        return gen(finding, line, lines, lineIndex, repoContext);
      }
    }
  } catch {
    // Fix generation failed — return no fix rather than crashing
  }

  return NO_FIX;
}

// ── Rule-specific fix generators ─────────────────────────────────

const FIX_GENERATORS = {
  'NET-001': (finding, line) => {
    // http:// → https:// (safe auto-apply)
    const httpMatch = line.match(/(['"`])(http:\/\/(?!localhost|127\.0\.0\.1|10\.|192\.168\.|0\.0\.0\.0)[^'"`\s]+)(['"`])/);
    if (!httpMatch) return NO_FIX;

    const before = httpMatch[2];
    const after = before.replace('http://', 'https://');

    return {
      available: true,
      safeToAutoApply: true,
      description: 'Replace HTTP with HTTPS',
      before: line.trim(),
      after: line.replace(before, after).trim(),
      additionalSteps: ['Verify the server supports HTTPS at this URL'],
    };
  },

  'NET-002': (finding, line) => {
    // rejectUnauthorized: false → true (safe auto-apply)
    const match = line.match(/(rejectUnauthorized|ssl[_-]?verify)\s*[:=]\s*false/i);
    if (!match) return NO_FIX;

    return {
      available: true,
      safeToAutoApply: true,
      description: 'Enable SSL/TLS certificate validation',
      before: line.trim(),
      after: line.replace(/false/, 'true').trim(),
      additionalSteps: ['Ensure your server has a valid SSL certificate'],
    };
  },

  'NET-004': (finding, line) => {
    // ws:// → wss:// (safe auto-apply)
    const wsMatch = line.match(/(['"`])(ws:\/\/(?!localhost|127\.0\.0\.1)[^'"`\s]+)(['"`])/);
    if (!wsMatch) return NO_FIX;

    const before = wsMatch[2];
    const after = before.replace('ws://', 'wss://');

    return {
      available: true,
      safeToAutoApply: true,
      description: 'Replace ws:// with wss:// (WebSocket Secure)',
      before: line.trim(),
      after: line.replace(before, after).trim(),
      additionalSteps: ['Verify the WebSocket server supports TLS'],
    };
  },

  'GEN-005': (finding, line) => {
    // debugMode: true → debugMode: __DEV__
    const match = line.match(/((?:debugMode|debug_mode|isDebug)\s*[:=]\s*)true/i);
    if (!match) return NO_FIX;

    return {
      available: true,
      safeToAutoApply: false, // Changing behavior — needs review
      description: 'Gate debug mode behind __DEV__ so it is automatically disabled in production builds',
      before: line.trim(),
      after: line.replace(/((?:debugMode|debug_mode|isDebug)\s*[:=]\s*)true/i, '$1__DEV__').trim(),
      additionalSteps: [],
    };
  },

  'CFG-002': (finding, line) => {
    // Security bypass flag → guard with __DEV__
    const match = line.match(/((?:skipAuth|disableSSLPinning|allowInsecure|bypassValidation)\s*[:=]\s*)true/i);
    if (!match) return NO_FIX;

    return {
      available: true,
      safeToAutoApply: false, // Security-critical — needs review
      description: 'Guard security bypass flag with __DEV__ to prevent it from shipping to production',
      before: line.trim(),
      after: line.replace(/((?:skipAuth|disableSSLPinning|allowInsecure|bypassValidation)\s*[:=]\s*)true/i, '$1__DEV__').trim(),
      additionalSteps: ['Review all code paths that depend on this flag'],
    };
  },

  'GEN-001': (finding, line) => {
    return {
      available: true,
      safeToAutoApply: false,
      description: 'Replace eval() with a safer alternative like JSON.parse()',
      before: line.trim(),
      after: line.replace(/\beval\s*\(/, 'JSON.parse(').trim() + ' // TODO: verify this is JSON data',
      additionalSteps: [
        'Verify the input to eval() is JSON data',
        'If it is not JSON, find an alternative that does not execute arbitrary code',
      ],
    };
  },

  'GEN-008': (finding, line) => {
    return {
      available: true,
      safeToAutoApply: false,
      description: 'Replace Math.random() with a cryptographically secure random generator',
      before: line.trim(),
      after: line.replace(/Math\.random\s*\(\s*\)/, 'crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296').trim(),
      additionalSteps: [
        'Import crypto or use react-native-get-random-values polyfill',
        'Verify the security requirement — Math.random() is fine for non-security purposes (animations, UI)',
      ],
    };
  },

  'LOG-004': (finding, line) => {
    const trimmed = line.trim();
    // Only generate fix for standalone console statements
    if (/^\s*console\.\s*(?:log|info|warn|debug|error)\s*\(/.test(line)) {
      const indent = line.match(/^(\s*)/)[1] || '';
      return {
        available: true,
        safeToAutoApply: false, // Changes runtime behavior
        description: 'Wrap console statement in __DEV__ guard so it is stripped in production',
        before: trimmed,
        after: `if (__DEV__) ${trimmed}`,
        additionalSteps: [
          'Alternatively, add babel-plugin-transform-remove-console to your babel config for automatic removal',
        ],
      };
    }
    return NO_FIX;
  },
};

// ── Prefix-based generators (for rule families) ──────────────────

const FIX_PREFIX_GENERATORS = {
  'SEC-': (finding, line, lines, lineIndex, repoContext) => {
    // Hardcoded secrets → replace with env var / secure storage
    const storageLib = repoContext?.hasKeychain ? 'react-native-keychain'
      : repoContext?.hasEncryptedStorage ? 'react-native-encrypted-storage'
      : repoContext?.hasSecureStore ? 'expo-secure-store'
      : null;

    const configLib = repoContext?.hasConfig ? 'react-native-config (Config.X)'
      : 'environment variables (process.env.X)';

    // Try to extract the key name
    const keyMatch = line.match(/(?:api[_-]?key|apikey|password|secret|token|bearer|jwt|auth|encryption[_-]?key|firebase[_-]?key)\s*[:=]\s*/i);
    const keyName = keyMatch ? keyMatch[0].replace(/\s*[:=]\s*$/, '').trim() : 'SECRET_VALUE';
    const envVarName = keyName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

    const additionalSteps = [
      `Add ${envVarName}=<value> to your .env file`,
      `Add ${envVarName}= to .env.example (without the actual value)`,
      'Rotate this secret — it has been in source control',
    ];

    if (repoContext?.hasConfig) {
      return {
        available: true,
        safeToAutoApply: false,
        description: `Move hardcoded secret to environment variable via ${configLib}`,
        before: line.trim(),
        after: line.replace(/['"`][^'"`]{4,}['"`]/, `Config.${envVarName}`).trim(),
        additionalSteps,
      };
    }

    return {
      available: true,
      safeToAutoApply: false,
      description: `Move hardcoded secret to ${configLib}` + (storageLib ? ` or ${storageLib}` : ''),
      before: line.trim(),
      after: line.replace(/['"`][^'"`]{4,}['"`]/, `process.env.${envVarName}`).trim(),
      additionalSteps,
    };
  },

  'LOG-': (finding, line, lines, lineIndex, repoContext) => {
    // Sensitive data logging — remove or guard
    const trimmed = line.trim();

    if (finding.rule === 'LOG-004') return NO_FIX; // Handled by specific generator

    if (/^\s*console\.\w+\s*\(/.test(line)) {
      return {
        available: true,
        safeToAutoApply: false,
        description: 'Remove sensitive data from log statement or wrap in __DEV__ guard',
        before: trimmed,
        after: `if (__DEV__) ${trimmed} // TODO: remove sensitive data from arguments`,
        additionalSteps: [
          'Review what data is being logged',
          'Remove tokens, passwords, and credentials from log arguments',
          'Consider using a redaction wrapper for your logger',
        ],
      };
    }

    return NO_FIX;
  },

  'STR-': (finding, line, lines, lineIndex, repoContext) => {
    const storageLib = repoContext?.hasKeychain ? 'Keychain.setGenericPassword()'
      : repoContext?.hasEncryptedStorage ? 'EncryptedStorage.setItem()'
      : repoContext?.hasMMKV ? 'MMKV with encryptionKey option'
      : 'encrypted storage (e.g. react-native-keychain)';

    return {
      available: true,
      safeToAutoApply: false,
      description: `Replace insecure storage with ${storageLib}`,
      before: line.trim(),
      after: null, // Architecture change — no single-line fix
      additionalSteps: [
        `Install and configure ${storageLib} if not already present`,
        'Migrate all sensitive data (tokens, passwords, keys) to secure storage',
        'Remove sensitive data from AsyncStorage after migration',
      ],
    };
  },

  'NAV-': () => {
    return {
      available: true,
      safeToAutoApply: false,
      description: 'Review navigation security — this requires manual verification of the navigation flow',
      before: null,
      after: null,
      additionalSteps: [
        'Validate and allowlist all deep link routes before navigating',
        'Add auth guards to protected screens',
        'Use HTTPS-only universal links instead of custom URL schemes',
      ],
    };
  },

  'PLAT-': () => NO_FIX,
  'DEP-': () => NO_FIX,
  'SVC-': () => NO_FIX,
  'API-': () => NO_FIX,
};

// ────────────────────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  analyzeContext,
  buildRepositoryContext,
  FP_STATUS,
  CONTEXT_RADIUS,
};
