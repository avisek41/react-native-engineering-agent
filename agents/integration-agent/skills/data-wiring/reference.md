# Data Wiring Reference Patterns

## Screen Hook Structure

```typescript
import { useState, useCallback } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useItemDetailQuery, useItemsInfiniteQuery, useUpdateItemMutation } from 'hooks';
import { mapItemToViewModel } from 'utils/itemMapper';
import type { ScreenRouteProp, ScreenNavigationProp } from './types';

export function useDetailScreen() {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<ScreenNavigationProp>();
  const { id } = route.params;

  const detailQuery = useItemDetailQuery({ id });
  const updateMutation = useUpdateItemMutation();

  const viewModel = mapItemToViewModel(detailQuery.data);

  const handleUpdate = useCallback(async (payload: any) => {
    try {
      await updateMutation.mutateAsync({ id, ...payload });
      navigation.goBack();
    } catch (error) {
      // handle error
    }
  }, [id, navigation, updateMutation]);

  return {
    viewModel,
    isLoading: detailQuery.isLoading,
    isError: detailQuery.isError,
    isRefreshing: detailQuery.isRefetching,
    onRefresh: detailQuery.refetch,
    handleUpdate,
  };
}
```
