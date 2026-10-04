import React, { useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { API_URL } from '../utils/api';

export function resolveImageUrl(uri?: string | null): string | null {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image/')) return trimmed;

  const serverBase = API_URL.replace(/\/api\/v1\/?$/, '');

  if (trimmed.startsWith('/uploads/')) {
    return `${serverBase}${trimmed}`;
  }

  const match = trimmed.match(/^https?:\/\/[^/]+(\/uploads\/.*)$/);
  if (match && match[1]) {
    return `${serverBase}${match[1]}`;
  }

  return trimmed;
}

// RN's <Image> shows nothing at all on a bad/unreachable URL, which reads as
// a broken layout rather than "no photo available" — wrap it with a loading
// spinner and a placeholder icon so a missing/failed visitor photo never
// leaves an empty gap.
export default function RemoteImage({
  uri,
  style,
  resizeMode = 'cover',
  colors,
  fallbackIcon = 'image-outline',
}: {
  uri?: string | null;
  style: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain';
  colors: any;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const resolvedUri = resolveImageUrl(uri);

  if (!resolvedUri || failed) {
    return (
      <View style={[style, styles.center, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
        <Ionicons name={fallbackIcon} size={32} color={colors.textMuted} />
      </View>
    );
  }

  return (
    <View style={[style, styles.clip]}>
      <Image
        source={{ uri: resolvedUri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onError={() => setFailed(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.card }]}>
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
