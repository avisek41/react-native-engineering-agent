---
name: api-implementation
description: >-
  Generates endpoint constants, TypeScript types, API functions, and React Query
  hooks from a Swagger/OpenAPI contract or a plain spec. Use only after reuse
  search, when creating or updating API layer files. Do not implement screens.
disable-model-invocation: true
---

# API Implementation Skill

How to create API-layer files in this repo. Decisions (reuse vs create, Swagger discovery) belong to the **API Agent**. This skill is the file-generation playbook.

Read [reference.md](reference.md) for types, `apiRequest`, query, infinite-query, and mutation templates.

---

## When to Use

After the API Agent has extracted a contract and confirmed the endpoint/hook is **missing** (or must be updated).

Do not use this skill to wire screens, pull-to-refresh, or Figma UI.

---

## Spec Format (Required Before Generating)

Convert Swagger (or the user spec) into:

```
Endpoint : mobile/programs/:programId/teams
Method   : GET | POST | PUT | PATCH | DELETE
Payload  : field:type field?:type   (POST | PUT | PATCH only)
Params   : field:type               (query / path params)
Response : field:type field?:type
skipAuth : true | false             (default false)
paging   : page/limit | skip/limit | none
```

- Use **only** fields from the contract. Never invent.
- `skipAuth: false` unless Swagger marks the operation public (login/refresh).
- Pagination must match Swagger (`page`/`limit` vs `skip`/`limit`). Do not default to DummyJSON-style `skip` when the API uses `page`.

---

## Reuse Search (Mandatory)

Before creating files, search:

1. `src/api/endPoints.ts`
2. `src/api/*.api.ts`
3. `src/types/*.types.ts` and `src/types/index.ts`
4. `src/hooks/queries/` and `src/hooks/mutation/`
5. `src/hooks/index.ts`

If the endpoint, function, types, or hook already exist → **stop generating**. Report reuse in the API Handoff.

---

## File Map (Create Only What is Missing)

```
src/api/endPoints.ts                         ← add constant if missing
src/types/{camelName}.types.ts               ← types only, zero imports
src/types/index.ts                           ← append exports
src/api/{camelName}.api.ts                   ← fetch + re-export types
src/hooks/queries/use{PascalName}Query.ts           ← GET single
src/hooks/queries/use{PascalName}InfiniteQuery.ts   ← GET list / paginated
src/hooks/mutation/use{PascalName}Mutation.ts       ← POST | PUT | PATCH | DELETE
src/hooks/index.ts                           ← append exports
```

Folder is `src/hooks/mutation/` (singular), never `hooks/mutations/`.

---

## Name Derivation (From Path, Never Invent)

```
/products/search     → productsSearch / ProductsSearch / PRODUCTS_SEARCH
/auth/login          → authLogin / AuthLogin / AUTH_LOGIN
/orders/:id/items    → ordersItems (strip :param segments)
```

Read `endPoints.ts` first. If a constant exists, use that exact name even when it does not mirror the path (`USER` for `user/me` is valid).

---

## Hook Type Decision Matrix

| Method | Hook | Folder |
| --- | --- | --- |
| GET list / search / paginated | `useInfiniteQuery` | `hooks/queries/` |
| GET single / by id | `useQuery` | `hooks/queries/` |
| POST / PUT / PATCH / DELETE | `useMutation` | `hooks/mutation/` |

List heuristic: path contains `search`, `list`, `feed`, `all`, or response has an array plus `total` / `count` / `hasNextPage`.

---

## Generation Rules

- Types live only in `src/types/{camelName}.types.ts`. Export order: Item → Payload → Params → Response.
- API files import types from the `'types'` barrel, never `types/foo.types`.
- HTTP methods are string literals `'GET' | 'POST' | …` — not `STRINGS`.
- Log only inside `queryFn` / `mutationFn` / fetch functions via `logger` from `'utils'`.
- `apiRequest` from `api/apiClient`. `ApiError` only from `api/apiClient`.
- Query keys: `all` plus `list(...)` or `detail(id?)` as **functions**.
- Always set `staleTime` and `gcTime` on queries. Retry: skip 4xx, max 2 for 5xx.
- Mutations: invalidate `{camelName}Keys.all` on success. Use `API_TOAST` / `apiToast` from `utils/queryToastMeta` when sibling mutations do.
- Passwords: `encrypt()` from `'utils'` before send.
- Do not emit screen usage, `usePullToRefresh`, or FlatList/LegendList snippets. That is Integration.

---

## Loop Engineering: Self-Verification & Convergence Cycle

Before completing any API generation, execute the **Closed-Loop Verification Engine**:

```
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│ 1. Generate     │ ────▶ │ 2. Verify Gate (TSC) │ ────▶ │ 3. Inspect Diagnostics │─┐
│ Types & Hooks   │       │ `npx tsc --noEmit`   │       │ & Self-Correct In-Loop │ │
└─────────────────┘       └──────────────────────┘       └────────────────────────┘ │
         ▲                                                                          │
         └────────────────────────── 🔁 REPEAT UNTIL 0 ERRORS ──────────────────────┘
```

1. **Verify Barrel Exports & Imports:**
   - Confirm `src/types/index.ts` and `src/hooks/index.ts` re-export new files.
   - Confirm `api/*.api.ts` imports from `'types'`, not relative paths.
2. **Execute In-Loop Compiler Gate:**
   - Run `npx tsc --noEmit`.
   - If errors occur: parse compiler diagnostics, fix type/generic mismatches in-loop, and re-run.
3. **Emit Verified API Handoff:**
   - Emit the **API Handoff** only after the loop reports **0 type errors**. Do not update `/docs`.
