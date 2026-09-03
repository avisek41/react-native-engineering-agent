import React from 'react';
import { VStack, HStack, Box, Text, Button, ButtonText } from '@gluestack-ui/themed';
import { LegendList } from '@legendapp/list';
import { COLORS } from '../../theme/color';
import { STRINGS } from '../../constant/strings';

export interface CompliantViewModel {
  title: string;
  items: Array<{ id: string; name: string }>;
}

export const CompliantScreen: React.FC<{ viewModel: CompliantViewModel }> = ({ viewModel }) => {
  return (
    <VStack flex={1} bg={COLORS.backgroundPrimary} testID="compliant-screen-container">
      <HStack p={16} justifyContent="space-between" testID="compliant-header">
        <Text color={COLORS.textPrimary}>{STRINGS.PROFILE.HEADER_TITLE}</Text>
      </HStack>
      <LegendList
        data={viewModel.items}
        renderItem={({ item }) => (
          <Box key={item.id} p={12} bg={COLORS.surfaceCard} testID={`item-${item.id}`}>
            <Text color={COLORS.textSecondary}>{item.name}</Text>
          </Box>
        )}
        testID="compliant-list"
      />
      <Button testID="compliant-submit-button">
        <ButtonText>{STRINGS.COMMON.SUBMIT}</ButtonText>
      </Button>
    </VStack>
  );
};
