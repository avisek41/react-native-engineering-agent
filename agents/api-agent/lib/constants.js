/**
 * API Agent Constants & Rule Definitions
 */

module.exports = {
  EXIT_CODES: {
    SUCCESS: 0,
    VALIDATION_ERROR: 1,
    RUNTIME_ERROR: 2,
  },
  SEVERITIES: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
  },
  RULE_IDS: {
    PURE_TYPES: 'API-001',
    BARREL_EXPORTS: 'API-002',
    ENDPOINTS_CONSTANT: 'API-003',
    FORBID_AXIOS: 'API-004',
    QUERY_KEY_FACTORY: 'API-005',
    SELECT_IN_INFINITE_QUERY: 'API-006',
    STALE_AND_GC_TIME: 'API-007',
  },
  DEFAULT_CONFIG: {
    appName: 'futureonesports',
    srcRoot: './src',
    apiDir: './src/api',
    hooksDir: './src/hooks',
    typesDir: './src/types',
    endpointsFile: './src/api/endPoints.ts',
  },
};
