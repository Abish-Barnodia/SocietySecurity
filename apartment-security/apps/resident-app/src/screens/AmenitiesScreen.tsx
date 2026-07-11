import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

export default function AmenitiesScreen({ navigation }: { navigation: any }) {
  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);

  return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Ionicons name="construct-outline" size={80} color={colors.primary} />
      <Text style={{ color: colors.text, fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, marginTop: spacing.lg }}>Coming Soon!</Text>
      <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
        The Amenities booking feature is currently under development. Once the Manager Portal is complete, society admins will be able to manage this section.
      </Text>
    </View>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
});
