---
name: mapper-generator
description: Best practices and patterns for mapping server DTOs to UI ViewModels.
---

# DTO-to-ViewModel Mapper Protocol

## Rules
1. **Zero Null/Undefined Crashes**: Provide safe default values for all optional backend fields (`dto?.title ?? ''`).
2. **Formatting in Mappers, Not JSX**: Convert timestamps to human-readable dates, currency to formatted strings, and ratios to percentages inside the mapper.
3. **Pure Functions**: Keep mappers deterministic with no side effects or global state access.
4. **Strict Typing**: Mappers must accept API DTO types from `src/types/` and return UI ViewModel types from `src/screens/.../types.ts`.
