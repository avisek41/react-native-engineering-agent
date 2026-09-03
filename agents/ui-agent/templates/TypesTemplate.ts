import { StyleProp, ViewStyle } from 'react-native';

export interface {{PascalName}}ViewModel {
  id: string;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

export interface {{PascalName}}Props {
  testID?: string;
  style?: StyleProp<ViewStyle>;
  data?: {{PascalName}}ViewModel[];
  onItemPress?: (id: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}
