/**
 * Formats findings for console and markdown output
 */

function printConsoleReport(summary) {
  console.log('\n========================================');
  console.log('       🎨 UI Agent Validation Report    ');
  console.log('========================================\n');

  console.log(`📁 Files Scanned : ${summary.totalFilesScanned}`);
  console.log(`🔍 Total Findings: ${summary.totalFindings}`);
  console.log(`   🔴 Errors     : ${summary.errors}`);
  console.log(`   🟡 Warnings   : ${summary.warnings}`);
  console.log(`   🔵 Info       : ${summary.infos}\n`);

  if (summary.findings.length === 0) {
    console.log('✨ All files comply with UI design tokens & standards!\n');
    return;
  }

  summary.findings.forEach((f, idx) => {
    const icon = f.severity === 'error' ? '🔴' : f.severity === 'warn' ? '🟡' : '🔵';
    console.log(`${icon} [${f.ruleId}] ${f.ruleName}`);
    console.log(`   📍 ${f.file}:${f.line}`);
    console.log(`   💬 ${f.description}`);
    console.log(`   📝 "${f.snippet}"\n`);
  });
}

function generateMarkdownReport(summary) {
  let md = '# UI Agent Validation Report\n\n';
  md += `- **Files Scanned**: ${summary.totalFilesScanned}\n`;
  md += `- **Total Findings**: ${summary.totalFindings} (🔴 ${summary.errors} errors, 🟡 ${summary.warnings} warnings, 🔵 ${summary.infos} info)\n\n`;

  if (summary.findings.length === 0) {
    md += '### ✅ Clean - No UI Violations Found\n';
    return md;
  }

  md += '| Severity | Rule | File | Line | Snippet |\n';
  md += '|---|---|---|---|---|\n';

  summary.findings.forEach((f) => {
    const icon = f.severity === 'error' ? '🔴' : f.severity === 'warn' ? '🟡' : '🔵';
    md += `| ${icon} ${f.severity} | **${f.ruleId}**: ${f.ruleName} | \`${f.file}\` | ${f.line} | \`${f.snippet.replace(/\|/g, '\\|')}\` |\n`;
  });

  return md;
}

module.exports = {
  printConsoleReport,
  generateMarkdownReport,
};
