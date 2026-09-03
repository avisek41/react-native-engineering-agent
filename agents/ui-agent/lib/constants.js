/**
 * UI Agent Constants and Rule Patterns
 */

const SEVERITY = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
};

const RULES = [
  {
    id: 'UI-HEX-001',
    name: 'No Hardcoded Hex Colors',
    description: 'All colors must come from COLORS in @theme instead of inline hex codes',
    severity: SEVERITY.ERROR,
    pattern: /#(?:[0-9a-fA-F]{3,4}){1,2}\b(?!.*testID)/g,
    fileTypes: ['.tsx', '.ts'],
  },
  {
    id: 'UI-API-001',
    name: 'Forbidden API Hook in UI',
    description: 'Presentational UI screens/components must not directly call useQuery, useMutation, or useInfiniteQuery',
    severity: SEVERITY.ERROR,
    pattern: /\b(useQuery|useMutation|useInfiniteQuery)\s*\(/g,
    fileTypes: ['.tsx'],
  },
  {
    id: 'UI-API-002',
    name: 'Forbidden API Module Import in Screen',
    description: 'Presentational screens must not import from src/api/ directly',
    severity: SEVERITY.ERROR,
    pattern: /from\s+['"].*\/api(\/.*)?['"]/g,
    fileTypes: ['.tsx'],
  },
  {
    id: 'UI-LIST-001',
    name: 'Prefer LegendList for Product Lists',
    description: 'Use LegendList instead of React Native FlatList for large product lists',
    severity: SEVERITY.WARN,
    pattern: /<FlatList\b/g,
    fileTypes: ['.tsx'],
  },
  {
    id: 'UI-RN-PRIM-001',
    name: 'Prefer Gluestack Over React Native View/TouchableOpacity',
    description: 'Use Gluestack Box, HStack, VStack, Pressable instead of View or TouchableOpacity',
    severity: SEVERITY.WARN,
    pattern: /<(TouchableOpacity|TouchableHighlight)\b/g,
    fileTypes: ['.tsx'],
  },
  {
    id: 'UI-TESTID-001',
    name: 'Missing testID on Screen Container or Interactive Button',
    description: 'Screens and AppButtons should include a testID prop for E2E testing',
    severity: SEVERITY.INFO,
    pattern: /<(AppButton|ScreenContainer)\b(?![^>]*testID)/g,
    fileTypes: ['.tsx'],
  },
];

module.exports = {
  SEVERITY,
  RULES,
};
