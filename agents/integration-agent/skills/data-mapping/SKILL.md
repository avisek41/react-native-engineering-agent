---
name: data-mapping
description: Protocol for transforming backend API models into UI ViewModels via deterministic, pure display mappers.
---

# Data Mapping Skill

This skill defines rules for creating pure display mappers in `src/utils/*Display.ts`.

---

## 1. Mapper Rules

1. **Location**: Pure mappers live in `src/utils/{camelName}Display.ts`.
2. **Pure Functions**: Mappers must be deterministic, pure functions with no network calls or side effects.
3. **Null & Undefined Safety**:
   - Provide safe fallbacks for missing or null API values (e.g. `title: row.title ?? ''`).
4. **ID Serialization**:
   - Always convert numeric or Mongo IDs to `string` (e.g. `id: String(row.id)`).
5. **No Invented Fields**:
   - If Figma asks for a field not provided by Swagger (listed in `figmaFieldsWithoutApi`), leave it `undefined` or omit it. Never invent mock data inside mappers.

---

## 2. Example Mapper Pattern

```ts
import type { UserProfileApiRow } from 'types';
import type { UserProfileViewModel } from 'screens/Main/Profile/types';

export const mapUserProfileApiRowToViewModel = (
  row: UserProfileApiRow,
): UserProfileViewModel => ({
  id: String(row.id),
  fullName: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
  email: row.email ?? '',
  phone: row.phone ?? undefined,
  avatarUrl: row.profilePhotoUrl ?? undefined,
});
```
