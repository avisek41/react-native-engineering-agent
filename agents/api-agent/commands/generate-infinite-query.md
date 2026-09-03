# Generate Infinite Query Command

Scaffold a paginated `useInfiniteQuery` hook for list or search endpoints.

---

## Requirements

1. Identify pagination strategy: `page`/`limit` vs `skip`/`limit` vs cursor.
2. Add constant in `src/api/endPoints.ts` if missing.
3. Create `src/types/{camelName}.types.ts` with `{PascalName}Item`, `{PascalName}Params`, `{PascalName}Response`.
4. Create `src/api/{camelName}.api.ts` with `fetch{PascalName}`.
5. Create `src/hooks/queries/use{PascalName}InfiniteQuery.ts` with:
   - `initialPageParam` (0 or 1)
   - `getNextPageParam` logic
   - `select` mapper returning `{ items, total }`
   - `queryKey` list factory function
6. Re-export in barrels.
7. Run `npx tsc --noEmit` and confirm 0 errors.
