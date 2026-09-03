module.exports = {
  FORBIDDEN_COMPONENT_PATTERNS: [
    { pattern: /axios\.(get|post|put|delete|patch)/i, ruleId: 'NO-DIRECT-AXIOS', message: 'Direct axios call in component file' },
    { pattern: /\bfetch\s*\(/i, ruleId: 'NO-DIRECT-FETCH', message: 'Direct fetch() call in component file' },
    { pattern: /\buseQuery\s*\(/i, ruleId: 'NO-USE-QUERY-IN-COMPONENT', message: 'Direct useQuery in JSX component (move to useXxxScreen.ts)' },
    { pattern: /\buseMutation\s*\(/i, ruleId: 'NO-USE-MUTATION-IN-COMPONENT', message: 'Direct useMutation in JSX component (move to useXxxScreen.ts)' }
  ]
};
