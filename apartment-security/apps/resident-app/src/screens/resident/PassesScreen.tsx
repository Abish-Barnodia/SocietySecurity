import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useData, Pass } from '../../context/DataContext';

const TABS = ['All', 'Active', 'Suspended', 'Past'] as const;
type TabType = typeof TABS[number];

// Helper to determine monochrome Iconify/QuickAction style icon based on pass
function getPassIconName(pass: Pass): keyof typeof Ionicons.glyphMap {
  const text = `${pass.type} ${pass.purpose} ${pass.name}`.toLowerCase();
  if (text.includes('cab') || text.includes('uber') || text.includes('ola') || text.includes('auto') || text.includes('car')) return 'car-outline';
  if (text.includes('deliver') || text.includes('food') || text.includes('swiggy') || text.includes('zomato') || text.includes('courier')) return 'bicycle-outline';
  if (text.includes('maid') || text.includes('cook') || text.includes('clean') || text.includes('worker') || text.includes('help')) return 'hammer-outline';
  if (text.includes('parcel') || text.includes('package') || text.includes('amazon') || text.includes('flipkart')) return 'cube-outline';
  if (text.includes('service') || text.includes('repair') || text.includes('plumber') || text.includes('electric')) return 'construct-outline';
  if (text.includes('party') || text.includes('event') || text.includes('gathering')) return 'ribbon-outline';
  return 'person-outline';
}

export default function PassesScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { passes, suspendPass, revokePass } = useData();
  const [activeTab, setActiveTab] = useState<TabType>('All');

  const handleSuspend = (id: string, passName: string) => {
    Alert.alert('Suspend Pass', `Are you sure you want to pause pass for "${passName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Suspend',
        style: 'destructive',
        onPress: () => suspendPass(id).catch(() => Alert.alert('Error', 'Failed to suspend pass. Please try again.')),
      },
    ]);
  };

  const handleRevoke = (id: string, passName: string) => {
    Alert.alert('Delete Pass', `Are you sure you want to cancel / delete pass for "${passName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Delete',
        style: 'destructive',
        onPress: () => revokePass(id).catch(() => Alert.alert('Error', 'Failed to revoke pass. Please try again.')),
      },
    ]);
  };

  const filteredPasses = useMemo(() => {
    return passes.filter((pass) => {
      if (activeTab === 'All') return true;
      if (activeTab === 'Active') return pass.status === 'Active';
      if (activeTab === 'Suspended') return pass.status === 'Suspended';
      if (activeTab === 'Past') return pass.status === 'Expired';
      return true;
    });
  }, [passes, activeTab]);

  const activeCount = useMemo(() => passes.filter((p) => p.status === 'Active').length, [passes]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER (Matching Entries & Home Design) */}
      <View style={styles.header}>
        <Text style={styles.title}>My Passes</Text>
        <Text style={styles.subTitle}>{activeCount} active • {passes.length} total pass records</Text>
      </View>

      {/* FILTER TABS */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, isSelected && styles.tabBtnTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* PASSES LIST */}
      <FlatList
        data={filteredPasses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="qr-code-outline" size={38} color={colors.text} />
            </View>
            <Text style={styles.emptyTitle}>No Passes Found</Text>
            <Text style={styles.emptySub}>
              {activeTab === 'All'
                ? 'Create a pre-approved guest, cab, or delivery pass to get started.'
                : `No ${activeTab.toLowerCase()} passes available right now.`}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = item.status === 'Active';
          const isSuspended = item.status === 'Suspended';
          const iconName = getPassIconName(item);

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('PassDetail', { passId: item.id })}
              activeOpacity={0.8}
            >
              {/* TOP ROW: QuickActions Style Black & White Icon Box + Details + Status */}
              <View style={styles.cardTopRow}>
                {/* Monochrome Quick Actions Icon Box */}
                <View style={styles.quickActionIconBox}>
                  <Ionicons name={iconName} size={22} color={colors.text} />
                </View>

                {/* Details */}
                <View style={styles.cardInfoCol}>
                  <View style={styles.nameBadgeRow}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {item.name || item.type}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        isActive && styles.statusPillActive,
                        isSuspended && styles.statusPillSuspended,
                        !isActive && !isSuspended && styles.statusPillExpired,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isActive && styles.statusTextActive,
                          isSuspended && styles.statusTextSuspended,
                          !isActive && !isSuspended && styles.statusTextExpired,
                        ]}
                      >
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardPurpose} numberOfLines={1}>
                    {item.type} {item.purpose ? `• ${item.purpose}` : ''}
                  </Text>
                </View>
              </View>

              {/* DETAILS ROW (Entries style with monochrome icons) */}
              <View style={styles.detailsList}>
                <View style={styles.detailLine}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.detailLineText} numberOfLines={1}>
                    {item.time || '12:00 AM - 11:59 PM'}
                  </Text>
                </View>

                <View style={styles.detailLine}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.detailLineText} numberOfLines={1}>
                    {item.created ? `Created ${item.created}` : 'Valid Pass'}
                  </Text>
                </View>

                <View style={styles.detailLine}>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.detailLineText} numberOfLines={1}>
                    {item.gate || 'All society gates pre-approved'}
                  </Text>
                </View>
              </View>

              {/* ACTION BUTTONS ROW (Entries & Home style) */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.cardActionBtn}
                  onPress={() => navigation.navigate('PassDetail', { passId: item.id })}
                >
                  <Ionicons name="eye-outline" size={15} color={colors.text} />
                  <Text style={styles.cardActionBtnText}>View Pass</Text>
                </TouchableOpacity>

                {isActive && (
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => handleSuspend(item.id, item.name || item.type)}
                  >
                    <Ionicons name="pause-circle-outline" size={15} color={colors.textMuted} />
                    <Text style={styles.cardActionBtnText}>Pause</Text>
                  </TouchableOpacity>
                )}

                {(isActive || isSuspended) && (
                  <TouchableOpacity
                    style={[styles.cardActionBtn, styles.cardActionDeleteBtn]}
                    onPress={() => handleRevoke(item.id, item.name || item.type)}
                  >
                    <Ionicons name="trash-outline" size={14} color="#dc2626" />
                    <Text style={[styles.cardActionBtnText, { color: '#dc2626', fontWeight: '700' }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* FLOATING ACTION BUTTON */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => navigation.navigate('CreatePass')}
        activeOpacity={0.85}
      >
        <Ionicons name="person-add" size={24} color={isDark ? '#0f172a' : '#ffffff'} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f172a' : '#f5f3ef',
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
    },
    subTitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },

    // TABS BAR
    tabsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    tabBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabBtnActive: {
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      borderColor: isDark ? '#ffffff' : '#0f172a',
    },
    tabBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
    },
    tabBtnTextActive: {
      color: isDark ? '#0f172a' : '#ffffff',
      fontWeight: '800',
    },

    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 90,
    },

    // CARD DESIGN (Matching Entries & Quick Actions Box)
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    // Monochrome Quick Actions Style Icon Box
    quickActionIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    cardInfoCol: {
      flex: 1,
    },
    nameBadgeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    cardPurpose: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: '500',
    },

    // STATUS PILLS
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    statusPillActive: {
      backgroundColor: '#f0fdf4',
      borderColor: '#bbf7d0',
    },
    statusPillSuspended: {
      backgroundColor: '#fefce8',
      borderColor: '#fef08a',
    },
    statusPillExpired: {
      backgroundColor: '#f1f5f9',
      borderColor: '#e2e8f0',
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '800',
    },
    statusTextActive: {
      color: '#16a34a',
    },
    statusTextSuspended: {
      color: '#ca8a04',
    },
    statusTextExpired: {
      color: '#64748b',
    },

    // DETAILS LIST
    detailsList: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#f1f5f9',
      gap: 6,
    },
    detailLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailLineText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
      flex: 1,
    },

    // ACTION BUTTONS
    cardActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#f1f5f9',
    },
    cardActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 8,
      gap: 6,
    },
    cardActionDeleteBtn: {
      backgroundColor: isDark ? '#450a0a' : '#fef2f2',
      borderColor: isDark ? '#7f1d1d' : '#fecaca',
    },
    cardActionBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },

    // EMPTY STATE
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 24,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    emptySub: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 18,
    },

    // FAB
    fabButton: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
    },
  });
