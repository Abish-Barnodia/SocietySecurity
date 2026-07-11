import { usePasses } from '../context/DomainContexts';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';
import { Alert } from 'react-native';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

const tabs = ['All', 'Active', 'Scheduled', 'Past'];

export default function PassesScreen({ navigation, route }: { navigation: any, route: any }) {
  const { passes, fetchPasses, deletePass } = usePasses();
  const [activeTab, setActiveTab] = useState('All');
  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const filteredPasses = passes.filter(pass => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Active') return pass.status === 'Active';
    if (activeTab === 'Past') return pass.status === 'Expired' || pass.status === 'Suspended';
    if (activeTab === 'Scheduled') return (pass.status as any) === 'Scheduled';
    return true;
  });

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Pass",
      "Are you sure you want to delete this pass? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              if (deletePass) {
                await deletePass(id);
              } else {
                await api.delete(`/passes/${id}`);
                fetchPasses();
              }
            } catch (e: any) {
              alert(e?.response?.data?.message || 'Failed to delete pass');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My passes</Text>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredPasses}
        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted }}>No passes found.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('PassDetail', { passId: item.id })}>
            <View style={styles.cardHeader}>
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person-outline" size={20} color={colors.text} />
              </View>
              <View style={styles.cardTitleContainer}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>{item.purpose || item.type}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: isDarkMode ? '#262626' : '#e6dfd1' }]}>
                {item.status === 'Active' && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
                {item.status === 'Suspended' && <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />}
                <Text style={[styles.badgeText, { color: isDarkMode ? colors.text : colors.text }]}>
                  {item.status}
                </Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} style={styles.infoIcon} />
                <Text style={styles.infoText}>{item.time.split(',')[0]}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} style={styles.infoIcon} />
                <Text style={styles.infoText}>{item.time.split(' ')[1] || '18:00 - 21:00'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} style={styles.infoIcon} />
                <Text style={styles.infoText}>{item.gate || 'Main Gate'}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              {item.status === 'Active' ? (
                <>
                  <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>Suspend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]}>
                    <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Revoke</Text>
                  </TouchableOpacity>
                </>
              ) : (item.status as any) === 'Scheduled' ? (
                <>
                  <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]}>
                    <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                  <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]}>
                    <Text style={styles.actionBtnText}>View History</Text>
                  </TouchableOpacity>
                  {(item.status === 'Suspended' || item.status === 'Expired') && (
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.actionBtnDanger, { flex: 1 }]}
                      onPress={() => handleDelete(item.id)}
                    >
                      <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePass')}
      >
        <Ionicons name="add" size={32} color={isDarkMode ? colors.text : colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: roundness.full,
    backgroundColor: isDarkMode ? colors.surface : colors.background,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
    marginRight: spacing.sm,
  },
  activeTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: typography.weights.semibold,
  },
  activeTabText: {
    color: isDarkMode ? colors.white : colors.text, // Usually black text on mustard in light mode
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: isDarkMode ? colors.surface : '#f6f5f2',
    borderRadius: roundness.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : '#eae7e1',
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: isDarkMode ? '#262626' : '#e6dfd1',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: spacing.md,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: typography.sizes.sm,
    color: '#6c757d',
  },
  badge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: roundness.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  infoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.lg,
  },
  infoItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginRight: spacing.lg,
  },
  infoIcon: {
    marginRight: 4,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: '#6c757d',
  },
  actionRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: isDarkMode ? '#262626' : '#e6dfd1',
    paddingVertical: 10,
    borderRadius: roundness.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  actionBtnDanger: {
    backgroundColor: isDarkMode ? '#4a1111' : '#f5d3d3',
  },
  actionBtnTextDanger: {
    color: '#c92a2a',
  },
  fab: {
    position: 'absolute' as const,
    bottom: spacing.xl,
    right: spacing.xl,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
