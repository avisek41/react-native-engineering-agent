const fs = require('fs');
const path = require('path');

/**
 * Scaffolder for generating boilerplate API, Hook, and Type files
 */
class ApiScaffolder {
  constructor(options = {}) {
    this.name = options.name || 'sampleModule';
    this.endpoint = options.endpoint || '/sample/endpoint';
    this.method = (options.method || 'GET').toUpperCase();
    this.type = options.type || 'query'; // 'query' | 'infinite' | 'mutation'

    this.camelName = this.toCamelCase(this.name);
    this.pascalName = this.toPascalCase(this.name);
    this.screamingName = this.toScreamingSnake(this.name);
  }

  toCamelCase(str) {
    return str
      .replace(/[-_/\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, c => c.toLowerCase());
  }

  toPascalCase(str) {
    const camel = this.toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  toScreamingSnake(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-/\s]+/g, '_')
      .toUpperCase()
      .replace(/^_+|_+$/g, '');
  }

  generate(dryRun = false) {
    const templatesDir = path.resolve(__dirname, '../templates');
    const createdFiles = [];

    // 1. Generate Types
    const typesTemplatePath = path.join(templatesDir, 'types.template.ts');
    let typesContent = fs.readFileSync(typesTemplatePath, 'utf-8');
    typesContent = typesContent.replace(/\{\{PascalName\}\}/g, this.pascalName);

    const typesFilePath = path.resolve(process.cwd(), `src/types/${this.camelName}.types.ts`);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(typesFilePath), { recursive: true });
      fs.writeFileSync(typesFilePath, typesContent, 'utf-8');
    }
    createdFiles.push(typesFilePath);

    // 2. Generate API Fetcher
    const apiTemplatePath = path.join(templatesDir, 'api.template.ts');
    let apiContent = fs.readFileSync(apiTemplatePath, 'utf-8');
    apiContent = apiContent
      .replace(/\{\{PascalName\}\}/g, this.pascalName)
      .replace(/\{\{camelName\}\}/g, this.camelName)
      .replace(/\{\{SCREAMING_NAME\}\}/g, this.screamingName)
      .replace(/\{\{METHOD\}\}/g, this.method);

    const apiFilePath = path.resolve(process.cwd(), `src/api/${this.camelName}.api.ts`);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(apiFilePath), { recursive: true });
      fs.writeFileSync(apiFilePath, apiContent, 'utf-8');
    }
    createdFiles.push(apiFilePath);

    // 3. Generate Hook based on type
    let hookTemplateName = 'query.template.ts';
    let hookSubdir = 'queries';
    let hookFileName = `use${this.pascalName}Query.ts`;

    if (this.type === 'infinite') {
      hookTemplateName = 'infiniteQuery.template.ts';
      hookSubdir = 'queries';
      hookFileName = `use${this.pascalName}InfiniteQuery.ts`;
    } else if (this.type === 'mutation') {
      hookTemplateName = 'mutation.template.ts';
      hookSubdir = 'mutation';
      hookFileName = `use${this.pascalName}Mutation.ts`;
    }

    const hookTemplatePath = path.join(templatesDir, hookTemplateName);
    let hookContent = fs.readFileSync(hookTemplatePath, 'utf-8');
    hookContent = hookContent
      .replace(/\{\{PascalName\}\}/g, this.pascalName)
      .replace(/\{\{camelName\}\}/g, this.camelName);

    const hookFilePath = path.resolve(process.cwd(), `src/hooks/${hookSubdir}/${hookFileName}`);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(hookFilePath), { recursive: true });
      fs.writeFileSync(hookFilePath, hookContent, 'utf-8');
    }
    createdFiles.push(hookFilePath);

    return {
      createdFiles,
      pascalName: this.pascalName,
      camelName: this.camelName,
      screamingName: this.screamingName,
    };
  }
}

module.exports = ApiScaffolder;
