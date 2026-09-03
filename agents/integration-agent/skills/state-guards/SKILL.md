---
name: state-guards
description: Protocol for bulletproof Loading, Error, Empty, and Pagination state guards in React Native screens.
---

# State Guards Skill

This skill defines the state machine rules and guards required across all integrated screens.

---

## 1. The Three-State Machine

Integrated screens must never crash when data is loading, failing, or empty.

```tsx
// Pattern: Presentational Screen with Guard States
export const ProgramDetailsScreen = () => {
  const { isLoading, isError, data, listData, refetch, infiniteListProps, legendListRefreshProps } = useProgramDetailsScreen();

  // 1. Initial Loading State
  if (isLoading && !data) {
    return <Loader testID="program-details-loader" />;
  }

  // 2. Full-Screen Error State
  if (isError && !data) {
    return <ScreenErrorState onRetry={refetch} testID="program-details-error" />;
  }

  // 3. Normal / Empty List View
  return (
    <ScreenContainer testID="program-details-screen">
      <LegendList
        data={listData}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={<NoData message={STRINGS.EMPTY.DEFAULT} />}
        {...infiniteListProps}
        {...legendListRefreshProps}
      />
    </ScreenContainer>
  );
};
```

---

## 2. Guard Rules

1. **Initial vs Background Fetching**:
   - Only show full-screen `<Loader />` when `data` is `undefined`.
   - During pull-to-refresh or background refetching, the existing data stays visible while indicators update.
2. **Retry Mechanism**:
   - `<ScreenErrorState />` must receive the query's `refetch` function.
3. **Empty String Fallback**:
   - Never render raw English strings in `<NoData />`. Always reference `STRINGS.*`.
