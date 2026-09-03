'use strict';

const path = require('path');

// ────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────

const PRIORITY_BUCKETS = {
  FIX_IMMEDIATELY: { label: '🔥 Fix Immediately', min: 80, max: 100 },
  FIX_THIS_SPRINT: { label: '⚡ Fix This Sprint', min: 50, max: 79 },
  BACKLOG:         { label: '📋 Backlog',         min: 20, max: 49 },
  INFORMATIONAL:   { label: 'ℹ️  Informational',  min: 0,  max: 19 },
};

const SEVERITY_WEIGHTS = {
  4: 1.0,    // CRITICAL
  3: 0.75,   // HIGH
  2: 0.45,   // MEDIUM
  1: 0.2,    // LOW
  0: 0.05,   // INFO
};

// App types that elevate impact scores for auth/crypto/network findings
const HIGH_SECURITY_APP_TYPES = [
  'finance', 'fintech', 'banking', 'payment', 'healthcare', 'medical', 'government',
];

// ────────────────────────────────────────────────────────────────────
// Priority Scoring
// ────────────────────────────────────────────────────────────────────

/**
 * Calculates a composite priority score (0-100) for an enriched finding.
 *
 * priority = severityWeight × exploitability × reachability × impactModifier × correlationModifier
 * Normalized to 0-100.
 *
 * NOTE: This is a deterministic heuristic prioritization score,
 * NOT a proven security metric. It helps developers focus on the
 * most likely impactful findings first.
 *
 * @param {object} enrichedFinding - Finding with context from context-analyzer
 * @param {string} appType - Application type (e.g. 'sports', 'finance')
 * @param {object[]} allFindings - All enriched findings (for correlation)
 * @returns {object} Priority info
 */
function calculatePriority(enrichedFinding, appType, allFindings) {
  const severity = enrichedFinding.severity;
  const severityLevel = (severity && typeof severity === 'object') ? severity.level : 0;
  const severityWeight = SEVERITY_WEIGHTS[severityLevel] || 0.05;

  // Exploitability modifier (0.1 – 1.0)
  const exploitability = getExploitabilityModifier(enrichedFinding);

  // Reachability modifier (0.0 – 1.0)
  const reachability = getReachabilityModifier(enrichedFinding);

  // Impact modifier based on app type (0.5 – 1.5)
  const impactMod = getImpactModifier(enrichedFinding, appType);

  // Correlation modifier — escalate if related findings exist
  const correlationMod = getCorrelationModifier(enrichedFinding, allFindings);

  // False positive reduction
  const fpReduction = enrichedFinding.context?.isFalsePositive ? 0.1 : 1.0;

  // Calculate raw score
  const rawScore = severityWeight * exploitability * reachability * impactMod * correlationMod * fpReduction;

  // Normalize to 0-100
  // Max theoretical: 1.0 * 1.0 * 1.0 * 1.5 * 1.5 * 1.0 = 2.25
  const score = Math.min(100, Math.round((rawScore / 1.5) * 100));

  // Determine bucket
  const bucket = getBucket(score);

  return {
    score,
    bucket: bucket.label,
    exploitability: exploitability >= 0.7 ? 'high' : exploitability >= 0.4 ? 'medium' : 'low',
    reachability: reachability >= 0.7 ? 'production' : reachability >= 0.3 ? 'uncertain' : 'development',
    impactModifier: impactMod,
    correlationModifier: correlationMod,
    isHighSecurity: HIGH_SECURITY_APP_TYPES.includes(appType),
  };
}

// ── Component Scoring Functions ──────────────────────────────────

function getExploitabilityModifier(finding) {
  const ruleId = finding.rule || '';
  const file = finding.file || '';
  const fileLower = file.toLowerCase();

  // Network-facing / externally accessible code
  if (ruleId.startsWith('NET-') || ruleId.startsWith('AUTH-') || ruleId === 'SEC-008') {
    return 0.9;
  }

  // Deep link handlers, navigation
  if (ruleId.startsWith('NAV-') || /deep[_-]?link|linking/i.test(file)) {
    return 0.85;
  }

  // API / service layer — network-facing
  if (fileLower.includes('/api/') || fileLower.includes('/services/')) {
    return 0.8;
  }

  // Secrets / credentials — extractable from bundle
  if (ruleId.startsWith('SEC-')) {
    return 0.85;
  }

  // WebView communication
  if (ruleId.startsWith('CMP-') && ruleId !== 'CMP-004') {
    return 0.7;
  }

  // Storage issues — require device access
  if (ruleId.startsWith('STR-') || ruleId.startsWith('STA-')) {
    return 0.5;
  }

  // Logging — requires log access
  if (ruleId.startsWith('LOG-')) {
    return 0.35;
  }

  // Config, general
  if (ruleId.startsWith('CFG-') || ruleId.startsWith('GEN-')) {
    return 0.5;
  }

  // Platform-wide (inverse checks) — architecture level
  if (ruleId.startsWith('PLAT-')) {
    return 0.3;
  }

  // Dependencies
  if (ruleId.startsWith('DEP-')) {
    return 0.4;
  }

  return 0.4; // default: unknown
}

function getReachabilityModifier(finding) {
  const context = finding.context || {};

  // False positive → minimal reachability
  if (context.isFalsePositive) {
    return 0.05;
  }

  // Dev-guarded code
  if (context.indicators && context.indicators.some(i => /\b__DEV__\b/.test(i))) {
    return 0.1;
  }

  // Test files
  if (context.indicators && context.indicators.some(i => /test|spec|mock/i.test(i))) {
    return 0.05;
  }

  // Comment-only findings
  if (context.indicators && context.indicators.some(i => /comment/i.test(i))) {
    return 0.05;
  }

  // Type definitions
  if (context.indicators && context.indicators.some(i => /type|interface/i.test(i))) {
    return 0.05;
  }

  // If status is uncertain, moderate reachability
  if (context.status === 'uncertain') {
    return 0.5;
  }

  // Confirmed finding in production code
  if (context.status === 'confirmed' || context.status === 'likely') {
    return 0.9;
  }

  return 0.6; // unknown — assume moderate
}

function getImpactModifier(finding, appType) {
  const ruleId = finding.rule || '';
  const isHighSecurity = HIGH_SECURITY_APP_TYPES.includes(appType);

  // Auth/crypto/network findings are amplified for high-security apps
  if (isHighSecurity) {
    if (ruleId.startsWith('SEC-') || ruleId.startsWith('AUTH-') ||
        ruleId.startsWith('NET-') || ruleId.startsWith('STR-')) {
      return 1.4;
    }
  }

  // Credential findings always high impact
  if (['SEC-001', 'SEC-002', 'SEC-003', 'SEC-004', 'SEC-005', 'SEC-007'].includes(ruleId)) {
    return 1.2;
  }

  // SSL/TLS issues — high impact
  if (ruleId === 'NET-002') {
    return 1.3;
  }

  // Code execution — highest impact
  if (ruleId === 'GEN-001' || ruleId === 'GEN-007') {
    return 1.3;
  }

  return 1.0;
}

function getCorrelationModifier(finding, allFindings) {
  if (!allFindings || allFindings.length <= 1) return 1.0;

  const ruleId = finding.rule || '';
  const file = finding.file || '';
  let modifier = 1.0;

  // Check for correlated findings
  for (const other of allFindings) {
    if (other === finding) continue;

    // Token stored insecurely AND logged → escalate both
    if (isTokenStorageFinding(ruleId) && isTokenLoggingFinding(other.rule)) {
      modifier = Math.max(modifier, 1.3);
    }
    if (isTokenLoggingFinding(ruleId) && isTokenStorageFinding(other.rule)) {
      modifier = Math.max(modifier, 1.3);
    }

    // Hardcoded credential AND used in API request → escalate
    if (ruleId.startsWith('SEC-') && other.rule?.startsWith('API-') && other.file === file) {
      modifier = Math.max(modifier, 1.4);
    }

    // Multiple critical findings in the same file → escalate
    if (other.file === file &&
        other.severity?.level >= 4 &&
        finding.severity?.level >= 4 &&
        other.rule !== ruleId) {
      modifier = Math.max(modifier, 1.2);
    }
  }

  return modifier;
}

function isTokenStorageFinding(ruleId) {
  return ['STR-001', 'STR-003', 'STR-005', 'STA-001', 'STA-INV-001'].includes(ruleId);
}

function isTokenLoggingFinding(ruleId) {
  return ['LOG-001', 'LOG-002', 'LOG-003'].includes(ruleId);
}

// ────────────────────────────────────────────────────────────────────
// Ranking & Correlation
// ────────────────────────────────────────────────────────────────────

/**
 * Sorts enriched findings by priority score (descending).
 * Attaches a rank number to each finding.
 *
 * @param {object[]} enrichedFindings - Findings with priority info
 * @returns {object[]} Ranked findings (new array, does not mutate input)
 */
function rankFindings(enrichedFindings) {
  const sorted = [...enrichedFindings].sort((a, b) => {
    const scoreA = a.priority?.score ?? 0;
    const scoreB = b.priority?.score ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;

    // Tie-break by severity
    const sevA = a.severity?.level ?? 0;
    const sevB = b.severity?.level ?? 0;
    return sevB - sevA;
  });

  for (let i = 0; i < sorted.length; i++) {
    sorted[i] = { ...sorted[i], priority: { ...sorted[i].priority, rank: i + 1 } };
  }

  return sorted;
}

/**
 * Returns the top N highest-priority findings.
 *
 * @param {object[]} rankedFindings - Findings already ranked
 * @param {number} n - Number of top findings (default 3)
 * @returns {object[]}
 */
function generateTopActions(rankedFindings, n) {
  n = n || 3;
  return rankedFindings
    .filter(f => !f.context?.isFalsePositive)
    .slice(0, n);
}

/**
 * Cross-finding correlation.
 * Identifies groups of related findings based on concrete evidence
 * (same variable names, same file, related rule types).
 *
 * Does NOT claim interprocedural data-flow analysis.
 * Only correlates when there is direct textual or structural evidence.
 *
 * @param {object[]} enrichedFindings
 * @returns {object[]} Findings with correlationGroup field added
 */
function correlateFindings(enrichedFindings) {
  const correlationGroups = [];
  const assigned = new Set();

  for (let i = 0; i < enrichedFindings.length; i++) {
    if (assigned.has(i)) continue;

    const group = [i];
    const fi = enrichedFindings[i];

    for (let j = i + 1; j < enrichedFindings.length; j++) {
      if (assigned.has(j)) continue;
      const fj = enrichedFindings[j];

      if (areCorrelated(fi, fj)) {
        group.push(j);
      }
    }

    if (group.length > 1) {
      const groupId = `CG-${correlationGroups.length + 1}`;
      correlationGroups.push({ id: groupId, indices: group });
      for (const idx of group) {
        assigned.add(idx);
      }
    }
  }

  // Attach correlation group info
  const result = enrichedFindings.map((f, i) => {
    const group = correlationGroups.find(g => g.indices.includes(i));
    if (group) {
      const relatedIndices = group.indices.filter(idx => idx !== i);
      const relatedFindings = relatedIndices.map(idx => ({
        rule: enrichedFindings[idx].rule,
        file: enrichedFindings[idx].file,
        line: enrichedFindings[idx].line,
        message: enrichedFindings[idx].message,
      }));

      return {
        ...f,
        correlationGroup: group.id,
        relatedFindings,
      };
    }
    return f;
  });

  return result;
}

/**
 * Determines if two findings are correlated based on concrete evidence.
 */
function areCorrelated(a, b) {
  // Same file, related rule types
  if (a.file === b.file) {
    // Secret + usage pattern in same file
    if (a.rule?.startsWith('SEC-') && (b.rule?.startsWith('AUTH-') || b.rule?.startsWith('API-'))) return true;
    if (b.rule?.startsWith('SEC-') && (a.rule?.startsWith('AUTH-') || a.rule?.startsWith('API-'))) return true;

    // Storage + logging of similar data
    if (isTokenStorageFinding(a.rule) && isTokenLoggingFinding(b.rule)) return true;
    if (isTokenLoggingFinding(a.rule) && isTokenStorageFinding(b.rule)) return true;

    // Multiple findings on the same line
    if (a.line > 0 && a.line === b.line) return true;
  }

  // Same rule in related files (e.g. same secret in multiple places)
  if (a.rule === b.rule && a.rule?.startsWith('SEC-') && a.lineContent && b.lineContent) {
    // Same secret value appearing in different files
    const valA = extractSecretValue(a.lineContent);
    const valB = extractSecretValue(b.lineContent);
    if (valA && valB && valA === valB) return true;
  }

  return false;
}

function extractSecretValue(lineContent) {
  if (!lineContent) return null;
  const match = lineContent.match(/['"`]([A-Za-z0-9_\-]{16,})['"`]/);
  return match ? match[1] : null;
}

// ────────────────────────────────────────────────────────────────────
// Utility
// ────────────────────────────────────────────────────────────────────

function getBucket(score) {
  if (score >= PRIORITY_BUCKETS.FIX_IMMEDIATELY.min) return PRIORITY_BUCKETS.FIX_IMMEDIATELY;
  if (score >= PRIORITY_BUCKETS.FIX_THIS_SPRINT.min) return PRIORITY_BUCKETS.FIX_THIS_SPRINT;
  if (score >= PRIORITY_BUCKETS.BACKLOG.min) return PRIORITY_BUCKETS.BACKLOG;
  return PRIORITY_BUCKETS.INFORMATIONAL;
}

/**
 * Returns a summary of priority distribution.
 */
function getPriorityDistribution(rankedFindings) {
  const dist = {
    fixImmediately: 0,
    fixThisSprint: 0,
    backlog: 0,
    informational: 0,
  };

  for (const f of rankedFindings) {
    const score = f.priority?.score ?? 0;
    if (score >= 80) dist.fixImmediately++;
    else if (score >= 50) dist.fixThisSprint++;
    else if (score >= 20) dist.backlog++;
    else dist.informational++;
  }

  return dist;
}

// ────────────────────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  calculatePriority,
  rankFindings,
  generateTopActions,
  correlateFindings,
  getPriorityDistribution,
  PRIORITY_BUCKETS,
};
