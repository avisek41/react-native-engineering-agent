# Create Display Mapper Command

Scaffold a pure API-to-ViewModel display mapper in `src/utils/{camelName}Display.ts`.

---

## Instructions

1. Identify input API row type and output ViewModel interface.
2. Generate pure transformation function with null-safe fallbacks.
3. Generate companion unit test in `src/utils/__tests__/{camelName}Display.test.ts`.
4. Run `npx tsc --noEmit` and `npm test -- {camelName}Display.test.ts`.
