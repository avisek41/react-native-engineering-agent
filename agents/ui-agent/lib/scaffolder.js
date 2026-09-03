const fs = require('fs');
const path = require('path');

function toPascalCase(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
    .replace(/[\s_-]+/g, '');
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toScreamingSnakeCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}

function fillTemplate(templateContent, vars) {
  let result = templateContent;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * Scaffold a new screen structure under src/screens/{stack}/{name}
 */
function scaffoldScreen(screenName, options = {}) {
  const stack = options.stack || 'Main';
  const rootDir = options.rootDir || process.cwd();
  const pascal = toPascalCase(screenName);
  const camel = toCamelCase(screenName);
  const kebab = toKebabCase(screenName);
  const screaming = toScreamingSnakeCase(screenName);

  const targetDir = path.join(rootDir, 'src', 'screens', stack, pascal);
  const componentsDir = path.join(targetDir, 'Components');
  const stringsDir = path.join(rootDir, 'src', 'constant', 'strings');

  if (fs.existsSync(targetDir)) {
    throw new Error(`Screen directory already exists: ${targetDir}`);
  }

  fs.mkdirSync(componentsDir, { recursive: true });

  const templatesDir = path.join(__dirname, '..', 'templates');
  const screenTemplate = fs.readFileSync(path.join(templatesDir, 'ScreenTemplate.tsx'), 'utf-8');
  const typesTemplate = fs.readFileSync(path.join(templatesDir, 'TypesTemplate.ts'), 'utf-8');
  const stringsTemplate = fs.readFileSync(path.join(templatesDir, 'StringsTemplate.ts'), 'utf-8');

  const vars = {
    PascalName: pascal,
    camelName: camel,
    kebabName: kebab,
    SCREAMING_NAME: screaming,
    TITLE: pascal.replace(/([A-Z])/g, ' $1').trim(),
  };

  // 1. Screen component file
  fs.writeFileSync(path.join(targetDir, `${pascal}.tsx`), fillTemplate(screenTemplate, vars));

  // 2. Types file
  fs.writeFileSync(path.join(targetDir, 'types.ts'), fillTemplate(typesTemplate, vars));

  // 3. Barrel index.ts
  fs.writeFileSync(path.join(targetDir, 'index.ts'), `export { default as ${pascal} } from './${pascal}';\n`);

  // 4. Strings module file
  if (!fs.existsSync(stringsDir)) {
    fs.mkdirSync(stringsDir, { recursive: true });
  }
  const stringsFile = path.join(stringsDir, `${camel}.ts`);
  if (!fs.existsSync(stringsFile)) {
    fs.writeFileSync(stringsFile, fillTemplate(stringsTemplate, vars));
  }

  return {
    screenDir: targetDir,
    files: [
      path.join(targetDir, `${pascal}.tsx`),
      path.join(targetDir, 'types.ts'),
      path.join(targetDir, 'index.ts'),
      stringsFile,
    ],
  };
}

/**
 * Scaffold a reusable component under src/components/ui/{name}
 */
function scaffoldComponent(componentName, options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const pascal = toPascalCase(componentName);
  const kebab = toKebabCase(componentName);

  const targetDir = path.join(rootDir, 'src', 'components', 'ui', pascal);
  if (fs.existsSync(targetDir)) {
    throw new Error(`Component directory already exists: ${targetDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const templatesDir = path.join(__dirname, '..', 'templates');
  const compTemplate = fs.readFileSync(path.join(templatesDir, 'ComponentTemplate.tsx'), 'utf-8');
  const typesTemplate = fs.readFileSync(path.join(templatesDir, 'TypesTemplate.ts'), 'utf-8');

  const vars = {
    PascalName: pascal,
    kebabName: kebab,
  };

  fs.writeFileSync(path.join(targetDir, `${pascal}.tsx`), fillTemplate(compTemplate, vars));
  fs.writeFileSync(path.join(targetDir, 'types.ts'), fillTemplate(typesTemplate, vars));
  fs.writeFileSync(path.join(targetDir, 'index.ts'), `export { default as ${pascal} } from './${pascal}';\nexport * from './types';\n`);

  return {
    componentDir: targetDir,
    files: [
      path.join(targetDir, `${pascal}.tsx`),
      path.join(targetDir, 'types.ts'),
      path.join(targetDir, 'index.ts'),
    ],
  };
}

module.exports = {
  scaffoldScreen,
  scaffoldComponent,
};
