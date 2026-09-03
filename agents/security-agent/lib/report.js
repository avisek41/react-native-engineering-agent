'use strict';

// ────────────────────────────────────────────────────────────────────
// Shared Utilities
// ────────────────────────────────────────────────────────────────────

function filterBySeverity(findings, minSeverity) {
  const minLevel = minSeverity === 'critical' ? 4 : minSeverity === 'high' ? 3 : 0;
  return findings.filter(f => f.severity.level >= minLevel);
}

function generateStats(filteredFindings) {
  const stats = {
    total: filteredFindings.length,
    critical: filteredFindings.filter(f => f.severity.level === 4).length,
    high: filteredFindings.filter(f => f.severity.level === 3).length,
    medium: filteredFindings.filter(f => f.severity.level === 2).length,
    low: filteredFindings.filter(f => f.severity.level === 1).length,
    info: filteredFindings.filter(f => f.severity.level === 0).length,
    byCategory: {},
    score: 0,
  };

  for (const f of filteredFindings) {
    stats.byCategory[f.category] = (stats.byCategory[f.category] || 0) + 1;
  }

  stats.score = Math.max(0, 100
    - (stats.critical * 15)
    - (stats.high * 8)
    - (stats.medium * 3)
    - (stats.low * 1)
  );

  return stats;
}

function getScoreGrade(score) {
  if (score >= 90) return { grade: 'A', color: '#22c55e', label: 'Excellent' };
  if (score >= 75) return { grade: 'B', color: '#84cc16', label: 'Good' };
  if (score >= 60) return { grade: 'C', color: '#eab308', label: 'Fair' };
  if (score >= 40) return { grade: 'D', color: '#f97316', label: 'Poor' };
  return { grade: 'F', color: '#ef4444', label: 'Critical' };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function scopeModeLabel(scope) {
  if (scope.mode === 'root') return 'ROOT-LEVEL SCAN';
  if (scope.mode === 'folder') return `FOLDER-LEVEL SCAN (${scope.domain})`;
  return `FILE-LEVEL SCAN`;
}

// ────────────────────────────────────────────────────────────────────
// Universal JSON Schema v1.0
// ────────────────────────────────────────────────────────────────────

function generateJSONReport(filteredFindings, scope, appType, appName) {
  const stats = generateStats(filteredFindings);
  const scoreInfo = getScoreGrade(stats.score);

  return JSON.stringify({
    schemaVersion: '1.0',
    appName,
    appType,
    scope: {
      mode: scope.mode,
      domain: scope.domain,
      path: scope.fullPath,
    },
    scanTimestamp: new Date().toISOString(),
    stats,
    scoreInfo: {
      score: stats.score,
      grade: scoreInfo.grade,
      label: scoreInfo.label,
    },
    findings: filteredFindings.map(f => ({
      id: f.id,
      severity: f.severity.label,
      domain: f.domain || scope.domain || 'general',
      file: f.file,
      line: f.line,
      rule: f.rule,
      description: f.message,
      remediation: f.recommendation,
      complianceRefs: f.complianceRefs || [],
      lineContent: f.lineContent || '',
      category: f.category,
    })),
  }, null, 2);
}

// ────────────────────────────────────────────────────────────────────
// SARIF v2.1.0 Output
// ────────────────────────────────────────────────────────────────────

/**
 * Maps internal severity to SARIF level.
 * SARIF levels: error | warning | note | none
 */
function sarifLevel(severity) {
  switch (severity.level) {
    case 4: return 'error';     // CRITICAL
    case 3: return 'error';     // HIGH
    case 2: return 'warning';   // MEDIUM
    case 1: return 'note';      // LOW
    default: return 'note';     // INFO
  }
}

function generateSARIFReport(filteredFindings, scope, appType, appName) {
  // Collect unique rules
  const ruleMap = new Map();
  for (const f of filteredFindings) {
    if (!ruleMap.has(f.rule)) {
      ruleMap.set(f.rule, {
        id: f.rule,
        name: f.message,
        shortDescription: { text: f.message },
        fullDescription: { text: f.recommendation || f.message },
        helpUri: '',
        properties: {
          category: f.category,
          complianceRefs: f.complianceRefs || [],
        },
        defaultConfiguration: {
          level: sarifLevel(f.severity),
        },
      });
    }
  }

  const results = filteredFindings.map(f => {
    const result = {
      ruleId: f.rule,
      level: sarifLevel(f.severity),
      message: {
        text: `${f.message}. ${f.recommendation || ''}`.trim(),
      },
      locations: [],
    };

    if (f.file && !f.file.startsWith('(')) {
      const location = {
        physicalLocation: {
          artifactLocation: {
            uri: f.file.replace(/\\/g, '/'),
            uriBaseId: '%SRCROOT%',
          },
        },
      };

      if (f.line > 0) {
        location.physicalLocation.region = {
          startLine: f.line,
          startColumn: 1,
        };
      }

      result.locations.push(location);
    }

    if (f.complianceRefs && f.complianceRefs.length > 0) {
      result.properties = { complianceRefs: f.complianceRefs };
    }

    return result;
  });

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Universal App Security Scanner',
            version: '3.0.0',
            informationUri: 'https://github.com/security-agent',
            rules: Array.from(ruleMap.values()),
            properties: {
              appName,
              appType,
            },
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            properties: {
              scanScope: scope.mode,
              scanDomain: scope.domain,
              scanPath: scope.fullPath,
            },
          },
        ],
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

// ────────────────────────────────────────────────────────────────────
// Trend Chart (inline SVG)
// ────────────────────────────────────────────────────────────────────

function renderTrendChart(historyData) {
  if (!historyData || historyData.length < 2) return '';

  const entries = historyData.slice(-20); // last 20 runs
  const width = 600;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 40, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxScore = 100;
  const minScore = 0;
  const stepX = chartW / Math.max(entries.length - 1, 1);

  const points = entries.map((e, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - ((e.score - minScore) / (maxScore - minScore)) * chartH;
    return { x, y, score: e.score, timestamp: e.timestamp };
  });

  const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Gradient fill area
  const areaPath = `M ${points[0].x.toFixed(1)},${(padding.top + chartH).toFixed(1)} ` +
    points.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` L ${points[points.length - 1].x.toFixed(1)},${(padding.top + chartH).toFixed(1)} Z`;

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100].map(val => {
    const y = padding.top + chartH - (val / 100) * chartH;
    return `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="#6b6b80" font-size="10">${val}</text>
            <line x1="${padding.left}" y1="${y}" x2="${padding.left + chartW}" y2="${y}" stroke="#2a2a3d" stroke-width="0.5"/>`;
  }).join('\n');

  // X-axis labels (first and last date)
  const firstDate = new Date(entries[0].timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const lastDate = new Date(entries[entries.length - 1].timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Data point dots
  const dots = points.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#6366f1" stroke="#1a1a2e" stroke-width="1.5"/>`
  ).join('\n');

  // Score change indicator
  const firstScore = entries[0].score;
  const lastScore = entries[entries.length - 1].score;
  const delta = lastScore - firstScore;
  const trendColor = delta >= 0 ? '#22c55e' : '#ef4444';
  const trendArrow = delta >= 0 ? '▲' : '▼';
  const trendText = `${trendArrow} ${Math.abs(delta)} pts`;

  return `
    <div style="margin-top: 1rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
        <h4 style="color: var(--text-secondary); margin: 0;">Score Trend (Last ${entries.length} Scans)</h4>
        <span style="color: ${trendColor}; font-size: 0.85rem; font-weight: 600;">${trendText}</span>
      </div>
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border);">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6366f1" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#6366f1" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        ${yLabels}
        <path d="${areaPath}" fill="url(#areaGrad)"/>
        <polyline points="${polyline}" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
        <text x="${padding.left}" y="${height - 8}" fill="#6b6b80" font-size="10">${firstDate}</text>
        <text x="${padding.left + chartW}" y="${height - 8}" text-anchor="end" fill="#6b6b80" font-size="10">${lastDate}</text>
      </svg>
    </div>`;
}

// ────────────────────────────────────────────────────────────────────
// Executive Summary (HTML)
// ────────────────────────────────────────────────────────────────────

function renderExecutiveSummary(filteredFindings, stats, scoreInfo, historyData) {
  // Top critical/high findings
  const topFindings = filteredFindings
    .filter(f => f.severity.level >= 3)
    .slice(0, 5);

  const topFindingRows = topFindings.length > 0
    ? topFindings.map(f => `
        <div style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.02); border-radius: 6px; border-left: 3px solid ${f.severity.color};">
          <span class="severity-badge" style="background: ${f.severity.color}; flex-shrink: 0;">${f.severity.emoji} ${f.severity.label}</span>
          <div>
            <strong style="font-size: 0.9rem;">${escapeHtml(f.message)}</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">📄 ${escapeHtml(f.file)}${f.line > 0 ? `:${f.line}` : ''} — <code style="color: var(--accent);">${f.rule}</code></div>
          </div>
        </div>
      `).join('')
    : '<p style="color: var(--text-secondary); padding: 1rem;">✅ No critical or high severity issues found.</p>';

  // Sign-off callout for criticals
  const signOffCallout = stats.critical > 0
    ? `<div style="margin-top: 1rem; padding: 1rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px;">
         <strong style="color: #ef4444;">⚠️ Sign-Off Required</strong>
         <p style="color: var(--text-secondary); margin-top: 0.4rem; font-size: 0.85rem;">
           ${stats.critical} critical finding${stats.critical > 1 ? 's' : ''} require${stats.critical === 1 ? 's' : ''} explicit review and sign-off before deployment.
           Each critical item represents a direct security vulnerability that could lead to data exposure or unauthorized access.
         </p>
       </div>`
    : '';

  const trendChart = renderTrendChart(historyData);

  return `
    <div class="executive-summary" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin: 2rem 0;">
      <h2 style="font-size: 1.3rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--accent); display: inline-block;">📋 Executive Summary</h2>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.25rem;">
        This scan identified <strong>${stats.total}</strong> finding${stats.total !== 1 ? 's' : ''} with a security score of
        <strong style="color: ${scoreInfo.color};">${stats.score}/100 (${scoreInfo.grade})</strong>.
        ${stats.critical > 0 ? `<span style="color: var(--critical);"><strong>${stats.critical} critical</strong></span> and ` : ''}
        ${stats.high > 0 ? `<span style="color: var(--high);"><strong>${stats.high} high</strong></span> severity issues require immediate attention.` : 'No critical or high severity issues detected.'}
      </p>

      <h4 style="color: var(--text-secondary); margin-bottom: 0.75rem;">Top Findings Requiring Attention</h4>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${topFindingRows}
      </div>

      ${signOffCallout}
      ${trendChart}
    </div>`;
}

// ────────────────────────────────────────────────────────────────────
// HTML Report
// ────────────────────────────────────────────────────────────────────

function generateHTMLReport(filteredFindings, scope, appType, appName, historyData) {
  const stats = generateStats(filteredFindings);
  const scoreInfo = getScoreGrade(stats.score);
  const scanDate = new Date().toLocaleString();

  const grouped = {};
  for (const f of filteredFindings) {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }

  let categoryCards = '';
  for (const [category, items] of Object.entries(grouped)) {
    const rows = items.map(f => `
      <tr class="finding-row severity-${f.severity.label.toLowerCase()}">
        <td><span class="severity-badge" style="background: ${f.severity.color}">${f.severity.emoji} ${f.severity.label}</span></td>
        <td><code class="rule-id">${f.rule}</code></td>
        <td>
          <strong>${escapeHtml(f.message)}</strong>
          <div class="file-ref">📄 ${escapeHtml(f.file)}${f.line > 0 ? `:${f.line}` : ''}</div>
          ${f.lineContent ? `<div class="code-snippet"><code>${escapeHtml(f.lineContent)}</code></div>` : ''}
          <div class="recommendation">💡 ${escapeHtml(f.recommendation)}</div>
          ${f.complianceRefs && f.complianceRefs.length > 0 ? `<div style="margin-top: 0.4rem; font-size: 0.75rem; color: var(--text-muted);">📏 ${f.complianceRefs.join(', ')}</div>` : ''}
        </td>
      </tr>
    `).join('');

    const critCount = items.filter(i => i.severity.level >= 3).length;
    const headerClass = critCount > 0 ? 'category-critical' : 'category-ok';

    categoryCards += `
      <div class="category-card ${headerClass}">
        <div class="category-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <h3>${category} <span class="badge">${items.length}</span></h3>
          <span class="toggle-icon">▼</span>
        </div>
        <table class="findings-table">
          <thead><tr><th width="120">Severity</th><th width="100">Rule</th><th>Details</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  const categoryBreakdown = Object.entries(stats.byCategory)
    .map(([cat, count]) => `<div class="breakdown-item"><span>${cat}</span><strong>${count}</strong></div>`)
    .join('');

  const executiveSummary = renderExecutiveSummary(filteredFindings, stats, scoreInfo, historyData);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(appName)} — Security Report (${scopeModeLabel(scope)})</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
:root {
  --bg-primary: #0a0a0f; --bg-secondary: #12121a; --bg-card: #1a1a2e; --bg-card-hover: #1f1f35;
  --border: #2a2a3d; --text-primary: #e8e8f0; --text-secondary: #9898b0; --text-muted: #6b6b80;
  --accent: #6366f1; --accent-glow: rgba(99, 102, 241, 0.15);
  --critical: #ef4444; --high: #f97316; --medium: #eab308; --low: #3b82f6; --info: #6b7280; --success: #22c55e;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg-primary); color: var(--text-primary); line-height: 1.6; min-height: 100vh; }
.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
.report-header { text-align: center; padding: 3rem 2rem; background: linear-gradient(135deg, var(--bg-secondary) 0%, #0d0d1a 100%); border-bottom: 1px solid var(--border); position: relative; overflow: hidden; }
.report-header::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(ellipse at center, var(--accent-glow) 0%, transparent 70%); animation: pulse 4s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
.report-header h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.5px; position: relative; background: linear-gradient(135deg, #fff 0%, #a5a5ff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.report-header .subtitle { color: var(--text-secondary); margin-top: 0.5rem; font-size: 0.95rem; position: relative; }
.scan-scope { margin-top: 1rem; position: relative; }
.scope-badge { display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); color: #a5b4fc; padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.9rem; font-weight: 500; backdrop-filter: blur(4px); }
.scope-badge code { font-family: 'JetBrains Mono', monospace; color: #c4b5fd; font-size: 0.85rem; }
.mode-pill { display: inline-block; margin-top: 0.6rem; padding: 0.3rem 0.9rem; border-radius: 14px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
.mode-root { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
.mode-folder { background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234,179,8,0.3); }
.mode-file { background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
.scan-meta { display: flex; justify-content: center; gap: 2rem; margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted); position: relative; flex-wrap: wrap; }
.scope-note { max-width: 700px; margin: 1rem auto 0; font-size: 0.8rem; color: var(--text-muted); background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; position: relative; }
.score-section { display: grid; grid-template-columns: 250px 1fr; gap: 2rem; margin: 2rem 0; }
.score-circle { display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 2rem; position: relative; }
.score-value { font-size: 4.5rem; font-weight: 800; line-height: 1; }
.score-grade { font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem; }
.score-label { color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem; }
.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; }
.stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; text-align: center; transition: all 0.2s ease; }
.stat-card:hover { background: var(--bg-card-hover); transform: translateY(-2px); }
.stat-card .stat-number { font-size: 2rem; font-weight: 700; }
.stat-card .stat-label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-top: 0.25rem; }
.stat-critical .stat-number { color: var(--critical); }
.stat-high .stat-number { color: var(--high); }
.stat-medium .stat-number { color: var(--medium); }
.stat-low .stat-number { color: var(--low); }
.stat-info .stat-number { color: var(--info); }
.breakdown-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-top: 1rem; }
.breakdown-item { display: flex; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
.breakdown-item:last-child { border-bottom: none; }
.findings-section { margin-top: 2.5rem; }
.findings-section > h2 { font-size: 1.4rem; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 2px solid var(--accent); display: inline-block; }
.category-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 1.5rem; overflow: hidden; transition: all 0.2s ease; }
.category-critical { border-left: 4px solid var(--critical); }
.category-ok { border-left: 4px solid var(--success); }
.category-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; cursor: pointer; background: var(--bg-secondary); user-select: none; }
.category-header:hover { background: var(--bg-card-hover); }
.category-header h3 { font-size: 1.1rem; font-weight: 600; }
.badge { display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; font-size: 0.75rem; font-weight: 600; padding: 0.15rem 0.6rem; border-radius: 20px; margin-left: 0.75rem; }
.toggle-icon { font-size: 0.8rem; color: var(--text-muted); transition: transform 0.2s; }
.collapsed .toggle-icon { transform: rotate(-90deg); }
.collapsed .findings-table { display: none; }
.findings-table { width: 100%; border-collapse: collapse; }
.findings-table th { text-align: left; padding: 0.75rem 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
.findings-table td { padding: 1rem; border-bottom: 1px solid var(--border); vertical-align: top; }
.finding-row:last-child td { border-bottom: none; }
.finding-row:hover { background: var(--bg-card-hover); }
.severity-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.7rem; font-weight: 600; color: #fff; white-space: nowrap; }
.rule-id { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--accent); background: var(--accent-glow); padding: 0.15rem 0.5rem; border-radius: 4px; }
.file-ref { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.35rem; }
.code-snippet { margin-top: 0.5rem; background: #0d0d15; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--border); overflow-x: auto; }
.code-snippet code { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #e2e8f0; white-space: pre; }
.recommendation { margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary); padding: 0.5rem 0.75rem; background: rgba(99, 102, 241, 0.05); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; }
.report-footer { text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem; border-top: 1px solid var(--border); margin-top: 3rem; }
@media (max-width: 768px) { .score-section { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: repeat(3, 1fr); } .scan-meta { flex-direction: column; gap: 0.5rem; } }
@media print { body { background: #fff; color: #000; } .category-header { background: #f5f5f5; } .collapsed .findings-table { display: table !important; } }
</style>
</head>
<body>
<header class="report-header">
  <h1>🛡️ ${escapeHtml(appName)}</h1>
  <p class="subtitle">Security Scan Report — Static Security Analysis</p>
  <div class="scan-scope">
    <span class="scope-badge">${scope.icon} ${scope.label} — <code>${scope.fullPath}</code></span>
  </div>
  <div><span class="mode-pill mode-${scope.mode}">${scopeModeLabel(scope)}</span></div>
  <div class="scan-meta">
    <span>📅 ${scanDate}</span>
    <span>📁 ${new Set(filteredFindings.map(f => f.file)).size} files referenced</span>
    <span>⚡ ${stats.total} findings</span>
    <span>🏷️ App type: ${appType}</span>
  </div>
  ${scope.mode === 'folder' ? `<div class="scope-note">This is a <strong>folder-level scan</strong> scoped to <code>${scope.path}/</code> (domain: <strong>${scope.domain}</strong>). Project-wide checks like root/jailbreak detection, code obfuscation, or biometric auth are intentionally <strong>not</strong> evaluated here — they belong to the root-level scan. This report only checks things relevant to a <strong>${scope.domain}</strong> folder.</div>` : ''}
  ${scope.mode === 'file' ? `<div class="scope-note">This is a <strong>file-level scan</strong>. Only per-file rules were checked — no project-wide or folder-wide inverse checks apply at this scope.</div>` : ''}
</header>

<div class="container">
  ${executiveSummary}

  <div class="score-section">
    <div class="score-circle">
      <div class="score-value" style="color: ${scoreInfo.color}">${stats.score}</div>
      <div class="score-grade" style="color: ${scoreInfo.color}">Grade: ${scoreInfo.grade}</div>
      <div class="score-label">${scoreInfo.label}</div>
    </div>
    <div>
      <div class="stats-grid">
        <div class="stat-card stat-critical"><div class="stat-number">${stats.critical}</div><div class="stat-label">Critical</div></div>
        <div class="stat-card stat-high"><div class="stat-number">${stats.high}</div><div class="stat-label">High</div></div>
        <div class="stat-card stat-medium"><div class="stat-number">${stats.medium}</div><div class="stat-label">Medium</div></div>
        <div class="stat-card stat-low"><div class="stat-number">${stats.low}</div><div class="stat-label">Low</div></div>
        <div class="stat-card stat-info"><div class="stat-number">${stats.info}</div><div class="stat-label">Info</div></div>
      </div>
      <div class="breakdown-section">
        <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary);">By Category</h4>
        ${categoryBreakdown}
      </div>
    </div>
  </div>

  <div class="findings-section">
    <h2>🔍 Detailed Findings</h2>
    ${categoryCards || '<p style="color: var(--text-secondary); text-align: center; padding: 3rem;">✅ No security issues found at this scope.</p>'}
  </div>
</div>

<footer class="report-footer">
  <p>Generated by <strong>Universal App Security Scanner</strong> • ${escapeHtml(appName)} • ${scanDate}</p>
  <p>This is a static analysis report. Manual review is recommended for all findings.</p>
</footer>
</body>
</html>`;
}

// ────────────────────────────────────────────────────────────────────
// Markdown Report
// ────────────────────────────────────────────────────────────────────

function generateMarkdownReport(filteredFindings, scope, appType, appName) {
  const stats = generateStats(filteredFindings);
  const scoreInfo = getScoreGrade(stats.score);
  const scanDate = new Date().toLocaleString();

  let md = `# 🛡️ ${appName} — Security Scan Report

**Scope:** ${scopeModeLabel(scope)} — ${scope.icon} ${scope.label} (\`${scope.fullPath}\`)
**App Type:** ${appType}
**Date:** ${scanDate}
**Security Score:** ${stats.score}/100 (${scoreInfo.grade} - ${scoreInfo.label})

`;

  if (scope.mode === 'folder') {
    md += `> **Note:** This is a folder-level scan scoped to \`${scope.path}/\` (domain: **${scope.domain}**). Project-wide checks (root/jailbreak detection, obfuscation, biometrics) are intentionally excluded — run a root-level scan for those.\n\n`;
  }
  if (scope.mode === 'file') {
    md += `> **Note:** File-level scan. Only per-file rules apply; no inverse/project-wide checks at this scope.\n\n`;
  }

  md += `---

## 📊 Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${stats.critical} |
| 🟠 High | ${stats.high} |
| 🟡 Medium | ${stats.medium} |
| 🔵 Low | ${stats.low} |
| ⚪ Info | ${stats.info} |
| **Total** | **${stats.total}** |

---

## 🔍 Findings

`;

  const grouped = {};
  for (const f of filteredFindings) {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }

  for (const [category, items] of Object.entries(grouped)) {
    md += `### ${category}\n\n`;
    for (const f of items) {
      md += `#### ${f.severity.emoji} [${f.severity.label}] ${f.message} (\`${f.rule}\`)\n\n`;
      md += `- **File:** \`${f.file}\`${f.line > 0 ? ` (line ${f.line})` : ''}\n`;
      if (f.lineContent) md += `- **Code:** \`${f.lineContent}\`\n`;
      md += `- **Fix:** ${f.recommendation}\n`;
      if (f.complianceRefs && f.complianceRefs.length > 0) {
        md += `- **Compliance:** ${f.complianceRefs.join(', ')}\n`;
      }
      md += '\n';
    }
  }

  md += `---\n\n*Generated by Universal App Security Scanner • ${appName} • ${scanDate}*\n`;
  return md;
}

// ────────────────────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────────────────────

module.exports = {
  filterBySeverity,
  generateStats,
  getScoreGrade,
  generateHTMLReport,
  generateMarkdownReport,
  generateJSONReport,
  generateSARIFReport,
};
