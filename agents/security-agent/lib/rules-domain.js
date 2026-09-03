'use strict';

const { SEVERITY, CATEGORIES } = require('./constants');

/**
 * DOMAIN_RULES: extra per-file pattern rules layered on top of CORE_RULES
 * when a file lives inside a recognized folder. These run in BOTH root
 * mode (because root scans everything, including these folders) and
 * folder mode (when scanning that folder directly).
 *
 * DOMAIN_INVERSE_CHECKS: "should exist somewhere in this domain but
 * doesn't" checks — the folder-scoped equivalent of project-wide
 * inverse checks. In ROOT mode these are checked against the whole
 * codebase too (merged with PLATFORM_INVERSE_CHECKS). In FOLDER mode
 * they are checked against just that folder's concatenated content,
 * which is the fix for the false-positive problem you ran into:
 * services/ is no longer judged on root/jailbreak detection, only on
 * things that actually belong in a service layer.
 */

const navigation = {
  rules: [
    {
      id: 'NAV-001',
      name: 'Deep Link Handler Without Validation',
      pattern: /Linking\.addEventListener\s*\(\s*['"`]url['"`]/g,
      severity: SEVERITY.MEDIUM,
      category: CATEGORIES.NAVIGATION,
      recommendation: 'Validate and allow-list incoming deep link routes/params before navigating. Untrusted input from a URL should never directly drive navigation.navigate() without checking it against a known route table.',
    },
    {
      id: 'NAV-002',
      name: 'getInitialURL Used Without Sanitization',
      pattern: /Linking\.getInitialURL\s*\(\s*\)/g,
      severity: SEVERITY.LOW,
      category: CATEGORIES.NAVIGATION,
      recommendation: 'Treat the cold-start deep link URL as untrusted input. Parse and validate it the same way as runtime deep links.',
    },
    {
      id: 'NAV-003',
      name: 'Sensitive Screen Reachable via Deep Link Without Auth Guard',
      pattern: /screens\s*:\s*\{[^}]*(?:payment|checkout|admin|settings|profile|wallet|account)[^}]*\}/gi,
      severity: SEVERITY.HIGH,
      category: CATEGORIES.NAVIGATION,
      recommendation: 'Screens handling payments, admin functions, or account data should not be directly reachable via a public deep link path without an auth/session guard in the navigator (e.g. redirect to login if unauthenticated).',
    },
    {
      id: 'NAV-004',
      name: 'navigate() Called With Unvalidated Dynamic Route',
      pattern: /navigat(?:e|ionRef)\.\s*navigate\s*\(\s*[a-zA-Z_][\w.]*\s*\)/g,
      severity: SEVERITY.MEDIUM,
      category: CATEGORIES.NAVIGATION,
      recommendation: 'Navigating with a variable route name (rather than a string literal) risks open navigation / route injection if that variable originates from a deep link, push notification payload, or WebView postMessage. Validate against a known route allow-list first.',
    },
    {
      id: 'NAV-005',
      name: 'Universal Link / App Link prefix without HTTPS-only enforcement',
      pattern: /prefixes\s*:\s*\[[^\]]*\]/g,
      severity: SEVERITY.LOW,
      category: CATEGORIES.NAVIGATION,
      recommendation: 'Ensure associated domains (iOS) / intent-filters (Android) are configured so only your verified HTTPS universal links can trigger deep navigation — custom URL schemes (e.g. myapp://) can be registered by any app and are spoofable.',
    },
  ],
  inverseChecks: [
    {
      id: 'NAV-INV-001',
      name: 'No Deep Link Parameter Validation Utility Found',
      test: (content) => !/validat(?:e|ion)(?:Deep|Route|Link|Url)/i.test(content) && /Linking\.(?:addEventListener|getInitialURL)/.test(content),
      severity: SEVERITY.MEDIUM,
      category: CATEGORIES.NAVIGATION,
      recommendation: 'Add a dedicated route/param validation function that every deep link and push-notification-triggered navigation passes through before reaching navigation.navigate().',
    },
    {
      id: 'NAV-INV-002',
      name: 'No Auth Guard Detected in Navigation Layer',
      test: (content) => !/(?:isAuthenticated|requireAuth|authGuard|AuthGate|protectedRoute)/i.test(content),
      severity: SEVERITY.HIGH,
      category: CATEGORIES.NAVIGATION,
      recommendation: 'Add an authentication guard at the navigator level (e.g. a wrapper that redirects to Login if no valid session) so protected screens can never be reached by direct navigation or deep link while unauthenticated.',
    },
  ],
};

const services = {
  rules: [
    {
      id: 'SVC-001',
      name: 'Service Function Missing Error Boundary for Network Failure',
      pattern: /export\s+(?:async\s+)?function\s+\w+[\s\S]{0,150}?fetch\s*\(/g,
      severity: SEVERITY.LOW,
      category: CATEGORIES.API,
      recommendation: 'Wrap service-layer network calls in try/catch with explicit handling for timeouts, 401s (trigger refresh/logout), and 5xx (retry/backoff). Unhandled rejections in services surface as raw crashes or silent failures in screens.',
    },
    {
      id: 'SVC-002',
      name: 'Token Refresh Logic Without Concurrency Lock',
      pattern: /refresh(?:Token|Session)\s*\([^)]*\)\s*\{/g,
      severity: SEVERITY.MEDIUM,
      category: CATEGORIES.AUTH,
      recommendation: 'Multiple simultaneous 401s can trigger parallel refresh calls, racing to invalidate each other\'s tokens. Use a single in-flight refresh promise (mutex pattern) shared across all callers.',
    },
    {
      id: 'SVC-003',
      name: 'No Retry/Backoff Strategy Visible on Network Service',
      pattern: /axios\.(?:create|get|post|put|delete)|fetch\s*\(/g,
      severity: SEVERITY.INFO,
      category: CATEGORIES.API,
      recommendation: 'Consider exponential backoff for transient network failures (common on mobile networks), especially for critical calls like score updates or payment confirmation.',
    },
  ],
  inverseChecks: [
    {
      id: 'SVC-INV-001',
      name: 'No Certificate Pinning Hook in Service Layer',
      test: (content) => /fetch\s*\(|axios/.test(content) && !/ssl[_-]?pinn|certificate[_-]?pinn|TrustKit/i.test(content),
      severity: SEVERITY.LOW,
      category: CATEGORIES.API,
      recommendation: 'If this service layer is responsible for API calls to your backend, ensure the underlying HTTP client (axios instance / fetch wrapper) is configured to use certificate pinning, typically set up once in api/ or configs/ and consumed here.',
    },
    {
      id: 'SVC-INV-002',
      name: 'No Centralized Error/Retry Interceptor Detected',
      test: (content) => !/interceptor|onError|retry/i.test(content),
      severity: SEVERITY.LOW,
      category: CATEGORIES.API,
      recommendation: 'Consider a centralized response interceptor (in api/ or here) to handle 401 → refresh → retry, rather than duplicating that logic in every service function.',
    },
  ],
};

const screens = {
  rules: [
    {
      id: 'SCR-001',
      name: 'Sensitive Input Field Without secureTextEntry',
      pattern: /<TextInput\s+[^>]*(?:placeholder\s*=\s*['"`][^'"`]*(?:password|pin|cvv|ssn)[^'"`]*['"`])[^>]*>/gi,
      severity: SEVERITY.MEDIUM,
      category: CATEGORIES.COMPONENTS,
      recommendation: 'Add secureTextEntry={true} to any TextInput collecting passwords, PINs, or card security codes so the value is masked on screen.',
      contextExclude: /secureTextEntry/,
    },
    {
      id: 'SCR-002',
      name: 'Card/Payment Field Rendered Without Screenshot Protection',
      pattern: /(?:cardNumber|cvv|cardExpiry|CardForm|PaymentScreen)/gi,
      severity: SEVERITY.LOW,
      category: CATEGORIES.COMPONENTS,
      recommendation: 'Screens displaying full card numbers or payment details should disable screenshots/screen recording (FLAG_SECURE on Android, isSecure on iOS) to prevent capture of sensitive financial data.',
    },
    {
      id: 'SCR-003',
      name: 'Form Submission Without Client-Side Validation Library',
      pattern: /<TextInput[\s\S]{0,100}?onChangeText/g,
      severity: SEVERITY.INFO,
      category: CATEGORIES.COMPONENTS,
      recommendation: 'Use a validation layer (e.g. zod, yup) for all form screens, especially anything feeding into auth or payment flows, to reject malformed input before it reaches your services/API layer.',
    },
  ],
  inverseChecks: [
    {
      id: 'SCR-INV-001',
      name: 'No Screenshot Protection Reference in Sensitive Screens',
      test: (content) => /(?:payment|card|cvv|wallet|checkout)/i.test(content) && !/FLAG_SECURE|screenshot|preventScreenCapture|isSecure/i.test(content),
      severity: SEVERITY.LOW,
      category: CATEGORIES.COMPONENTS,
      recommendation: 'This folder contains payment/financial screens but no screenshot-protection reference was found. Add FLAG_SECURE (Android) / screen capture prevention (iOS) on those specific screens.',
    },
  ],
};

const components = {
  rules: [
    {
      id: 'CMP-001',
      name: 'WebView with javaScriptEnabled and No originWhitelist Restriction',
      pattern: /javaScriptEnabled\s*[:=]\s*\{?\s*true/g,
      severity: SEVERITY.MEDIUM,
      category: CATEGORIES.COMPONENTS,
      recommendation: 'Restrict WebView navigation with originWhitelist set to specific trusted domains (never [\'*\']). Combine with onShouldStartLoadWithRequest to block unexpected navigations.',
    },
    {
      id: 'CMP-002',
      name: 'WebView originWhitelist Wildcard',
      pattern: /originWhitelist\s*=\s*\{?\s*\[\s*['"`]\*['"`]\s*\]/g,
      severity: SEVERITY.HIGH,
      category: CATEGORIES.COMPONENTS,
      recommendation: 'originWhitelist=["*"] allows the WebView to navigate to ANY domain, defeating the purpose of the whitelist. Restrict to your specific trusted domain(s) (e.g. payment processor domain only).',
    },
    {
      id: 'CMP-003',
      name: 'WebView onMessage Handler Executes Untrusted Content',
      pattern: /onMessage\s*=\s*\{[\s\S]{0,200}?(?:eval|Function)\s*\(/g,
      severity: SEVERITY.CRITICAL,
      category: CATEGORIES.COMPONENTS,
      recommendation: 'Never eval() or construct Functions from WebView postMessage data — this is a direct remote code execution vector if the WebView content is ever compromised (e.g. via a MITM\'d payment provider page). Parse with JSON.parse and validate a strict schema instead.',
    },
    {
      id: 'CMP-004',
      name: 'Unvalidated Props Passed Directly to Native Bridge',
      pattern: /NativeModules\.\w+\.\w+\s*\([^)]*props\./g,
      severity: SEVERITY.LOW,
      category: CATEGORIES.COMPONENTS,
      recommendation: 'Validate/sanitize props before passing them across the JS-to-native bridge to avoid unexpected native-side behavior from malformed input.',
    },
  ],
  inverseChecks: [
    {
      id: 'CMP-INV-001',
      name: 'WebView Used Without Any onShouldStartLoadWithRequest Guard',
      test: (content) => /<WebView/.test(content) && !/onShouldStartLoadWithRequest/.test(content),
      severity: SEVERITY.MEDIUM,
      category: CATEGORIES.COMPONENTS,
      recommendation: 'Add onShouldStartLoadWithRequest to every WebView to block navigation to unexpected/unapproved URLs (a common phishing and redirect vector).',
    },
  ],
};

const store = {
  rules: [
    {
      id: 'STA-001',
      name: 'Redux/Zustand persist() Storing Auth State',
      pattern: /persist\s*\([\s\S]{0,400}?(?:token|auth|session|user)/gi,
      severity: SEVERITY.MEDIUM,
      category: CATEGORIES.STATE,
      recommendation: 'If the persisted slice includes tokens or session data, point the persist `storage` option at an encrypted adapter, or use a transform/partialize to strip sensitive fields before they\'re written to disk.',
    },
    {
      id: 'STA-002',
      name: 'Redux Store Without Sensitive-Field Redaction in DevTools',
      pattern: /configureStore\s*\(/g,
      severity: SEVERITY.LOW,
      category: CATEGORIES.STATE,
      recommendation: 'Redux DevTools can expose full state (including tokens) in dev builds and sometimes leak into staging. Ensure devTools is disabled in production (configureStore({ devTools: __DEV__ })) and consider a redaction middleware for sensitive fields.',
    },
    {
      id: 'STA-003',
      name: 'Selector Exposes Full User Object Including Sensitive Fields',
      pattern: /selectUser\s*=\s*\([^)]*\)\s*=>\s*state\.\w+\.user\b(?!\.\w)/g,
      severity: SEVERITY.INFO,
      category: CATEGORIES.STATE,
      recommendation: 'Prefer narrow selectors (selectUserDisplayName, selectUserId) over returning the entire user object, which may carry PII or payment metadata into components that don\'t need it.',
    },
  ],
  inverseChecks: [
    {
      id: 'STA-INV-001',
      name: 'persist() Found Without Explicit Encrypted Storage Adapter',
      test: (content) => /persist\s*\(/.test(content) && !/encrypted|EncryptedStorage|SecureStore|keychain/i.test(content),
      severity: SEVERITY.MEDIUM,
      category: CATEGORIES.STATE,
      recommendation: 'No encrypted storage adapter reference found alongside persist(). If any persisted slice contains tokens or PII, the default AsyncStorage-backed persistence is unencrypted on disk.',
    },
  ],
};

const api = {
  rules: [
    {
      id: 'API-001',
      name: 'Axios Instance Without baseURL Enforcement (Open to Override)',
      pattern: /axios\.create\s*\(\s*\{(?![^}]*baseURL)/g,
      severity: SEVERITY.LOW,
      category: CATEGORIES.API,
      recommendation: 'Set baseURL explicitly on the axios instance so individual call sites cannot accidentally (or maliciously, via injected config) redirect requests to an arbitrary host.',
    },
    {
      id: 'API-002',
      name: 'Request Interceptor Attaches Token Without Expiry Check',
      pattern: /interceptors\.request\.use\s*\([\s\S]{0,200}?(?:Authorization|Bearer)/g,
      severity: SEVERITY.LOW,
      category: CATEGORIES.API,
      recommendation: 'Check token expiry in the request interceptor and proactively refresh before attaching an expired token, rather than waiting for a 401 to trigger reactive refresh.',
    },
    {
      id: 'API-003',
      name: 'Response Interceptor Missing 401 Handling',
      pattern: /interceptors\.response\.use\s*\(/g,
      severity: SEVERITY.INFO,
      category: CATEGORIES.API,
      recommendation: 'Ensure the response interceptor handles 401 (trigger token refresh + retry or logout) and avoids leaking raw server error bodies to the UI layer.',
    },
  ],
  inverseChecks: [
    {
      id: 'API-INV-001',
      name: 'No Certificate Pinning Configuration in HTTP Client Setup',
      test: (content) => !/ssl[_-]?pinn|certificate[_-]?pinn|TrustKit|react-native-ssl-pinning/i.test(content),
      severity: SEVERITY.LOW,
      category: CATEGORIES.API,
      recommendation: 'This is typically where certificate pinning gets configured (the central HTTP client). No pinning setup detected — strongly recommended for any app handling auth tokens or payment flows.',
    },
  ],
};

const context = {
  rules: [
    {
      id: 'CTX-001',
      name: 'AuthContext Storing Raw Token in React State Without Secure Backing',
      pattern: /createContext\s*\([\s\S]{0,100}?(?:token|session)/gi,
      severity: SEVERITY.LOW,
      category: CATEGORIES.STATE,
      recommendation: 'In-memory context state for tokens is fine, but ensure the source of truth on app restart is secure storage (keychain), not AsyncStorage, and that the context doesn\'t get accidentally logged via context devtools.',
    },
  ],
  inverseChecks: [],
};

const configs = {
  rules: [
    {
      id: 'CFG-001',
      name: 'Firebase/Sentry/Maps Config With Inline Secret',
      pattern: /(?:apiKey|clientSecret|authDomain)\s*[:=]\s*['"`][^'"`]{10,}['"`]/gi,
      severity: SEVERITY.HIGH,
      category: CATEGORIES.CONFIG,
      recommendation: 'Third-party SDK config keys (Firebase, Sentry DSN, Maps) should be injected via environment variables / native config files, not hardcoded in a shared configs/ file that ships in the JS bundle.',
    },
    {
      id: 'CFG-002',
      name: 'Feature Flag Hardcoded to Bypass Security Control',
      pattern: /(?:skipAuth|disableSSLPinning|allowInsecure|bypassValidation)\s*[:=]\s*true/gi,
      severity: SEVERITY.CRITICAL,
      category: CATEGORIES.CONFIG,
      recommendation: 'A feature flag is disabling a security control. Confirm this is dev-only (gated by __DEV__ or a build-time env check) and cannot ship to production accidentally.',
    },
  ],
  inverseChecks: [],
};

const DOMAIN_PACKS = {
  navigation,
  services,
  screens,
  components,
  store,
  api,
  context,
  configs,
};

function getDomainPack(domain) {
  return DOMAIN_PACKS[domain] || { rules: [], inverseChecks: [] };
}

module.exports = { DOMAIN_PACKS, getDomainPack };
