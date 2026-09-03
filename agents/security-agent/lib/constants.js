'use strict';

// ────────────────────────────────────────────────────────────────────
// Severity Levels
// ────────────────────────────────────────────────────────────────────
const SEVERITY = {
  CRITICAL: { level: 4, label: 'CRITICAL', emoji: '🔴', color: '#dc2626' },
  HIGH: { level: 3, label: 'HIGH', emoji: '🟠', color: '#ea580c' },
  MEDIUM: { level: 2, label: 'MEDIUM', emoji: '🟡', color: '#ca8a04' },
  LOW: { level: 1, label: 'LOW', emoji: '🔵', color: '#2563eb' },
  INFO: { level: 0, label: 'INFO', emoji: '⚪', color: '#6b7280' },
};

// ────────────────────────────────────────────────────────────────────
// Categories
// ────────────────────────────────────────────────────────────────────
const CATEGORIES = {
  SECRETS: '🔑 Hardcoded Secrets',
  STORAGE: '💾 Insecure Storage',
  NETWORK: '🌐 Network Security',
  DEPS: '📦 Dependency Vulnerabilities',
  LOGGING: '📝 Sensitive Data Logging',
  AUTH: '🔐 Authentication Issues',
  NAVIGATION: '🗺️ Navigation & Deep Links',
  STATE: '💾 State Management',
  COMPONENTS: '🧩 Component / WebView Security',
  API: '🌐 API Layer Security',
  CONFIG: '⚙️ Configuration Security',
  GENERAL: '🛡️ General Security',
  PLATFORM: '📱 Platform Hardening (Root-Level)',
};

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.env'];
const IGNORE_DIRS = [
  'node_modules', '.git', 'android', 'ios', 'build', 'dist',
  'coverage', '__tests__', '__mocks__', 'vendor', '.bundle', '.expo',
];

// ────────────────────────────────────────────────────────────────────
// Folder Taxonomy — maps known RN architecture folders to a "domain"
// Used to decide which folder-specific rule pack + which subset of
// project-wide inverse checks are meaningful for a FOLDER-level scan.
// ────────────────────────────────────────────────────────────────────
const FOLDER_DOMAINS = {
  api: 'api',
  assets: 'assets',
  components: 'components',
  configs: 'configs',
  config: 'configs',
  constant: 'constants',
  constants: 'constants',
  context: 'context',
  features: 'features',
  hooks: 'hooks',
  layouts: 'layouts',
  navigation: 'navigation',
  screens: 'screens',
  services: 'services',
  store: 'store',
  styles: 'styles',
  theme: 'theme',
  types: 'types',
  utils: 'utils',
};

// Domains that are purely structural/non-executable-risk and can be
// skipped quickly (still scanned for generic secrets, just no
// domain-specific rule pack or inverse checks apply).
const LOW_RISK_DOMAINS = new Set(['assets', 'styles', 'theme', 'types', 'constants']);

// High-security app types get stricter severity on certain root-level
// inverse checks (cert pinning, obfuscation, etc).
const HIGH_SEVERITY_APP_TYPES = [
  'finance', 'fintech', 'banking', 'payment', 'healthcare', 'medical', 'government',
];

// ────────────────────────────────────────────────────────────────────
// Compliance Mapping — maps rule IDs to compliance framework controls.
// Only applied when a user enables complianceFrameworks in config.
// ────────────────────────────────────────────────────────────────────
const COMPLIANCE_MAP = {
  'OWASP-MASVS': {
    // Secrets
    'SEC-001': ['MASVS-STORAGE-1', 'MASVS-STORAGE-2'],
    'SEC-002': ['MASVS-STORAGE-1', 'MASVS-STORAGE-2'],
    'SEC-003': ['MASVS-STORAGE-1', 'MASVS-STORAGE-2'],
    'SEC-004': ['MASVS-STORAGE-1', 'MASVS-CRYPTO-1'],
    'SEC-005': ['MASVS-STORAGE-1'],
    'SEC-006': ['MASVS-STORAGE-1'],
    'SEC-007': ['MASVS-CRYPTO-1', 'MASVS-STORAGE-1'],
    'SEC-008': ['MASVS-NETWORK-1', 'MASVS-STORAGE-1'],
    // Storage
    'STR-001': ['MASVS-STORAGE-1', 'MASVS-STORAGE-2'],
    'STR-002': ['MASVS-STORAGE-1'],
    'STR-003': ['MASVS-STORAGE-1'],
    'STR-004': ['MASVS-STORAGE-1'],
    'STR-005': ['MASVS-STORAGE-1', 'MASVS-STORAGE-2'],
    // Network
    'NET-001': ['MASVS-NETWORK-1'],
    'NET-002': ['MASVS-NETWORK-1', 'MASVS-NETWORK-2'],
    'NET-003': ['MASVS-NETWORK-1'],
    'NET-004': ['MASVS-NETWORK-1'],
    // Logging
    'LOG-001': ['MASVS-STORAGE-1', 'MASVS-PRIVACY-1'],
    'LOG-002': ['MASVS-STORAGE-1', 'MASVS-PRIVACY-1'],
    'LOG-003': ['MASVS-STORAGE-1', 'MASVS-PRIVACY-1'],
    'LOG-004': ['MASVS-STORAGE-1'],
    // Auth
    'AUTH-001': ['MASVS-AUTH-1', 'MASVS-STORAGE-1'],
    'AUTH-002': ['MASVS-AUTH-1'],
    'AUTH-004': ['MASVS-AUTH-1', 'MASVS-AUTH-2'],
    // General
    'GEN-001': ['MASVS-CODE-4'],
    'GEN-002': ['MASVS-CODE-4'],
    'GEN-004': ['MASVS-STORAGE-1'],
    'GEN-005': ['MASVS-CODE-2'],
    'GEN-006': ['MASVS-NETWORK-1'],
    'GEN-007': ['MASVS-CODE-4'],
    'GEN-008': ['MASVS-CRYPTO-1'],
    // Platform
    'PLAT-001': ['MASVS-NETWORK-2'],
    'PLAT-002': ['MASVS-RESILIENCE-1', 'MASVS-RESILIENCE-3'],
    'PLAT-003': ['MASVS-RESILIENCE-1'],
    'PLAT-004': ['MASVS-PRIVACY-1', 'MASVS-STORAGE-1'],
    'PLAT-005': ['MASVS-AUTH-2'],
    'PLAT-006': ['MASVS-AUTH-1'],
    // Navigation
    'NAV-001': ['MASVS-CODE-4'],
    'NAV-002': ['MASVS-CODE-4'],
    'NAV-003': ['MASVS-AUTH-1'],
    'NAV-004': ['MASVS-CODE-4'],
    'NAV-005': ['MASVS-NETWORK-1'],
    'NAV-INV-001': ['MASVS-CODE-4'],
    'NAV-INV-002': ['MASVS-AUTH-1'],
    // Services
    'SVC-001': ['MASVS-NETWORK-1'],
    'SVC-002': ['MASVS-AUTH-1'],
    'SVC-003': ['MASVS-NETWORK-1'],
    'SVC-INV-001': ['MASVS-NETWORK-2'],
    'SVC-INV-002': ['MASVS-NETWORK-1'],
    // Screens
    'SCR-001': ['MASVS-PRIVACY-1'],
    'SCR-002': ['MASVS-PRIVACY-1', 'MASVS-STORAGE-1'],
    'SCR-003': ['MASVS-CODE-4'],
    'SCR-INV-001': ['MASVS-PRIVACY-1'],
    // Components
    'CMP-001': ['MASVS-CODE-4'],
    'CMP-002': ['MASVS-CODE-4'],
    'CMP-003': ['MASVS-CODE-4'],
    'CMP-004': ['MASVS-CODE-4'],
    'CMP-INV-001': ['MASVS-CODE-4'],
    // Store
    'STA-001': ['MASVS-STORAGE-1', 'MASVS-STORAGE-2'],
    'STA-002': ['MASVS-STORAGE-1'],
    'STA-003': ['MASVS-PRIVACY-1'],
    'STA-INV-001': ['MASVS-STORAGE-1', 'MASVS-STORAGE-2'],
    // API
    'API-001': ['MASVS-NETWORK-1'],
    'API-002': ['MASVS-AUTH-1'],
    'API-003': ['MASVS-AUTH-1'],
    'API-INV-001': ['MASVS-NETWORK-2'],
    // Context
    'CTX-001': ['MASVS-STORAGE-1'],
    // Config
    'CFG-001': ['MASVS-STORAGE-1'],
    'CFG-002': ['MASVS-CODE-2'],
    // Deps
    'DEP-001': ['MASVS-CODE-3'],
    'DEP-002': ['MASVS-CODE-3'],
    'DEP-003': ['MASVS-CODE-3'],
    'DEP-004': ['MASVS-CODE-3'],
    'ENV-001': ['MASVS-STORAGE-1'],
  },
  'GDPR': {
    'SEC-001': ['Art.32'],
    'SEC-002': ['Art.32'],
    'SEC-003': ['Art.32'],
    'SEC-004': ['Art.32'],
    'LOG-001': ['Art.5(1)(f)', 'Art.32'],
    'LOG-002': ['Art.5(1)(f)', 'Art.32'],
    'LOG-003': ['Art.5(1)(f)', 'Art.32'],
    'STR-001': ['Art.32'],
    'STR-005': ['Art.32'],
    'PLAT-004': ['Art.5(1)(f)'],
    'STA-003': ['Art.5(1)(c)'],
  },
};

/**
 * Resolves compliance references for a given rule ID based on
 * the active compliance frameworks.
 */
function resolveComplianceRefs(ruleId, complianceFrameworks) {
  if (!complianceFrameworks || complianceFrameworks.length === 0) return [];
  const refs = [];
  for (const framework of complianceFrameworks) {
    const map = COMPLIANCE_MAP[framework];
    if (map && map[ruleId]) {
      for (const control of map[ruleId]) {
        refs.push(`${framework} ${control}`);
      }
    }
  }
  return refs;
}

module.exports = {
  SEVERITY,
  CATEGORIES,
  SOURCE_EXTENSIONS,
  IGNORE_DIRS,
  FOLDER_DOMAINS,
  LOW_RISK_DOMAINS,
  HIGH_SEVERITY_APP_TYPES,
  COMPLIANCE_MAP,
  resolveComplianceRefs,
};
