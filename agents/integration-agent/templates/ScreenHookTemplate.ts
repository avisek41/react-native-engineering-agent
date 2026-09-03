import { useCallback } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

// TODO: Replace with real query and mapper imports
// import { use__Entity__Query } from 'hooks';
// import { map__Entity__ToViewModel } from 'utils/__entity__Mapper';

export interface __Entity__ScreenProps {
  id?: string;
}

export function use__Entity__Screen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<any, any>>();

  // Example Query hook:
  // const query = use__Entity__Query({ id: route.params?.id });
  // const viewModel = map__Entity__ToViewModel(query.data);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return {
    // viewModel,
    // isLoading: query.isLoading,
    // isError: query.isError,
    // isRefreshing: query.isRefetching,
    // onRefresh: query.refetch,
    handleGoBack,
  };
}
