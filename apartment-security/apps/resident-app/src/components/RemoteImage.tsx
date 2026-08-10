import React, { useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// RN's <Image> shows nothing at all on a bad/unreachable URL, which reads as
// a broken layout rather than "no photo available" — wrap it with a loading
// spinner and a placeholder icon so a missing/failed visitor photo never
// leaves an empty gap.
export default function RemoteImage({
  uri,
  style,
  resizeMode = 'cover',
  colors,
  fallbackIcon = 'person-outline',
}: {
  uri?: string | null;
  style: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain';
  colors: any;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!uri || failed) {
    return (
      <View style={[style, styles.center, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={fallbackIcon} size={32} color={colors.textMuted} />
      </View>
    );
  }

  return (
    <View style={[style, styles.clip]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onError={() => setFailed(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.primaryLight }]}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  clip: { overflow: 'hidden' },
});
