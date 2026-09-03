'use strict';

const fs = require('fs');
const path = require('path');
const { FOLDER_DOMAINS } = require('./constants');

/**
 * Determines scan scope: 'root' | 'folder' | 'file'
 * For 'folder' scope, also resolves a known domain (services, navigation,
 * etc.) when the folder name matches the project's taxonomy. Falls back
 * to domain 'generic' for unrecognized folder names so unknown folders
 * still get a sensible (if generic) treatment rather than crashing or
 * silently behaving like root.
 *
 * Root detection rule: a directory counts as ROOT if its name is "src",
 * or if the relative path passed by the user is "." / "./", OR if the
 * directory directly contains a package.json (project root without a
 * src/ convention). This mirrors what most RN projects look like.
 *
 * @param {string} targetDir  - Absolute path to scan target
 * @param {string} rawArg     - Original CLI argument (e.g. './src')
 * @param {object} [mergedDomains] - Optional merged FOLDER_DOMAINS map
 *        (built-in + config's customDomainRules keys). Defaults to
 *        the built-in FOLDER_DOMAINS if not provided.
 */
function detectScanScope(targetDir, rawArg, mergedDomains) {
  const domains = mergedDomains || FOLDER_DOMAINS;
  const stat = fs.statSync(targetDir);
  const baseName = path.basename(targetDir);
  const relativePath = rawArg || '.';

  if (stat.isFile()) {
    return {
      mode: 'file',
      icon: '📄',
      label: `File Scan — ${baseName}`,
      domain: inferFileDomain(targetDir, domains),
      path: baseName,
      fullPath: relativePath,
    };
  }

  const looksLikeRoot =
    baseName === 'src' ||
    relativePath === '.' ||
    relativePath === './' ||
    fs.existsSync(path.join(targetDir, 'package.json'));

  if (looksLikeRoot) {
    return {
      mode: 'root',
      icon: '🏗️',
      label: 'Root / Full Project Scan',
      domain: 'root',
      path: baseName,
      fullPath: relativePath,
    };
  }

  const domain = domains[baseName.toLowerCase()] || 'generic';

  return {
    mode: 'folder',
    icon: '📁',
    label: `Folder Scan — ${baseName}`,
    domain,
    path: baseName,
    fullPath: relativePath,
  };
}

/**
 * Best-effort domain inference for a single file, based on its parent
 * directory name. Used in FILE mode purely for labeling/reporting —
 * file mode never runs inverse/project-wide checks regardless of domain.
 */
function inferFileDomain(filePath, mergedDomains) {
  const domains = mergedDomains || FOLDER_DOMAINS;
  const parentDir = path.basename(path.dirname(filePath)).toLowerCase();
  return domains[parentDir] || 'generic';
}

/**
 * Builds a merged FOLDER_DOMAINS map from the built-in defaults
 * plus any custom domain rule keys from the config file.
 */
function buildMergedDomains(customDomainRules) {
  if (!customDomainRules || Object.keys(customDomainRules).length === 0) {
    return FOLDER_DOMAINS;
  }
  const merged = { ...FOLDER_DOMAINS };
  for (const domainName of Object.keys(customDomainRules)) {
    if (!merged[domainName]) {
      merged[domainName] = domainName;
    }
  }
  return merged;
}

module.exports = { detectScanScope, buildMergedDomains };
