import React, { useCallback } from 'react';
import { LegendList } from '@legendapp/list';
import { AppHeader, ItemSeparator, Loader, NoData, ScreenContainer, ScreenErrorState } from 'components';
import { Layout, STRINGS } from 'constant';
import { use{{PascalName}}Screen } from './use{{PascalName}}Screen';
import type { {{PascalName}}ViewModel } from './types';

export const {{PascalName}}Screen = () => {
  const {
    data,
    infiniteListProps,
    isError,
    isLoading,
    legendListRefreshProps,
    listData,
    refetch,
  } = use{{PascalName}}Screen();

  const renderItem = useCallback(({ item }: { item: {{PascalName}}ViewModel }) => {
    // TODO: Return item component
    return null;
  }, []);

  if (isLoading && !data) {
    return <Loader testID="{{kebabName}}-loader" />;
  }

  if (isError && !data) {
    return (
      <ScreenErrorState
        onRetry={refetch}
        testID="{{kebabName}}-error"
      />
    );
  }

  return (
    <ScreenContainer testID="{{kebabName}}-screen">
      <AppHeader title={STRINGS.{{SCREAMING_NAME}}.TITLE} />
      <LegendList
        data={listData}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        estimatedItemSize={80}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={
          <NoData
            containerTestID="{{kebabName}}-empty"
            message={STRINGS.{{SCREAMING_NAME}}.EMPTY_MESSAGE}
          />
        }
        showsVerticalScrollIndicator={false}
        testID="{{kebabName}}-list"
        {...infiniteListProps}
        {...legendListRefreshProps}
      />
    </ScreenContainer>
  );
};
