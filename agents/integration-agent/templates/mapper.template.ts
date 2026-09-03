import type { {{PascalName}}Item } from 'types';
import type { {{PascalName}}ViewModel } from 'screens/Main/{{PascalName}}/types';

/**
 * Pure Display Mapper: transforms backend API models to UI ViewModels
 */
export const map{{PascalName}}ApiRowToViewModel = (
  row: {{PascalName}}Item,
): {{PascalName}}ViewModel => ({
  id: String(row.id),
  // TODO: Map properties with null-safe fallbacks
});
