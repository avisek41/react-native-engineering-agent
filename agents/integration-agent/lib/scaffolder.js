const fs = require('fs');
const path = require('path');

function scaffoldHook(screenName, stackName = 'Main', targetRoot = './src') {
  const hookTemplatePath = path.join(__dirname, '..', 'templates', 'ScreenHookTemplate.ts');
  let content = fs.readFileSync(hookTemplatePath, 'utf8');

  content = content.replace(/__Entity__/g, screenName);

  const outDir = path.join(targetRoot, 'screens', stackName, `${screenName}Screen`);
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, `use${screenName}Screen.ts`);
  fs.writeFileSync(outFile, content, 'utf8');

  return outFile;
}

module.exports = { scaffoldHook };
