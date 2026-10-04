import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function SkeletonBox({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const baseColor = isDark ? '#334155' : '#e2e8f0';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Full Guard Home Skeleton
export function GuardHomeSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={styles.skeletonContainer}>
      {/* Metrics Row Skeleton */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 }]}>
        <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <SkeletonBox width={32} height={32} borderRadius={16} />
          <SkeletonBox width={28} height={18} borderRadius={4} />
          <SkeletonBox width={48} height={10} borderRadius={3} />
        </View>
        <View style={{ width: 1, height: 40, backgroundColor: colors.border, alignSelf: 'center' }} />
        <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <SkeletonBox width={32} height={32} borderRadius={16} />
          <SkeletonBox width={28} height={18} borderRadius={4} />
          <SkeletonBox width={48} height={10} borderRadius={3} />
        </View>
        <View style={{ width: 1, height: 40, backgroundColor: colors.border, alignSelf: 'center' }} />
        <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <SkeletonBox width={32} height={32} borderRadius={16} />
          <SkeletonBox width={28} height={18} borderRadius={4} />
          <SkeletonBox width={48} height={10} borderRadius={3} />
        </View>
      </View>

      {/* Quick Actions Grid Skeleton */}
      <View style={{ marginBottom: 20 }}>
        <SkeletonBox width="40%" height={16} borderRadius={6} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <SkeletonBox width="48%" height={74} borderRadius={16} />
          <SkeletonBox width="48%" height={74} borderRadius={16} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SkeletonBox width="48%" height={74} borderRadius={16} />
          <SkeletonBox width="48%" height={74} borderRadius={16} />
        </View>
      </View>

      {/* Recent Activity Card Skeleton */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SkeletonBox width="45%" height={16} borderRadius={6} style={{ marginBottom: 14 }} />
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <SkeletonBox width={36} height={36} borderRadius={12} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBox width="60%" height={14} borderRadius={4} />
              <SkeletonBox width="40%" height={10} borderRadius={3} />
            </View>
            <SkeletonBox width={50} height={20} borderRadius={8} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <SkeletonBox width={36} height={36} borderRadius={12} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBox width="55%" height={14} borderRadius={4} />
              <SkeletonBox width="35%" height={10} borderRadius={3} />
            </View>
            <SkeletonBox width={50} height={20} borderRadius={8} />
          </View>
        </View>
      </View>
    </View>
  );
}

// Alerts List Skeleton
export function AlertsSkeletonList({ count = 3 }: { count?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.skeletonContainer}>
      {/* Card Skeletons */}
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 12 }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <SkeletonBox width={40} height={40} borderRadius={14} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <SkeletonBox width={60} height={14} borderRadius={4} />
                <SkeletonBox width={45} height={12} borderRadius={4} />
              </View>
              <SkeletonBox width="70%" height={15} borderRadius={4} />
            </View>
          </View>
          <SkeletonBox width="100%" height={12} borderRadius={4} style={{ marginBottom: 6 }} />
          <SkeletonBox width="85%" height={12} borderRadius={4} style={{ marginBottom: 14 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, alignItems: 'flex-end' }}>
            <SkeletonBox width={100} height={32} borderRadius={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

// General List Skeleton
export function ListSkeleton({ count = 4 }: { count?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }]}
        >
          <SkeletonBox width={44} height={44} borderRadius={14} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBox width="60%" height={15} borderRadius={4} />
            <SkeletonBox width="40%" height={11} borderRadius={4} />
          </View>
          <SkeletonBox width={60} height={24} borderRadius={8} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
});
