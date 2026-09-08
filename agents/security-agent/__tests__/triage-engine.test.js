'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  calculatePriority,
  rankFindings,
  generateTopActions,
  correlateFindings,
  getPriorityDistribution,
  PRIORITY_BUCKETS,
} = require('../lib/triage-engine');
const { SEVERITY, CATEGORIES } = require('../lib/constants');

// ────────────────────────────────────────────────────────────────────
// Helper: create a minimal enriched finding for testing
// ────────────────────────────────────────────────────────────────────
function makeFinding(overrides = {}) {
  return {
    id: 'test-id',
    file: 'src/services/authService.ts',
    line: 10,
    lineContent: "const secret = 'value';",
    rule: 'SEC-002',
    message: 'Hardcoded Secret',
    severity: SEVERITY.CRITICAL,
    category: CATEGORIES.SECRETS,
    recommendation: 'Fix it.',
    context: {
      isFalsePositive: false,
      status: 'confirmed',
      confidence: 0.85,
      indicators: [],
    },
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// Score Calculation
// ════════════════════════════════════════════════════════════════════

describe('Priority Score Calculation', () => {
  it('produces a score between 0 and 100', () => {
    const finding = makeFinding();
    const priority = calculatePriority(finding, 'general', [finding]);
    assert.ok(priority.score >= 0 && priority.score <= 100, `Score ${priority.score} out of range`);
  });

  it('critical confirmed findings get high scores', () => {
    const finding = makeFinding({
      severity: SEVERITY.CRITICAL,
      rule: 'SEC-002',
      context: { isFalsePositive: false, status: 'confirmed', confidence: 0.85, indicators: [] },
    });
    const priority = calculatePriority(finding, 'general', [finding]);
    assert.ok(priority.score >= 50, `Critical confirmed finding should score >= 50, got ${priority.score}`);
  });

  it('low severity findings get lower scores than critical', () => {
    const critical = makeFinding({ severity: SEVERITY.CRITICAL, rule: 'SEC-002' });
    const low = makeFinding({ severity: SEVERITY.LOW, rule: 'STR-004' });
    const pCritical = calculatePriority(critical, 'general', [critical, low]);
    const pLow = calculatePriority(low, 'general', [critical, low]);
    assert.ok(pCritical.score > pLow.score, `Critical (${pCritical.score}) should score higher than Low (${pLow.score})`);
  });

  it('returns a bucket label', () => {
    const finding = makeFinding();
    const priority = calculatePriority(finding, 'general', [finding]);
    assert.ok(typeof priority.bucket === 'string');
    assert.ok(priority.bucket.length > 0);
  });
});

// ════════════════════════════════════════════════════════════════════
// Bucket Boundaries
// ════════════════════════════════════════════════════════════════════

describe('Bucket Boundaries', () => {
  it('PRIORITY_BUCKETS has correct boundary definitions', () => {
    assert.equal(PRIORITY_BUCKETS.FIX_IMMEDIATELY.min, 80);
    assert.equal(PRIORITY_BUCKETS.FIX_IMMEDIATELY.max, 100);
    assert.equal(PRIORITY_BUCKETS.FIX_THIS_SPRINT.min, 50);
    assert.equal(PRIORITY_BUCKETS.FIX_THIS_SPRINT.max, 79);
    assert.equal(PRIORITY_BUCKETS.BACKLOG.min, 20);
    assert.equal(PRIORITY_BUCKETS.BACKLOG.max, 49);
    assert.equal(PRIORITY_BUCKETS.INFORMATIONAL.min, 0);
    assert.equal(PRIORITY_BUCKETS.INFORMATIONAL.max, 19);
  });

  it('getPriorityDistribution correctly categorizes scores', () => {
    const findings = [
      { priority: { score: 0 } },
      { priority: { score: 19 } },
      { priority: { score: 20 } },
      { priority: { score: 49 } },
      { priority: { score: 50 } },
      { priority: { score: 79 } },
      { priority: { score: 80 } },
      { priority: { score: 100 } },
    ];
    const dist = getPriorityDistribution(findings);
    assert.equal(dist.informational, 2, 'Scores 0 and 19 should be informational');
    assert.equal(dist.backlog, 2, 'Scores 20 and 49 should be backlog');
    assert.equal(dist.fixThisSprint, 2, 'Scores 50 and 79 should be fixThisSprint');
    assert.equal(dist.fixImmediately, 2, 'Scores 80 and 100 should be fixImmediately');
  });
});

// ════════════════════════════════════════════════════════════════════
// False Positive Reduction
// ════════════════════════════════════════════════════════════════════

describe('False Positive Score Reduction', () => {
  it('false positives score lower than confirmed findings', () => {
    const confirmed = makeFinding({
      context: { isFalsePositive: false, status: 'confirmed', confidence: 0.85, indicators: [] },
    });
    const falsePositive = makeFinding({
      context: { isFalsePositive: true, status: 'likely_false_positive', confidence: 0.9, indicators: ['In a comment'] },
    });
    const pConfirmed = calculatePriority(confirmed, 'general', [confirmed]);
    const pFP = calculatePriority(falsePositive, 'general', [falsePositive]);
    assert.ok(pConfirmed.score > pFP.score,
      `Confirmed (${pConfirmed.score}) should score higher than FP (${pFP.score})`);
  });
});

// ════════════════════════════════════════════════════════════════════
// App-Type Impact Elevation
// ════════════════════════════════════════════════════════════════════

describe('App-Type Impact Elevation', () => {
  it('finance apps get higher scores for auth/network findings', () => {
    const finding = makeFinding({ rule: 'NET-002', severity: SEVERITY.CRITICAL });
    const pGeneral = calculatePriority(finding, 'general', [finding]);
    const pFinance = calculatePriority(finding, 'finance', [finding]);
    assert.ok(pFinance.score >= pGeneral.score,
      `Finance (${pFinance.score}) should score >= general (${pGeneral.score}) for NET-002`);
    assert.ok(pFinance.isHighSecurity === true);
    assert.ok(pGeneral.isHighSecurity === false);
  });

  it('healthcare apps get higher impact modifier', () => {
    const finding = makeFinding({ rule: 'STR-001', severity: SEVERITY.HIGH });
    const pGeneral = calculatePriority(finding, 'general', [finding]);
    const pHealthcare = calculatePriority(finding, 'healthcare', [finding]);
    assert.ok(pHealthcare.score >= pGeneral.score,
      `Healthcare (${pHealthcare.score}) should score >= general (${pGeneral.score}) for STR-001`);
  });
});

// ════════════════════════════════════════════════════════════════════
// Ranking
// ════════════════════════════════════════════════════════════════════

describe('Ranking', () => {
  it('ranks findings by score descending', () => {
    const findings = [
      { ...makeFinding({ rule: 'LOG-004', severity: SEVERITY.LOW }), priority: { score: 10 } },
      { ...makeFinding({ rule: 'SEC-002', severity: SEVERITY.CRITICAL }), priority: { score: 80 } },
      { ...makeFinding({ rule: 'NET-001', severity: SEVERITY.HIGH }), priority: { score: 55 } },
    ];
    const ranked = rankFindings(findings);
    assert.equal(ranked[0].priority.score, 80);
    assert.equal(ranked[1].priority.score, 55);
    assert.equal(ranked[2].priority.score, 10);
  });

  it('assigns rank numbers starting from 1', () => {
    const findings = [
      { ...makeFinding(), priority: { score: 90 } },
      { ...makeFinding(), priority: { score: 50 } },
    ];
    const ranked = rankFindings(findings);
    assert.equal(ranked[0].priority.rank, 1);
    assert.equal(ranked[1].priority.rank, 2);
  });

  it('does not mutate original findings array', () => {
    const findings = [
      { ...makeFinding(), priority: { score: 30 } },
      { ...makeFinding(), priority: { score: 70 } },
    ];
    const original0Score = findings[0].priority.score;
    rankFindings(findings);
    assert.equal(findings[0].priority.score, original0Score);
  });
});

// ════════════════════════════════════════════════════════════════════
// Top Actions
// ════════════════════════════════════════════════════════════════════

describe('Top Actions', () => {
  it('returns top N non-false-positive findings', () => {
    const findings = [
      { ...makeFinding(), priority: { score: 90, rank: 1 }, context: { isFalsePositive: false } },
      { ...makeFinding(), priority: { score: 80, rank: 2 }, context: { isFalsePositive: true } },
      { ...makeFinding(), priority: { score: 70, rank: 3 }, context: { isFalsePositive: false } },
      { ...makeFinding(), priority: { score: 60, rank: 4 }, context: { isFalsePositive: false } },
    ];
    const top = generateTopActions(findings, 2);
    assert.equal(top.length, 2);
    assert.equal(top[0].priority.score, 90);
    assert.equal(top[1].priority.score, 70); // skips the FP at 80
  });
});

// ════════════════════════════════════════════════════════════════════
// Cross-Finding Correlation
// ════════════════════════════════════════════════════════════════════

describe('Cross-Finding Correlation', () => {
  it('correlates token storage + token logging in the same file', () => {
    const findings = [
      makeFinding({ rule: 'STR-001', file: 'src/services/auth.ts', line: 5 }),
      makeFinding({ rule: 'LOG-001', file: 'src/services/auth.ts', line: 10 }),
    ];
    const correlated = correlateFindings(findings);
    // Both should have a correlation group
    const grouped = correlated.filter(f => f.correlationGroup);
    assert.ok(grouped.length >= 2, 'Related storage + logging findings should be correlated');
    assert.equal(grouped[0].correlationGroup, grouped[1].correlationGroup);
  });

  it('does not correlate unrelated findings in different files', () => {
    const findings = [
      makeFinding({ rule: 'NET-001', file: 'src/api/client.ts', line: 5 }),
      makeFinding({ rule: 'GEN-008', file: 'src/utils/random.ts', line: 10 }),
    ];
    const correlated = correlateFindings(findings);
    const grouped = correlated.filter(f => f.correlationGroup);
    assert.equal(grouped.length, 0, 'Unrelated findings should not be correlated');
  });

  it('correlates findings on the same line in the same file', () => {
    const findings = [
      makeFinding({ rule: 'SEC-001', file: 'src/config.ts', line: 5 }),
      makeFinding({ rule: 'NET-001', file: 'src/config.ts', line: 5 }),
    ];
    const correlated = correlateFindings(findings);
    const grouped = correlated.filter(f => f.correlationGroup);
    assert.ok(grouped.length >= 2, 'Same-line findings should be correlated');
  });

  it('correlation modifier escalates score for correlated findings', () => {
    const storeFinding = makeFinding({ rule: 'STR-001', file: 'src/auth.ts', severity: SEVERITY.HIGH });
    const logFinding = makeFinding({ rule: 'LOG-001', file: 'src/auth.ts', severity: SEVERITY.HIGH });
    const allFindings = [storeFinding, logFinding];

    const pStore = calculatePriority(storeFinding, 'general', allFindings);
    const pStoreSingle = calculatePriority(storeFinding, 'general', [storeFinding]);

    assert.ok(pStore.correlationModifier >= 1.0,
      `Correlated finding should have modifier >= 1.0, got ${pStore.correlationModifier}`);
  });
});
