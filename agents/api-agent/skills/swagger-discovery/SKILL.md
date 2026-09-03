---
name: swagger-discovery
description: Automatically discovers, parses, and normalizes OpenAPI 3.0 / Swagger 2.0 specifications from live environments or JSON files.
---

# Swagger & OpenAPI Discovery Skill

This skill defines how the API Agent discovers backend contracts, normalizes endpoint paths, parses request/response schemas, and detects pagination models.

---

## 1. Environment URL Discovery

When the user provides an operation id or endpoint path, determine the OpenAPI documentation host using `APP_ENV`:

| `APP_ENV` | Base URL | OpenAPI Specification Endpoint |
|---|---|---|
| `development` | `https://dev.futureonesports.com` | `https://dev.futureonesports.com/api/docs-json` |
| `staging` | `https://stage.futureonesports.com` | `https://stage.futureonesports.com/api/docs-json` |
| `uat` (default) | `https://uat.futureonesports.com` | `https://uat.futureonesports.com/api/docs-json` |
| `production` | `https://app.futureonesports.com` | `https://app.futureonesports.com/api/docs-json` |

---

## 2. Operation Parsing Protocol

1. **Locate Target Operation**:
   - By `operationId` (e.g. `MobileProgramController_getProgramRosterTeams`)
   - Or by Path + HTTP Method (e.g. `GET /mobile/programs/{programId}/teams`)

2. **Parameter Extraction**:
   - **Path parameters**: `{programId}` → `params: { programId: string | number }`
   - **Query parameters**: `?limit=20&page=1` → `params: { limit?: number; page?: number }`
   - **Header parameters**: Authorization tokens are handled by `apiClient` unless special custom headers are specified.

3. **Request Body Extraction (POST/PUT/PATCH)**:
   - Inspect `requestBody.content['application/json'].schema`.
   - Resolve `$ref` to `components.schemas.*`.
   - Identify required fields vs optional fields (`required: [...]`).

4. **Response Schema Extraction (200 / 201)**:
   - Inspect `responses['200']` or `responses['201']`.
   - Extract root data structure.
   - Detect unwrapped arrays vs envelope objects (`{ data: [...], total: 100 }`).

5. **Pagination Pattern Detection**:
   - **Page-based**: Contains `page` and `limit`/`pageSize` query parameters. Response contains `page`, `totalPages`, or `hasNextPage`.
   - **Offset/Skip-based**: Contains `skip`/`offset` and `limit`. Response contains `total`, `skip`, `limit`.
   - **Cursor-based**: Contains `cursor`/`after`. Response contains `nextCursor`/`pageInfo`.

6. **Authentication Detection**:
   - If `security` block is absent or empty `[{}]` → `skipAuth: true`.
   - If `BearerAuth` / `jwt` is present → `skipAuth: false`.
