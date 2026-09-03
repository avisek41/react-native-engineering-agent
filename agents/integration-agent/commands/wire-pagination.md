# Wire Pagination

Bind TanStack Infinite Query hooks to list components (e.g. `LegendList` or `FlatList`).

## Steps
1. Consume `useInfiniteQuery` hook with `{ items, total }` structure.
2. Flatten pages: `query.data?.pages.flatMap(p => p.items) ?? []`.
3. Provide `onEndReached` handler that checks `hasNextPage && !isFetchingNextPage`.
4. Provide `onRefresh` handler triggering `refetch()`.
5. Return pagination props in screen hook.
