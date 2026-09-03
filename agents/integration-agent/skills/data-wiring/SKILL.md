---
name: data-wiring
description: Protocol for connecting React Native UI screens to TanStack Query and Mutation hooks.
---

# Data Wiring Protocol

## Steps

1. **Inspect Handoffs**:
   - Read `UI Handoff` for target screen file, ViewModel shape, and required fields.
   - Read `API Handoff` for query/mutation hooks and contract shapes.

2. **Generate Screen Coordinator Hook**:
   - Path: `src/screens/{Stack}/{ScreenName}/use{ScreenName}Screen.ts`
   - Consume query hooks: `use{Query}Query()` or `use{Query}InfiniteQuery()`.
   - Implement data mappers: Map backend schema to screen ViewModel.

3. **Handle States**:
   - `isLoading`: Initial screen skeleton/loading state.
   - `isError`: Error banner or retry UI.
   - `isEmpty`: Fallback empty state when data collection is empty.
   - `isRefetching`: Pull-to-refresh spinner status.

4. **Expose Actions**:
   - Handlers for button clicks, form submissions, navigation transitions, and pagination.
