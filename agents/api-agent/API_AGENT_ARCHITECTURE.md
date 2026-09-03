# API Agent Architecture & Operating Specification

## 1. System Mission

The **API Agent** is an autonomous specialist agent responsible for discovering, creating, updating, and verifying the network and data-fetching layer in FutureOne Sports (React Native).

It bridges Swagger/OpenAPI specs with the TanStack Query layer, ensuring strict type safety, predictable caching policies, error handling resilience, and zero code duplication.

---

## 2. Layering & File Structure

All artifacts managed by the API Agent strictly follow this architecture:

```
src/
├── api/
│   ├── apiClient.ts              # Core axios/fetch wrapper (apiRequest, ApiError)
│   ├── endPoints.ts              # Centralized URL constants (SCREAMING_SNAKE_CASE)
│   └── {camelName}.api.ts        # Pure fetcher functions (re-exports types)
│
├── types/
│   ├── {camelName}.types.ts      # Pure TypeScript type contracts (zero imports)
│   └── index.ts                  # Central type barrel re-exporting all types
│
└── hooks/
    ├── queries/
    │   ├── use{PascalName}Query.ts          # Single item / detail GET query
    │   └── use{PascalName}InfiniteQuery.ts  # Paginated list GET query with select
    ├── mutation/
    │   └── use{PascalName}Mutation.ts       # POST / PUT / PATCH / DELETE mutation
    └── index.ts                             # Central hook barrel re-exporting all hooks
```

> [!NOTE]
> The mutation directory is named `src/hooks/mutation/` (singular), matching project standards.

---

## 3. Swagger URL Auto-Resolution Matrix

When only an endpoint path or operation id is provided, the API Agent automatically discovers the OpenAPI spec based on the current environment (`APP_ENV`):

| Environment | Base URL | Swagger Docs URL | OpenAPI JSON Endpoint |
|---|---|---|---|
| `development` | `https://dev.futureonesports.com` | `https://dev.futureonesports.com/api/docs` | `https://dev.futureonesports.com/api/docs-json` |
| `staging` | `https://stage.futureonesports.com` | `https://stage.futureonesports.com/api/docs` | `https://stage.futureonesports.com/api/docs-json` |
| `uat` (default) | `https://uat.futureonesports.com` | `https://uat.futureonesports.com/api/docs` | `https://uat.futureonesports.com/api/docs-json` |
| `production` | `https://app.futureonesports.com` | `https://app.futureonesports.com/api/docs` | `https://app.futureonesports.com/api/docs-json` |

---

## 4. Operational Protocols

### Protocol A: Swagger Discovery & Extraction
1. **Fetch**: Read the OpenAPI JSON from `/api/docs-json`.
2. **Resolve**: Locate operation by ID or path + HTTP method.
3. **Normalize**:
   - Extract Path, Query, Header, Body parameters.
   - Extract 200/201 response schema.
   - Detect pagination model (`page`/`limit` vs `skip`/`limit` vs cursor).
   - Detect auth requirement (Bearer security scheme vs public endpoint).

### Protocol B: Reuse First Verification (DRY)
Before generating any file, check for existing equivalents:
1. `src/api/endPoints.ts` for existing constant.
2. `src/api/` for existing fetcher function.
3. `src/types/` for existing type definitions.
4. `src/hooks/` for existing queries or mutations.

If found, **reuse existing files** and return `status: reused` in the handoff.

### Protocol C: Closed-Loop Verification
Execute self-verification before completing tasks:
1. **Compilation Check**: `npx tsc --noEmit` must return 0 errors.
2. **Barrel Verification**: Verify that `types/index.ts` and `hooks/index.ts` contain exports for all new files.
3. **Runtime Invariants**:
   - Query keys must be unique function factories.
   - Infinite queries must provide a `select` returning `{ items, total }`.
   - All mutations must invalidate associated query keys upon success.

---

## 5. Security & Error Handling Policies

1. **Authentication**: Handled transparently by `apiClient`. Set `skipAuth: true` only for public endpoints (login, forgot-password, public metadata).
2. **Token Refresh**: Handled by `apiClient` interceptors (401 triggers automatic token refresh and replay).
3. **Retry Strategy**:
   - 4xx errors (client errors): No retry (`retry: (failureCount, err) => err.status >= 400 && err.status < 500 ? false : failureCount < 2`).
   - 5xx errors (server errors / network failures): Up to 2 retries with exponential backoff.
4. **Toast Feedback**: Use `meta: API_TOAST` from `utils/queryToastMeta` on mutations that produce user-visible side effects.
