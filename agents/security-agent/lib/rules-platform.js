'use strict';

const { SEVERITY, CATEGORIES, HIGH_SEVERITY_APP_TYPES } = require('./constants');

/**
 * These checks ONLY make sense at ROOT scope. They were the source of
 * the original false-positive problem: root/jailbreak detection,
 * obfuscation, and biometric setup are app-wide, cross-cutting
 * concerns, almost never localized to a single feature folder.
 *
 * Running these against a folder like `services` or `navigation` and
 * reporting "missing" is a category error — so FOLDER mode no longer
 * runs this file at all. Only ROOT mode does.
 */
function getPlatformInverseChecks(appType) {
  const isHighSecurity = HIGH_SEVERITY_APP_TYPES.includes(appType);
  const certPinningSeverity = isHighSecurity ? SEVERITY.HIGH : SEVERITY.LOW;
  const certPinningRec = isHighSecurity
    ? 'Implement SSL certificate pinning using react-native-ssl-pinning or TrustKit to prevent MITM attacks. Critical for financial/health apps.'
    : 'Certificate pinning is recommended for banking, fintech, payment, healthcare, government, and other high-security applications. For sports and general business applications using HTTPS/TLS, this finding should be treated as a defense-in-depth recommendation rather than a mandatory security requirement.';

  const generalSecuritySeverity = isHighSecurity ? SEVERITY.HIGH : SEVERITY.LOW;

  return [
    {
      id: 'PLAT-001',
      name: 'No Certificate Pinning Detected',
      test: (content) => !/certificate[_-]?pinn/i.test(content) && !/ssl[_-]?pinn/i.test(content),
      severity: certPinningSeverity,
      category: CATEGORIES.PLATFORM,
      recommendation: certPinningRec,
    },
    {
      id: 'PLAT-002',
      name: 'No Code Obfuscation Detected',
      test: (content) => !/ProGuard|R8|obfuscat/i.test(content),
      severity: generalSecuritySeverity,
      category: CATEGORIES.PLATFORM,
      recommendation: 'Enable ProGuard/R8 for Android and consider Hermes bytecode for additional obfuscation. Use react-native-obfuscating-transformer for JS.',
    },
    {
      id: 'PLAT-003',
      name: 'No Root/Jailbreak Detection',
      test: (content) => !/jailbreak|root[_-]?detect|isRooted|isJailbroken/i.test(content),
      severity: generalSecuritySeverity,
      category: CATEGORIES.PLATFORM,
      recommendation: 'Implement root/jailbreak detection using react-native-jail-monkey or jail-break-check for production apps handling sensitive data.',
    },
    {
      id: 'PLAT-004',
      name: 'No Screenshot Protection Anywhere in App',
      test: (content) => !/screenshot|screencapture|FLAG_SECURE/i.test(content),
      severity: SEVERITY.LOW,
      category: CATEGORIES.PLATFORM,
      recommendation: 'Consider preventing screenshots on sensitive screens (e.g., payment, profile) using FLAG_SECURE (Android) or screen capture prevention.',
    },
    {
      id: 'PLAT-005',
      name: 'No Biometric Authentication Implemented',
      test: (content) => !/(?:biometric|fingerprint|faceId|touchId)/i.test(content),
      severity: SEVERITY.INFO,
      category: CATEGORIES.PLATFORM,
      recommendation: 'Consider implementing biometric authentication for sensitive operations (payments, profile changes). Use react-native-biometrics.',
    },
    {
      id: 'PLAT-006',
      name: 'No Token Expiry Check Implemented Anywhere',
      test: (content) => !/(?:jwtDecode|jwt_decode|decodeToken|tokenExpir)/i.test(content),
      severity: SEVERITY.MEDIUM,
      category: CATEGORIES.PLATFORM,
      recommendation: 'Check token expiry before making API calls. Proactively refresh tokens before they expire to prevent 401 cascades.',
    },
  ];
}

module.exports = { getPlatformInverseChecks };
