# Generate Mutation Command

Scaffold a typed `useMutation` hook for `POST`, `PUT`, `PATCH`, or `DELETE` requests.

---

## Requirements

1. Extract payload interface, path params, and response shape.
2. Add constant in `src/api/endPoints.ts` if missing.
3. Create `src/types/{camelName}.types.ts` with Payload and Response types.
4. Create `src/api/{camelName}.api.ts` with fetcher function.
5. Create `src/hooks/mutation/use{PascalName}Mutation.ts` with:
   - Query invalidation on success: `queryClient.invalidateQueries(...)`
   - `meta: API_TOAST` (or optional toast metadata)
   - Detailed logging for success and error states
6. Re-export in barrels.
7. Run `npx tsc --noEmit` and confirm 0 errors.
