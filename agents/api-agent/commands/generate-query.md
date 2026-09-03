# Generate Query Command

Scaffold a typed `useQuery` hook for single-item or detail fetching.

---

## Requirements

1. Prompt for or parse endpoint path, response schema, and query/path params.
2. Add constant in `src/api/endPoints.ts` if missing.
3. Create `src/types/{camelName}.types.ts` with `{PascalName}Response` and `{PascalName}Params`.
4. Create `src/api/{camelName}.api.ts` with `fetch{PascalName}`.
5. Create `src/hooks/queries/use{PascalName}Query.ts` with query keys and destructuring params.
6. Export from `src/types/index.ts` and `src/hooks/index.ts`.
7. Run `npx tsc --noEmit` and confirm 0 errors.
