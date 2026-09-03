'use strict';

const path = require('path');
const { getPriorityDistribution, PRIORITY_BUCKETS } = require('./triage-engine');
const { FP_STATUS } = require('./context-analyzer');

// ────────────────────────────────────────────────────────────────────
// Markdown Report
// ────────────────────────────────────────────────────────────────────

/**
 * Generates a rich, enriched Markdown report from the agent pipeline.
 *
 * @param {object} data
 * @param {string} data.appName
 * @param {string} data.appType
 * @param {object} data.scope
 * @param {object[]} data.findings       - All enriched + triaged findings
 * @param {object[]} data.topActions     - Top N priority findings
 * @param {object} data.stats            - From existing scanner stats
 * @param {number} data.filesScanned
 * @param {number} data.scanDurationMs
 * @returns {string} Markdown content
 */
function generateAgentMarkdownReport(data) {
  const { appName, appType, scope, findings, topActions, stats, filesScanned, scanDurationMs } = data;

  const confirmed = findings.filter(f => f.context?.status === FP_STATUS.CONFIRMED);
  const likely = findings.filter(f => f.context?.status === FP_STATUS.LIKELY);
  const uncertain = findings.filter(f => f.context?.status === FP_STATUS.UNCERTAIN);
  const falsePositives = findings.filter(f => f.context?.status === FP_STATUS.LIKELY_FALSE_POSITIVE);
  const nonFP = findings.filter(f => !f.context?.isFalsePositive);
  const dist = getPriorityDistribution(nonFP);
  const fixableFindings = findings.filter(f => f.fix?.available);
  const autoFixable = findings.filter(f => f.fix?.safeToAutoApply);
  const scanDate = new Date().toLocaleString();
  const durationStr = scanDurationMs ? `${(scanDurationMs / 1000).toFixed(1)}s` : 'N/A';

  let md = '';

  // ── Header ──
  md += `# 🛡️ ${esc(appName)} — Security Agent Report\n\n`;
  md += `> **Scope:** ${scopeLabel(scope)} — \`${scope?.fullPath || '.'}\`\n`;
  md += `> **App Type:** ${appType || 'general'} · **Date:** ${scanDate} · **Duration:** ${durationStr}\n\n`;
  md += `> **Note:** Priority scores are heuristic-based and help focus remediation effort. `;
  md += `They are not proven security metrics. All findings should be reviewed by a developer.\n\n`;
  md += `---\n\n`;

  // ── Executive Summary ──
  md += `## 📋 Executive Summary\n\n`;
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Files scanned | ${filesScanned || 0} |\n`;
  md += `| Total findings | ${findings.length} |\n`;
  md += `| Confirmed issues | ${confirmed.length} |\n`;
  md += `| Likely issues | ${likely.length} |\n`;
  md += `| Uncertain | ${uncertain.length} |\n`;
  md += `| Likely false positives | ${falsePositives.length} |\n`;
  md += `| Auto-fixable | ${autoFixable.length} |\n\n`;

  md += `### Priority Distribution\n\n`;
  md += `| Bucket | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| 🔥 Fix Immediately | ${dist.fixImmediately} |\n`;
  md += `| ⚡ Fix This Sprint | ${dist.fixThisSprint} |\n`;
  md += `| 📋 Backlog | ${dist.backlog} |\n`;
  md += `| ℹ️  Informational | ${dist.informational} |\n\n`;

  md += `### Severity Distribution\n\n`;
  md += `| Severity | Count |\n`;
  md += `|----------|-------|\n`;
  md += `| 🔴 Critical | ${stats?.critical || 0} |\n`;
  md += `| 🟠 High | ${stats?.high || 0} |\n`;
  md += `| 🟡 Medium | ${stats?.medium || 0} |\n`;
  md += `| 🔵 Low | ${stats?.low || 0} |\n`;
  md += `| ⚪ Info | ${stats?.info || 0} |\n\n`;

  if (findings.length === 0) {
    md += `✅ **No security findings detected.** Good job!\n\n`;
    return md;
  }

  md += `---\n\n`;

  // ── Fix These First ──
  if (topActions && topActions.length > 0) {
    md += `## 🔥 Fix These First\n\n`;
    for (let i = 0; i < topActions.length; i++) {
      const f = topActions[i];
      md += renderTopAction(f, i + 1);
    }
    md += `---\n\n`;
  }

  // ── All Findings ──
  md += `## 🔍 All Findings\n\n`;

  // Group by priority bucket
  const buckets = [
    { label: '🔥 Fix Immediately', filter: f => (f.priority?.score ?? 0) >= 80 },
    { label: '⚡ Fix This Sprint', filter: f => { const s = f.priority?.score ?? 0; return s >= 50 && s < 80; } },
    { label: '📋 Backlog', filter: f => { const s = f.priority?.score ?? 0; return s >= 20 && s < 50; } },
    { label: 'ℹ️  Informational', filter: f => (f.priority?.score ?? 0) < 20 },
  ];

  for (const bucket of buckets) {
    const bucketFindings = nonFP.filter(bucket.filter);
    if (bucketFindings.length === 0) continue;

    md += `### ${bucket.label} (${bucketFindings.length})\n\n`;
    for (const f of bucketFindings) {
      md += renderFindingDetail(f);
    }
  }

  md += `---\n\n`;

  // ── False Positive Candidates ──
  if (falsePositives.length > 0) {
    md += `## 🚫 Likely False Positives (${falsePositives.length})\n\n`;
    md += `> These findings were flagged as likely false positives by deterministic heuristics. `;
    md += `They are shown here for transparency — review and suppress via config if confirmed.\n\n`;

    for (const f of falsePositives) {
      md += `- **\`${f.rule}\`** ${esc(f.message)} — \`${esc(f.file)}\`${f.line > 0 ? `:${f.line}` : ''}\n`;
      md += `  - Reason: ${esc(f.context?.falsePositiveReason || 'Heuristic analysis')}\n`;
      md += `  - Confidence: ${((f.context?.confidence || 0) * 100).toFixed(0)}%\n\n`;
    }

    md += `---\n\n`;
  }

  // ── Suggested Fixes Summary ──
  if (fixableFindings.length > 0) {
    md += `## 🛠️ Suggested Fixes\n\n`;

    // Auto-fixable
    if (autoFixable.length > 0) {
      md += `### ✅ Safe Automatic Fixes (${autoFixable.length})\n\n`;
      md += `> These can be applied automatically with \`--fix\`. The transformations are deterministic and low-risk.\n\n`;
      for (const f of autoFixable) {
        md += renderFixSuggestion(f, true);
      }
    }

    // Manual fixes
    const manualFixes = fixableFindings.filter(f => !f.fix?.safeToAutoApply && f.fix?.before);
    if (manualFixes.length > 0) {
      md += `### ⚠️ Manual Fixes Recommended (${manualFixes.length})\n\n`;
      md += `> These require developer review. Do NOT apply automatically.\n\n`;
      for (const f of manualFixes) {
        md += renderFixSuggestion(f, false);
      }
    }
  }

  // ── Correlation Groups ──
  const correlated = findings.filter(f => f.correlationGroup);
  if (correlated.length > 0) {
    const groups = new Map();
    for (const f of correlated) {
      if (!groups.has(f.correlationGroup)) {
        groups.set(f.correlationGroup, []);
      }
      groups.get(f.correlationGroup).push(f);
    }

    md += `## 🔗 Correlated Findings\n\n`;
    md += `> These findings are related and may compound each other's risk.\n\n`;

    for (const [groupId, members] of groups) {
      md += `### ${groupId}\n\n`;
      for (const m of members) {
        md += `- \`${m.rule}\` ${esc(m.message)} — \`${esc(m.file)}\`${m.line > 0 ? `:${m.line}` : ''} (priority: ${m.priority?.score ?? '?'})\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
  }

  // ── Footer ──
  md += `---\n\n`;
  md += `*Generated by **Security Agent** (deterministic local analysis) • ${esc(appName)} • ${scanDate}*\n`;
  md += `*This report uses heuristic analysis. It does not claim AI/LLM reasoning or complete data-flow analysis.*\n`;

  return md;
}

// ── Rendering Helpers ────────────────────────────────────────────

function renderTopAction(f, index) {
  let md = '';
  md += `### ${index}. ${esc(f.message)} — \`${esc(f.file)}\`${f.line > 0 ? `:${f.line}` : ''}\n\n`;
  md += `**Priority:** ${f.priority?.score ?? '?'}/100 (${f.priority?.bucket || '?'}) · `;
  md += `**Severity:** ${f.severity?.emoji || '?'} ${f.severity?.label || '?'} · `;
  md += `**Rule:** \`${f.rule}\`\n\n`;

  if (f.context?.explanation) {
    md += `**What's wrong:**\n${esc(f.context.explanation)}\n\n`;
  }

  if (f.fix?.available && f.fix.before) {
    md += `**Suggested fix:**\n`;
    md += '```diff\n';
    md += `- ${f.fix.before}\n`;
    if (f.fix.after) md += `+ ${f.fix.after}\n`;
    md += '```\n\n';

    if (f.fix.additionalSteps && f.fix.additionalSteps.length > 0) {
      md += `**Additional steps:**\n`;
      for (const step of f.fix.additionalSteps) {
        md += `1. ${step}\n`;
      }
      md += `\n`;
    }
  }

  return md;
}

function renderFindingDetail(f) {
  let md = '';
  const sevLabel = `${f.severity?.emoji || '?'} ${f.severity?.label || '?'}`;
  const priorityScore = f.priority?.score ?? '?';

  md += `#### \`${f.rule}\` ${esc(f.message)}\n\n`;
  md += `| Field | Value |\n`;
  md += `|-------|-------|\n`;
  md += `| Severity | ${sevLabel} |\n`;
  md += `| Priority | ${priorityScore}/100 (${f.priority?.bucket || '?'}) |\n`;
  md += `| File | \`${esc(f.file)}\`${f.line > 0 ? `:${f.line}` : ''} |\n`;
  md += `| Exploitability | ${f.priority?.exploitability || 'unknown'} |\n`;
  md += `| Reachability | ${f.priority?.reachability || 'unknown'} |\n`;
  md += `| Status | ${f.context?.status || 'unknown'} |\n`;
  md += `| Confidence | ${((f.context?.confidence || 0) * 100).toFixed(0)}% |\n`;
  md += `| Auto-fixable | ${f.fix?.safeToAutoApply ? '✅ Yes' : '❌ No'} |\n\n`;

  if (f.context?.explanation) {
    md += `**What's wrong:** ${esc(f.context.explanation)}\n\n`;
  }

  if (f.lineContent) {
    md += `**Code:**\n\`\`\`\n${esc(f.lineContent)}\n\`\`\`\n\n`;
  }

  if (f.context?.indicators && f.context.indicators.length > 0) {
    md += `**Evidence:** ${f.context.indicators.map(esc).join('; ')}\n\n`;
  }

  if (f.fix?.available && f.fix.description) {
    md += `**Recommended fix:** ${esc(f.fix.description)}`;
    if (f.fix.safeToAutoApply) md += ` *(safe auto-fix available)*`;
    md += `\n\n`;
  } else if (f.recommendation) {
    md += `**Recommendation:** ${esc(f.recommendation)}\n\n`;
  }

  if (f.relatedFindings && f.relatedFindings.length > 0) {
    md += `**Related:** ${f.relatedFindings.map(r => `\`${r.rule}\` in \`${esc(r.file)}\``).join(', ')}\n\n`;
  }

  md += `---\n\n`;
  return md;
}

function renderFixSuggestion(f, isSafe) {
  let md = '';
  const tag = isSafe ? '✅ Safe automatic fix' : '⚠️ Manual fix recommended';

  md += `#### \`${f.rule}\` — ${esc(f.file)}${f.line > 0 ? `:${f.line}` : ''}\n\n`;
  md += `${tag} · ${esc(f.fix?.description || f.message)}\n\n`;

  if (f.fix?.before) {
    md += '```diff\n';
    md += `- ${f.fix.before}\n`;
    if (f.fix.after) md += `+ ${f.fix.after}\n`;
    md += '```\n\n';
  }

  if (f.fix?.additionalSteps?.length > 0) {
    for (const step of f.fix.additionalSteps) {
      md += `- ${step}\n`;
    }
    md += `\n`;
  }

  return md;
}

// ────────────────────────────────────────────────────────────────────
// JSON Report
// ────────────────────────────────────────────────────────────────────

/**
 * Generates a machine-readable JSON report.
 * No terminal formatting or ANSI escape sequences.
 *
 * @param {object} data - Same as generateAgentMarkdownReport
 * @returns {string} JSON string
 */
function generateAgentJSONReport(data) {
  const { appName, appType, scope, findings, topActions, stats, filesScanned, scanDurationMs } = data;

  const nonFP = findings.filter(f => !f.context?.isFalsePositive);
  const dist = getPriorityDistribution(nonFP);

  const report = {
    version: '1.0.0',
    scan: {
      appName: appName || '',
      appType: appType || 'general',
      scope: {
        mode: scope?.mode || 'unknown',
        domain: scope?.domain || null,
        path: scope?.fullPath || '.',
      },
      timestamp: new Date().toISOString(),
      filesScanned: filesScanned || 0,
      durationMs: scanDurationMs || 0,
    },
    summary: {
      total: findings.length,
      confirmed: findings.filter(f => f.context?.status === FP_STATUS.CONFIRMED).length,
      likely: findings.filter(f => f.context?.status === FP_STATUS.LIKELY).length,
      uncertain: findings.filter(f => f.context?.status === FP_STATUS.UNCERTAIN).length,
      likelyFalsePositives: findings.filter(f => f.context?.status === FP_STATUS.LIKELY_FALSE_POSITIVE).length,
      bySeverity: {
        critical: stats?.critical || 0,
        high: stats?.high || 0,
        medium: stats?.medium || 0,
        low: stats?.low || 0,
        info: stats?.info || 0,
      },
    },
    priority: {
      distribution: dist,
      topActions: (topActions || []).map(f => ({
        rule: f.rule,
        message: f.message,
        file: f.file,
        line: f.line,
        score: f.priority?.score ?? 0,
        bucket: f.priority?.bucket || null,
      })),
    },
    findings: findings.map(f => ({
      id: f.id || null,
      rule: f.rule,
      severity: f.severity?.label || 'UNKNOWN',
      severityLevel: f.severity?.level ?? 0,
      category: f.category || null,
      file: f.file,
      line: f.line || 0,
      lineContent: f.lineContent || '',
      message: f.message || '',
      recommendation: f.recommendation || '',
      complianceRefs: f.complianceRefs || [],
      context: {
        explanation: f.context?.explanation || '',
        status: f.context?.status || 'unknown',
        isFalsePositive: f.context?.isFalsePositive || false,
        falsePositiveReason: f.context?.falsePositiveReason || null,
        confidence: f.context?.confidence ?? 0,
        indicators: f.context?.indicators || [],
      },
      priority: {
        score: f.priority?.score ?? 0,
        bucket: f.priority?.bucket || null,
        rank: f.priority?.rank ?? 0,
        exploitability: f.priority?.exploitability || 'unknown',
        reachability: f.priority?.reachability || 'unknown',
      },
      fix: {
        available: f.fix?.available || false,
        safeToAutoApply: f.fix?.safeToAutoApply || false,
        description: f.fix?.description || null,
        before: f.fix?.before || null,
        after: f.fix?.after || null,
        additionalSteps: f.fix?.additionalSteps || [],
      },
      correlationGroup: f.correlationGroup || null,
      relatedFindings: (f.relatedFindings || []).map(r => ({
        rule: r.rule,
        file: r.file,
        line: r.line,
      })),
    })),
    fixes: {
      autoFixable: findings.filter(f => f.fix?.safeToAutoApply).map(f => ({
        rule: f.rule,
        file: f.file,
        line: f.line,
        description: f.fix?.description || '',
        before: f.fix?.before || '',
        after: f.fix?.after || '',
      })),
      manualOnly: findings.filter(f => f.fix?.available && !f.fix?.safeToAutoApply && f.fix?.before).map(f => ({
        rule: f.rule,
        file: f.file,
        line: f.line,
        description: f.fix?.description || '',
        before: f.fix?.before || '',
        after: f.fix?.after || '',
        additionalSteps: f.fix?.additionalSteps || [],
      })),
    },
  };

  return JSON.stringify(report, null, 2);
}

// ────────────────────────────────────────────────────────────────────
// Utility
// ────────────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str).replace(/[|]/g, '\\|');
}

function scopeLabel(scope) {
  if (!scope) return 'Unknown';
  if (scope.mode === 'root') return 'Root / Full Project Scan';
  if (scope.mode === 'folder') return `Folder Scan — ${scope.domain || scope.path}`;
  if (scope.mode === 'file') return `File Scan — ${scope.path || ''}`;
  return scope.mode || 'Unknown';
}

// ────────────────────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  generateAgentMarkdownReport,
  generateAgentJSONReport,
};
