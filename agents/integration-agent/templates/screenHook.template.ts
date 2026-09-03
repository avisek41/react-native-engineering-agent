// external
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback } from 'react';

// internal
import {
  {{hookName}},
  {{keysName}},
  useInfiniteListProps,
  usePullToRefresh,
  useSearch,
} from 'hooks';
import { MainNavigationProps, MainRouteProps } from '@types';
import { map{{PascalName}}ApiRowToViewModel } from 'utils/{{camelName}}Display';

export const use{{PascalName}}Screen = () => {
  const navigation = useNavigation<MainNavigationProps<'{{PascalName}}'>>();
  const route = useRoute<MainRouteProps<'{{PascalName}}'>>();
  const { searchInput, setSearchInput, debouncedSearch } = useSearch();

  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = {{hookName}}({
    id: route.params?.id,
    search: debouncedSearch,
  });

  const infiniteListProps = useInfiniteListProps({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    fetchNextPage,
  });

  const { legendListRefreshProps } = usePullToRefresh({
    queryKeys: [{{keysName}}.all],
  });

  const listData = (data?.items ?? []).map(map{{PascalName}}ApiRowToViewModel);

  return {
    data,
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
