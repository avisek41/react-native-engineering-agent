# Validate API Layer Command

Audit all API files, types, and hooks for compliance with project architecture and static rules.

---

## Checks Performed

1. **TypeScript Compiler Check**: Run `npx tsc --noEmit`.
2. **Barrel Exports Check**: Verify all files under `src/types/` and `src/hooks/` are re-exported from `index.ts`.
3. **Pure Types Rule**: Ensure no imports exist in `src/types/*.types.ts`.
4. **Endpoint Registry**: Confirm all API endpoints exist in `src/api/endPoints.ts`.
5. **Static Analysis**: Run `node api-agent/api-agent.js validate ./src`.
