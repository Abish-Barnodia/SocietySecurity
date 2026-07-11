import { useEntries } from '../context/DomainContexts';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

export default function EntriesScreen() {
  const { entries } = useEntries();
  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Today');

  const renderEntry = (item: any, index: number, array: any[]) => {
    const isLast = index === array.length - 1;
    const isEntered = item.status === 'ENTERED';
    
    return (
      <View key={item.id} style={styles.timelineRow}>
        <View style={styles.timelineIndicatorContainer}>
          <View style={[styles.timelineDot, isEntered ? styles.timelineDotEntered : styles.timelineDotExited]} />
          {!isLast && <View style={styles.timelineLine} />}
        </View>
        <View style={[styles.card, { marginBottom: isLast ? 0 : spacing.lg }]}>
          <View style={styles.cardContent}>
            <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#262626' : (isEntered ? '#e6dfd1' : '#eae7e1') }]}>
              {item.type === 'Delivery' ? (
                <Ionicons name="car-outline" size={24} color={isEntered ? colors.danger : colors.textMuted} />
              ) : item.type === 'Worker' ? (
                <Ionicons name="person-outline" size={24} color={isEntered ? colors.primary : colors.textMuted} />
              ) : (
                <Ionicons name="person-outline" size={24} color={isEntered ? colors.primary : colors.textMuted} />
              )}
            </View>
            <View style={styles.details}>
              <View style={styles.headerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={[styles.statusText, { color: isEntered ? colors.primary : colors.textMuted }]}>
                    {' '}{isEntered ? 'ENTERED' : 'EXITED'}
                  </Text>
                </View>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <Text style={styles.gateText}>via {item.gate || 'Main Gate'}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  let filteredEntries = entries;
  if (searchQuery.trim() !== '') {
    filteredEntries = filteredEntries.filter(e => 
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const entriesToday = filteredEntries.filter(e => e.date === 'TODAY');
  const entriesYesterday = filteredEntries.filter(e => e.date === 'YESTERDAY');
  const entriesOlder = filteredEntries.filter(e => e.date === 'OTHER');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput 
            style={[styles.searchPlaceholder, { color: colors.text, flex: 1 }]} 
            placeholder="Search visitor or worker..." 
            placeholderTextColor="#6c757d"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styles.tabsContainer}>
          {['Today', 'Week', 'Month'].map(tab => (
            <TouchableOpacity 
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No entry records</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or tab.</Text>
          </View>
        ) : (
          <>
            {(activeTab === 'Today' || activeTab === 'Week' || activeTab === 'Month') && entriesToday.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>TODAY</Text>
                {entriesToday.map((e, i, a) => renderEntry(e, i, a))}
              </View>
            )}

            {(activeTab === 'Week' || activeTab === 'Month') && entriesYesterday.length > 0 && (
              <View style={[styles.section, { marginTop: entriesToday.length > 0 ? spacing.xl : 0 }]}>
                <Text style={styles.sectionHeader}>YESTERDAY</Text>
                {entriesYesterday.map((e, i, a) => renderEntry(e, i, a))}
              </View>
            )}

            {activeTab === 'Month' && entriesOlder.length > 0 && (
              <View style={[styles.section, { marginTop: (entriesToday.length > 0 || entriesYesterday.length > 0) ? spacing.xl : 0 }]}>
                <Text style={styles.sectionHeader}>OLDER</Text>
                {entriesOlder.map((e, i, a) => renderEntry(e, i, a))}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: isDarkMode ? colors.surface : '#f6f5f2',
    padding: spacing.md,
    borderRadius: roundness.md,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : '#eae7e1',
    marginBottom: spacing.md,
  },
  searchPlaceholder: {
    marginLeft: spacing.sm,
    color: '#6c757d',
    fontSize: typography.sizes.md,
  },
  tabsContainer: {
    flexDirection: 'row' as const,
    marginBottom: spacing.sm,
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
    color: isDarkMode ? colors.white : colors.text,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center' as const,
    marginTop: 40,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#6c757d',
    marginBottom: spacing.lg,
    letterSpacing: 1,
  },
  timelineRow: {
    flexDirection: 'row' as const,
  },
  timelineIndicatorContainer: {
    width: 24,
    alignItems: 'center' as const,
    marginRight: spacing.sm,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 16,
    zIndex: 2,
  },
  timelineDotEntered: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: isDarkMode ? '#452a0a' : '#fef3c7',
  },
  timelineDotExited: {
    backgroundColor: '#6c757d',
    borderWidth: 2,
    borderColor: isDarkMode ? '#262626' : '#e5e7eb',
  },
  timelineLine: {
    position: 'absolute' as const,
    top: 28,
    bottom: -16,
    width: 1,
    backgroundColor: '#eae7e1',
    zIndex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: isDarkMode ? colors.surface : '#f6f5f2',
    borderRadius: roundness.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: isDarkMode ? 'transparent' : '#eae7e1',
  },
  cardContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: roundness.md,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: spacing.md,
  },
  details: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  time: {
    fontSize: typography.sizes.sm,
    color: '#6c757d',
  },
  gateText: {
    fontSize: typography.sizes.sm,
    color: '#6c757d',
  },
});
