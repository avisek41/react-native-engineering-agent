---
name: contract-validator
description: Validates generated API types, endpoints, and hooks against the OpenAPI/Swagger source of truth.
---

# Contract Validator Skill

This skill guides the validation of TypeScript API contracts against OpenAPI specifications to ensure zero runtime drift.

---

## 1. Validation Invariants

Every API module must satisfy these conditions:

1. **Zero Invented Fields**: All properties in `src/types/{camelName}.types.ts` must map 1:1 with the Swagger schema.
2. **Nullable & Optional Correctness**:
   - Fields marked optional in Swagger must have `?` in TypeScript.
   - Fields marked nullable (`nullable: true` or `type: ["string", "null"]`) must have `| null`.
3. **Endpoint Accuracy**:
   - Path in `src/api/endPoints.ts` must match Swagger path without leading slashes.
   - Parameter placeholders (`:paramId` or `{paramId}`) must be correctly interpolated.
4. **Query Key Uniqueness**:
   - Query key namespace in `all: ['{name}']` must be unique across the application to prevent cache collisions.
5. **No Any/Unknown Without TODO**:
   - No `any` types.
   - If response schema is dynamic, use `Record<string, unknown>` or indexed type with a comment.

---

## 2. In-Loop Self-Correction Protocol

When validation finds an error:
1. Identify the exact mismatch (e.g. `title` marked required in types but optional in Swagger).
2. Update the type definition in `src/types/{camelName}.types.ts`.
3. Run `npx tsc --noEmit` to verify downstream consumers.
4. Repeat until 0 compiler and validation errors remain.
