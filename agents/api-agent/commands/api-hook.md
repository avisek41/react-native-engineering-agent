# API Hook Generator Command

Generate TypeScript types, API fetch functions, React Query hooks, index.ts exports, and endpoint constants from a Swagger or plain-English API spec.

---

## Input Specification

```
Endpoint : /products/search
Method   : GET | POST | PUT | PATCH | DELETE
Payload  : field:type field?:type  (POST | PUT | PATCH only)
Params   : field:type              (GET with query params)
Response : field:type field?:type
skipAuth : true | false  (default false)
paging   : page/limit | skip/limit | none
```

---

## File Architecture

Generate all relevant files without merging:

```
src/
├── api/
│   ├── endPoints.ts                          ← Add constant here if missing
│   └── {camelName}.api.ts                    ← Fetcher function & type re-exports
├── types/
│   ├── {camelName}.types.ts                  ← Zero-import pure TypeScript types
│   └── index.ts                              ← Re-export types
└── hooks/
    ├── queries/
    │   ├── use{PascalName}InfiniteQuery.ts   ← Paginated list query
    │   └── use{PascalName}Query.ts           ← Single item query
    ├── mutation/
    │   └── use{PascalName}Mutation.ts        ← POST / PUT / PATCH / DELETE mutation
    └── index.ts                              ← Re-export hooks & query keys
```

---

## In-Loop Verification

1. Check existing exports and endpoints to avoid duplicates.
2. Generate all required files conforming to templates.
3. Run `npx tsc --noEmit` and ensure 0 compile errors.
4. Output the standard **API Handoff** block.
