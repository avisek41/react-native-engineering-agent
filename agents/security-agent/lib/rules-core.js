'use strict';

const { SEVERITY, CATEGORIES } = require('./constants');

// These rule packs run on EVERY file in EVERY scan mode (root, folder, file).
// They are scope-agnostic: a hardcoded secret is a hardcoded secret whether
// it's in services/ or screens/.

const SECRET_PATTERNS = [
  {
    id: 'SEC-001',
    name: 'Hardcoded API Key',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"`]([A-Za-z0-9_\-]{16,})['"`]/gi,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.SECRETS,
    recommendation: 'Move API keys to environment variables (.env files) and use react-native-config to access them. Never commit keys to source control.',
  },
  {
    id: 'SEC-002',
    name: 'Hardcoded Secret/Password',
    pattern: /(?:password|secret|passwd|pwd)\s*[:=]\s*['"`]([^'"`\s]{4,})['"`]/gi,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.SECRETS,
    recommendation: 'Use environment variables or a secure vault (e.g., AWS Secrets Manager). For encryption keys, use react-native-keychain or Expo SecureStore.',
    exclude: /(?:placeholder|label|error|required|min.*length|regex|pattern|validation|PLACEHOLDER|LABEL|PASSWORD_LABEL|PASSWORD_PLACEHOLDER|PASSWORD_REQUIRED|PASSWORD_MIN_LENGTH|FORGOT_PASSWORD|_LABEL|_PLACEHOLDER|_REQUIRED|_ERROR)/i,
  },
  {
    id: 'SEC-003',
    name: 'Hardcoded Token/Bearer',
    pattern: /(?:token|bearer|jwt|auth)\s*[:=]\s*['"`](ey[A-Za-z0-9_\-]{20,})['"`]/gi,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.SECRETS,
    recommendation: 'Tokens should be fetched at runtime from your auth server, never hardcoded. Store tokens securely using react-native-keychain.',
  },
  {
    id: 'SEC-004',
    name: 'Hardcoded Private Key',
    pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.SECRETS,
    recommendation: 'Private keys must never be in source code. Use native keystore (iOS Keychain / Android KeyStore) or a secure backend proxy.',
  },
  {
    id: 'SEC-005',
    name: 'Hardcoded AWS Credentials',
    pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.SECRETS,
    recommendation: 'AWS credentials should be in backend only. Use temporary credentials via AWS STS/Cognito for mobile clients.',
  },
  {
    id: 'SEC-006',
    name: 'Hardcoded Firebase Config',
    pattern: /(?:firebase|fcm)[_-]?(?:key|token|secret)\s*[:=]\s*['"`]([^'"`]{10,})['"`]/gi,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.SECRETS,
    recommendation: 'Firebase config should live in google-services.json (Android) / GoogleService-Info.plist (iOS), not in JS source.',
  },
  {
    id: 'SEC-007',
    name: 'Generic Encryption Key in Source',
    pattern: /(?:encryption[_-]?key|encrypt[_-]?key|cipher[_-]?key|aes[_-]?key)\s*[:=]\s*['"`]([^'"`]{4,})['"`]/gi,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.SECRETS,
    recommendation: 'Encryption keys must be stored server-side or in the native keychain, never in JS bundle. Anyone can extract them from the APK/IPA.',
  },
  {
    id: 'SEC-008',
    name: 'URL with Embedded Credentials',
    pattern: /https?:\/\/[^:]+:[^@]+@/g,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.SECRETS,
    recommendation: 'Never embed credentials in URLs. Use Authorization headers or OAuth tokens instead.',
  },
];

const STORAGE_PATTERNS = [
  {
    id: 'STR-001',
    name: 'AsyncStorage for Sensitive Data',
    pattern: /AsyncStorage\s*\.\s*(?:setItem|multiSet)\s*\(\s*['"`](?:.*(?:token|password|secret|key|session|auth|credential).*?)['"`]/gi,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.STORAGE,
    recommendation: 'AsyncStorage is unencrypted. Use react-native-keychain, react-native-encrypted-storage, or MMKV with encryption for sensitive data.',
  },
  {
    id: 'STR-002',
    name: 'AsyncStorage Import (Potential Misuse)',
    pattern: /import\s+.*AsyncStorage.*from\s+['"`]@react-native-async-storage/gi,
    severity: SEVERITY.LOW,
    category: CATEGORIES.STORAGE,
    recommendation: 'Audit all AsyncStorage usage — ensure it is only used for non-sensitive, non-PII data. Use encrypted alternatives for anything sensitive.',
  },
  {
    id: 'STR-003',
    name: 'MMKV Without Encryption for Secrets',
    pattern: /createMMKV\s*\(\s*\{[^}]*\}\s*\)/gs,
    severity: SEVERITY.MEDIUM,
    category: CATEGORIES.STORAGE,
    recommendation: 'MMKV is faster than AsyncStorage but not encrypted by default. Use `encryptionKey` option for MMKV instances storing auth tokens or sensitive data.',
  },
  {
    id: 'STR-004',
    name: 'Plaintext Token Storage Key',
    pattern: /(?:access_token|refresh_token|auth_token|session_token)\s*['"`]/gi,
    severity: SEVERITY.INFO,
    category: CATEGORIES.STORAGE,
    recommendation: 'Ensure these token keys reference encrypted storage, not plaintext AsyncStorage.',
  },
  {
    id: 'STR-005',
    name: 'Zustand/Redux persist() Without Encrypted Storage Engine',
    pattern: /persist\s*\(\s*[\s\S]{0,300}?\)/g,
    severity: SEVERITY.MEDIUM,
    category: CATEGORIES.STORAGE,
    recommendation: 'If this persisted store contains tokens, PII, or payment data, supply an encrypted storage adapter (e.g. react-native-encrypted-storage) via the `storage` option instead of the default AsyncStorage-backed one.',
  },
];

const NETWORK_PATTERNS = [
  {
    id: 'NET-001',
    name: 'HTTP URL (Non-HTTPS)',
    pattern: /['"`]http:\/\/(?!localhost|127\.0\.0\.1|10\.|192\.168\.|0\.0\.0\.0)[^'"`\s]+['"`]/g,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.NETWORK,
    recommendation: 'Always use HTTPS for production APIs. Enforce via App Transport Security (iOS) and cleartextTrafficPermitted=false (Android).',
  },
  {
    id: 'NET-002',
    name: 'Disabled SSL Validation',
    pattern: /(?:rejectUnauthorized|ssl[_-]?verify)\s*[:=]\s*false/gi,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.NETWORK,
    recommendation: 'Never disable SSL certificate validation in production. This enables Man-in-the-Middle attacks.',
  },
  {
    id: 'NET-003',
    name: 'Missing Request Timeout',
    pattern: /fetch\s*\([^)]+\)\s*(?!.*timeout)/g,
    severity: SEVERITY.LOW,
    category: CATEGORIES.NETWORK,
    recommendation: 'Set request timeouts to prevent indefinite hanging connections. Use AbortController or a fetch wrapper with timeout.',
  },
  {
    id: 'NET-004',
    name: 'WebSocket Without TLS',
    pattern: /['"`]ws:\/\/(?!localhost|127\.0\.0\.1)[^'"`]+['"`]/g,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.NETWORK,
    recommendation: 'Use wss:// (WebSocket Secure) instead of ws:// for production WebSocket connections.',
  },
];

const LOGGING_PATTERNS = [
  {
    id: 'LOG-001',
    name: 'Token Logged to Console',
    pattern: /console\.\w+\s*\([^)]*(?:token|jwt|bearer|accessToken|refreshToken|access_token|refresh_token)[^)]*\)/gi,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.LOGGING,
    recommendation: 'Never log tokens to console — they appear in system logs and can be captured by log aggregation tools. Use a production-safe logger that strips sensitive data.',
  },
  {
    id: 'LOG-002',
    name: 'Password Logged to Console',
    pattern: /console\.\w+\s*\([^)]*(?:password|passwd|pwd|secret|credential)[^)]*\)/gi,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.LOGGING,
    recommendation: 'Never log passwords or credentials. Implement a logger that redacts sensitive fields automatically.',
  },
  {
    id: 'LOG-003',
    name: 'Logger with Sensitive Data',
    pattern: /logger\.\w+\s*\([^)]*(?:refreshToken|accessToken|password|secret|credential)[^)]*\)/gi,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.LOGGING,
    recommendation: 'Even custom loggers should not log sensitive tokens. Use a redaction wrapper or ensure these logs are disabled in production builds.',
  },
  {
    id: 'LOG-004',
    name: 'Console.log in Production Code',
    pattern: /console\.\s*(?:log|info|warn|debug|error)\s*\(/g,
    severity: SEVERITY.LOW,
    category: CATEGORIES.LOGGING,
    recommendation: 'Remove or gate console.log statements behind __DEV__. Use babel-plugin-transform-remove-console for production builds.',
  },
];

const AUTH_PATTERNS = [
  {
    id: 'AUTH-001',
    name: 'Insecure Token in Authorization Header (Hardcoded)',
    pattern: /Authorization['"`:]\s*['"`]Bearer\s+[A-Za-z0-9_\-]{20,}['"`]/gi,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.AUTH,
    recommendation: 'Authorization tokens must be fetched dynamically from secure storage, never hardcoded in headers.',
  },
  {
    id: 'AUTH-002',
    name: 'Missing Auth Check (skipAuth=true)',
    pattern: /skipAuth\s*[:=]\s*true/g,
    severity: SEVERITY.INFO,
    category: CATEGORIES.AUTH,
    recommendation: 'Review all endpoints with skipAuth=true. Ensure only truly public endpoints (login, register, health check) bypass auth.',
  },
  {
    id: 'AUTH-004',
    name: 'Token Refresh Without Rotation',
    pattern: /refreshToken\s*\?\?\s*refreshToken|nextRefreshToken.*\?\?\s*refreshToken/g,
    severity: SEVERITY.MEDIUM,
    category: CATEGORIES.AUTH,
    recommendation: 'Implement refresh token rotation — each refresh should issue a NEW refresh token. Reusing old refresh tokens enables replay attacks.',
  },
];

const GENERAL_PATTERNS = [
  {
    id: 'GEN-001',
    name: 'eval() Usage',
    pattern: /\beval\s*\(/g,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.GENERAL,
    recommendation: 'Never use eval() — it enables code injection attacks. Use JSON.parse() for data, or Function constructor as a last resort.',
  },
  {
    id: 'GEN-002',
    name: 'innerHTML / dangerouslySetInnerHTML',
    pattern: /(?:innerHTML|dangerouslySetInnerHTML)/g,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.GENERAL,
    recommendation: 'Avoid innerHTML — it enables XSS attacks. Sanitize HTML content with DOMPurify or use React\'s built-in escaping.',
  },
  {
    id: 'GEN-005',
    name: 'Debug Mode Enabled',
    pattern: /(?:debugMode|debug_mode|isDebug)\s*[:=]\s*true/gi,
    severity: SEVERITY.MEDIUM,
    category: CATEGORIES.GENERAL,
    recommendation: 'Ensure debug mode is disabled in production builds. Use __DEV__ global for conditional debug logic.',
  },
  {
    id: 'GEN-006',
    name: 'Hardcoded IP Address',
    pattern: /['"`]\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?['"`]/g,
    severity: SEVERITY.MEDIUM,
    category: CATEGORIES.GENERAL,
    recommendation: 'Avoid hardcoded IP addresses. Use domain names with proper DNS, or environment variables for dynamic configuration.',
    exclude: /(?:127\.0\.0\.1|0\.0\.0\.0|localhost|255\.255)/,
  },
  {
    id: 'GEN-007',
    name: 'SQL Injection Risk (Template Literal in Query)',
    pattern: /(?:query|execute|sql)\s*\(\s*`[^`]*\$\{/gi,
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.GENERAL,
    recommendation: 'Never use template literals for SQL queries — use parameterized queries to prevent SQL injection.',
  },
  {
    id: 'GEN-008',
    name: 'Math.random for Security',
    pattern: /Math\.random\s*\(\s*\)/g,
    severity: SEVERITY.MEDIUM,
    category: CATEGORIES.GENERAL,
    recommendation: 'Math.random() is not cryptographically secure. Use crypto.getRandomValues() or react-native-get-random-values for tokens/IDs.',
  },
  {
    id: 'GEN-004',
    name: 'Environment File Committed',
    pattern: /^\.env(?:\.(?:development|staging|production|uat|local))?$/,
    severity: SEVERITY.HIGH,
    category: CATEGORIES.GENERAL,
    recommendation: 'Ensure .env files are in .gitignore. Never commit environment files with real secrets to version control.',
    fileNameMatch: true,
  },
];

// Rules that apply to every file regardless of scan mode/domain.
const CORE_RULES = [
  ...SECRET_PATTERNS,
  ...STORAGE_PATTERNS,
  ...NETWORK_PATTERNS,
  ...LOGGING_PATTERNS,
  ...AUTH_PATTERNS,
  ...GENERAL_PATTERNS.filter(r => !r.fileNameMatch),
];

const FILENAME_RULES = GENERAL_PATTERNS.filter(r => r.fileNameMatch);

module.exports = {
  SECRET_PATTERNS,
  STORAGE_PATTERNS,
  NETWORK_PATTERNS,
  LOGGING_PATTERNS,
  AUTH_PATTERNS,
  GENERAL_PATTERNS,
  CORE_RULES,
  FILENAME_RULES,
};
