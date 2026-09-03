// external
import { Box, HStack, Text } from '@gluestack-ui/themed';
import React, { FC } from 'react';

// internal
import { COLORS, FONT_FAMILY } from '@theme';
import { FontSize, Shape, Spacing } from 'constant';
import { {{PascalName}}Props } from './types';

export const {{PascalName}}: FC<{{PascalName}}Props> = ({
  title,
  testID = '{{kebabName}}',
  style,
}) => {
  return (
    <Box
      testID={testID}
      bg={COLORS.CARD_BG}
      p={Spacing.md}
      borderRadius={Shape.card}
      style={style}
    >
      <HStack space="sm" alignItems="center">
        <Text
          color={COLORS.WHITE}
          fontFamily={FONT_FAMILY.SORA.SEMI_BOLD}
          fontSize={FontSize.sm}
        >
          {title}
        </Text>
      </HStack>
    </Box>
  );
};

export default {{PascalName}};
