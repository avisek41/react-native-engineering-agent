# Discover Swagger & Contract Command

Discover OpenAPI / Swagger documentation for a given endpoint or feature, inspect request/response schemas, check existing repo reuse, and output an extraction summary.

---

## Instructions

1. **Resolve Environment**: Determine the target URL from `src/configs/baseURL.ts` and active `.env`.
2. **Fetch OpenAPI Spec**: Inspect `/api/docs-json` or provided Swagger URL.
3. **Locate Operation**: Extract method, path parameters, query parameters, body schema, response schema, and auth security.
4. **Scan Codebase for Reuse**:
   - Check `src/api/endPoints.ts`
   - Check `src/types/`
   - Check `src/api/`
   - Check `src/hooks/`
5. **Output Extraction Report**:
   - Normalized spec format
   - Reusable existing assets
   - New files needed
