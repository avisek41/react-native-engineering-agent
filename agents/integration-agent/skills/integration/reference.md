# Integration Reference & Code Patterns

## 1. `use{PascalName}Screen.ts` Template (Only When Needed)

```ts
// external
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback } from 'react';

// internal
import {
  useProgramProgramTeamsInfiniteQuery,
  programProgramTeamsKeys,
  useInfiniteListProps,
  usePullToRefresh,
  useSearch,
} from 'hooks';
import { MainNavigationProps, MainRouteProps } from '@types';
import { mapProgramProgramTeamsApiRowToTeam } from 'utils/programProgramListDisplay';

export const useProgramDetailsScreen = () => {
  const navigation = useNavigation<MainNavigationProps<'ProgramDetails'>>();
  const route = useRoute<MainRouteProps<'ProgramDetails'>>();
  const { searchInput, setSearchInput, debouncedSearch } = useSearch();

  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProgramProgramTeamsInfiniteQuery({
    programId: route.params.programId,
    search: debouncedSearch,
  });

  const infiniteListProps = useInfiniteListProps({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    fetchNextPage,
  });

  const { legendListRefreshProps } = usePullToRefresh({
    queryKeys: [programProgramTeamsKeys.all],
  });

  const listData = (data?.items ?? []).map(mapProgramProgramTeamsApiRowToTeam);

  return {
    infiniteListProps,
    isError,
    isLoading,
    legendListRefreshProps,
    listData,
    navigation,
    refetch,
    searchInput,
    setSearchInput,
  };
};
```

---

## 2. Pull-to-Refresh Patterns

```ts
import { usePullToRefresh } from 'hooks';

const { legendListRefreshProps } = usePullToRefresh({
  queryKeys: [productsSearchKeys.all],
});
```

Multiple lists / queries:
```ts
usePullToRefresh({
  queryKeys: [productsSearchKeys.all, userProfileKeys.all],
});
```

**NEVER**:
- ❌ `refetch()` for pull-to-refresh
- ❌ `queryKeys: []` (silently skips invalidation)
- ❌ Manual `refreshControl` when using `legendListRefreshProps`

---

## 3. LegendList Integration Bind

```tsx
<LegendList
  ItemSeparatorComponent={ItemSeparator}
  ListEmptyComponent={
    <NoData containerTestID="roster-logs-empty" message={STRINGS.ROSTER_LOGS.EMPTY_LIST} />
  }
  contentContainerStyle={styles.listContent}
  data={listData}
  estimatedItemSize={CARD_ESTIMATED_SIZE}
  keyExtractor={item => item.id}
  renderItem={renderItem}
  showsVerticalScrollIndicator={false}
  testID="roster-logs-list"
  {...infiniteListProps}
  {...legendListRefreshProps}
/>
```

---

## 4. Pure Display Mapper (`src/utils/*Display.ts`)

```ts
// src/utils/programProgramListDisplay.ts
import type { ProgramProgramTeamsListTeamApiRow } from 'types';
import type { TeamViewModel } from 'screens/Main/ProgramDetails/types';

export const mapProgramProgramTeamsApiRowToTeam = (
  row: ProgramProgramTeamsListTeamApiRow,
): TeamViewModel => ({
  id: String(row.id),
  name: row.name ?? '',
  logoUrl: row.logoUrl ?? undefined,
  // Figma fields with no API counterpart stay undefined — never invent
});
```
