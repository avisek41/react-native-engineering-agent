/**
 * Terminal & JSON Report Formatter for Integration Agent
 */
class IntegrationReport {
  static printFindings(findings, options = {}) {
    if (options.json) {
      console.log(JSON.stringify(findings, null, 2));
      return;
    }

    console.log('\n=============================================');
    console.log('   🔗 Integration Agent Static Code Analysis  ');
    console.log('=============================================\n');

    if (findings.length === 0) {
      console.log('✅ 0 issues found. Screen integration layer is fully compliant with standards!\n');
      return;
    }

    const errors = findings.filter(f => f.severity === 'error');
    const warnings = findings.filter(f => f.severity === 'warn');

    console.log(`Found ${findings.length} issue(s) (${errors.length} errors, ${warnings.length} warnings):\n`);

    findings.forEach((f, idx) => {
      const badge = f.severity === 'error' ? '🔴 ERROR' : '🟡 WARN';
      console.log(`${idx + 1}. [${f.ruleId}] ${badge} - ${f.filePath}:${f.line}`);
      console.log(`   Message: ${f.message}\n`);
    });
  }
}

module.exports = IntegrationReport;
