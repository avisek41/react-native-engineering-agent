# Wire Screen Command

Connect an existing API hook to an existing presentational UI screen with full state handling (loading, error, empty, pagination, PTR).

---

## Instructions

1. **Verify Prerequisites**: Confirm both API Handoff and UI Handoff are provided or exist in the codebase.
2. **Data Mapping**: Create or update `src/utils/{camelName}Display.ts` to map API rows to the screen's ViewModels.
3. **Screen Controller**: Wire hook into the screen or `use{PascalName}Screen.ts`.
4. **State Guards**:
   - Render `<Loader />` when `isLoading && !data`.
   - Render `<ScreenErrorState onRetry={refetch} />` when `isError && !data`.
   - Set `<NoData />` on `ListEmptyComponent`.
5. **Pagination & PTR**: Spread `infiniteListProps` and `legendListRefreshProps` onto `LegendList`.
6. **Verification**: Run `npx tsc --noEmit` and emit the **Integration Handoff**.
