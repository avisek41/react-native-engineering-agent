const fs = require('fs');
const path = require('path');
const { FORBIDDEN_COMPONENT_PATTERNS } = require('./constants');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.tsx') && !file.endsWith('.test.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

function validateIntegration(targetDir) {
  const files = fs.statSync(targetDir).isDirectory() ? walk(targetDir) : [targetDir];
  const findings = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      for (const rule of FORBIDDEN_COMPONENT_PATTERNS) {
        if (rule.pattern.test(line)) {
          findings.push({
            file,
            line: index + 1,
            ruleId: rule.ruleId,
            message: rule.message,
            snippet: line.trim()
          });
        }
      }
    });
  }

  return findings;
}

module.exports = { validateIntegration };
