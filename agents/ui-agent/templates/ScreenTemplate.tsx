// external
import { Box, VStack } from '@gluestack-ui/themed';
import { useNavigation } from '@react-navigation/native';
import React, { FC } from 'react';

// internal
import { AppHeader, ScreenContainer } from 'components';
import { Spacing, STRINGS } from 'constant';
import { {{PascalName}}Props } from './types';

const {{PascalName}}: FC<{{PascalName}}Props> = ({
  testID = '{{kebabName}}-screen',
}) => {
  const navigation = useNavigation();

  return (
    <ScreenContainer testID={testID}>
      <AppHeader
        hasLeftIcon
        title={STRINGS.{{SCREAMING_NAME}}.TITLE}
        onPressLeft={() => navigation.goBack()}
      />
      <VStack flex={1} space="md" p={Spacing.lg}>
        {/* Presentational content goes here */}
        <Box flex={1}>
          {/* Main content slot */}
        </Box>
      </VStack>
    </ScreenContainer>
  );
};

export default {{PascalName}};
