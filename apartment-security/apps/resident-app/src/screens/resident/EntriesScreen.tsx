import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useData, Entry, Pass } from '../../context/DataContext';

type CategoryFilter = 'ALL' | 'CAB' | 'DELIVERY' | 'GUEST' | 'DAILY_HELP' | 'PARCEL' | 'VEHICLE' | 'KID' | 'OTHERS';
type DateFilter = 'ALL' | 'TODAY' | 'YESTERDAY' | 'EARLIER';

const CATEGORY_ITEMS: { key: CategoryFilter; label: string; iconName: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'CAB', label: 'Cab', iconName: 'car-outline' },
  { key: 'DELIVERY', label: 'Delivery', iconName: 'bicycle-outline' },
  { key: 'GUEST', label: 'Guest', iconName: 'person-outline' },
  { key: 'DAILY_HELP', label: 'Dailyhelp', iconName: 'body-outline' },
  { key: 'PARCEL', label: 'Parcel', iconName: 'cube-outline' },
  { key: 'VEHICLE', label: 'Vehicle', iconName: 'car-sport-outline' },
  { key: 'KID', label: 'Kid', iconName: 'happy-outline' },
  { key: 'OTHERS', label: 'Others', iconName: 'list-outline' },
];

export default function EntriesScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const navigation = useNavigation<any>();
  const { entries, fetchEntries, entriesLastFetchedAt, passes, fetchPasses, notifyGuardsOverstay, revokePass } = useData();

  const [refreshing, setRefreshing] = useState(false);
  const [detailsEntry, setDetailsEntry] = useState<Entry | null>(null);
  const [rateEntry, setRateEntry] = useState<Entry | null>(null);
  const [overstayEntry, setOverstayEntry] = useState<Entry | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');

  // Overstay Notification Fields
  const [overstayDuration, setOverstayDuration] = useState('30 minutes');
  const [overstayReason, setOverstayReason] = useState('Visitor staying longer than expected');
  const [notifyingGuards, setNotifyingGuards] = useState(false);

  // Rate Visitor Fields
  const [ratingVal, setRatingVal] = useState(5);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - entriesLastFetchedAt.current > 15000) {
        fetchEntries();
        fetchPasses();
      }
    }, [fetchEntries, fetchPasses, entriesLastFetchedAt])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEntries(), fetchPasses()]);
    setRefreshing(false);
  };

  const dialPhone = (num?: string) => {
    if (!num) {
      Alert.alert('Phone Unavailable', 'No phone number is registered for this visitor.');
      return;
    }
    Linking.openURL(`tel:${num}`).catch(() => Alert.alert('Dialer Error', `Unable to call ${num}`));
  };

  // Active pass for top card — only show currently ACTIVE passes
  const activePass = useMemo<Pass | null>(() => {
    return passes.find((p) => p.status === 'Active') || null;
  }, [passes]);

  // Delete Pass with Confirmation
  const handleDeletePass = (passToDelete: Pass) => {
    Alert.alert(
      'Delete Pass',
      `Are you sure you want to delete the pass for "${passToDelete.name || passToDelete.type}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokePass(passToDelete.id);
              await fetchPasses();
              Alert.alert('Pass Deleted', 'The pass has been successfully deleted.');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to delete pass. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // Category filter
      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'CAB' && !e.category?.includes('CAB') && !e.name.toLowerCase().includes('cab') && !e.name.toLowerCase().includes('uber') && !e.name.toLowerCase().includes('ola')) return false;
        if (categoryFilter === 'DELIVERY' && !e.category?.includes('DELIVERY') && !e.purpose?.toLowerCase().includes('delivery') && !e.name.toLowerCase().includes('swiggy') && !e.name.toLowerCase().includes('zomato') && !e.name.toLowerCase().includes('blinkit')) return false;
        if (categoryFilter === 'DAILY_HELP' && e.method !== 'Domestic worker' && !e.category?.includes('DAILY')) return false;
        if (categoryFilter === 'VEHICLE' && !e.vehicleNumber) return false;
        if (categoryFilter === 'GUEST' && e.method === 'Domestic worker') return false;
      }

      // Date filter
      if (dateFilter !== 'ALL') {
        if (dateFilter === 'TODAY' && e.date !== 'TODAY') return false;
        if (dateFilter === 'YESTERDAY' && e.date !== 'YESTERDAY') return false;
        if (dateFilter === 'EARLIER' && e.date !== 'EARLIER') return false;
      }

      return true;
    });
  }, [entries, categoryFilter, dateFilter]);

  const entriesToday = useMemo(() => filteredEntries.filter((e) => e.date === 'TODAY'), [filteredEntries]);
  const entriesYesterday = useMemo(() => filteredEntries.filter((e) => e.date === 'YESTERDAY'), [filteredEntries]);
  const entriesEarlier = useMemo(() => filteredEntries.filter((e) => e.date === 'EARLIER'), [filteredEntries]);

  // Trigger Overstay alert to all guards
  const handleSendOverstayAlert = async () => {
    if (!overstayEntry) return;
    setNotifyingGuards(true);
    try {
      await notifyGuardsOverstay({
        entryId: overstayEntry.id,
        visitorName: overstayEntry.name,
        expectedDuration: overstayDuration,
        reason: overstayReason,
      });

      const visitorName = overstayEntry.name;
      setOverstayEntry(null);
      Alert.alert(
        '🚨 Guards Notified',
        `Security guards have received an urgent alert that "${visitorName}" is staying longer (${overstayDuration}).`
      );
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to notify guards. Please try again.');
    } finally {
      setNotifyingGuards(false);
    }
  };

  const getDurationText = (entryAt: string, exitAt?: string | null) => {
    const start = new Date(entryAt).getTime();
    if (isNaN(start)) return null;
    const end = exitAt ? new Date(exitAt).getTime() : Date.now();
    const mins = Math.max(1, Math.round((end - start) / 60000));
    if (mins < 60) return `${mins}m`;
    return `${(mins / 60).toFixed(1)}h`;
  };

  const renderEntryCard = (item: Entry) => {
    const isInside = item.status === 'Entered';
    const durationStr = getDurationText(item.entryAt, item.exitAt);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.entryCard}
        onPress={() => setDetailsEntry(item)}
        activeOpacity={0.8}
      >
        <View style={styles.entryTopRow}>
          {/* Avatar / Photo */}
          <View style={[styles.avatar, { backgroundColor: item.color }]}>
            <Text style={styles.avatarText}>{item.initials}</Text>
          </View>

          {/* Details */}
          <View style={styles.entryMainContent}>
            <View style={styles.nameStarRow}>
              <Text style={styles.visitorName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.starRatingBadge}>
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text style={styles.starRatingText}> {item.rating || '4.5'}</Text>
              </View>
            </View>

            <View style={styles.statusTimeRow}>
              <View
                style={[
                  styles.statusBadge,
                  isInside ? styles.statusBadgeInside : styles.statusBadgeLeft,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isInside ? styles.statusTextInside : styles.statusTextLeft,
                  ]}
                >
                  {isInside ? 'INSIDE' : 'LEFT'}
                </Text>
              </View>

              {durationStr && (
                <View style={[styles.durationChip, isInside && styles.durationChipActive]}>
                  <Ionicons name="time-outline" size={11} color={isInside ? '#16a34a' : colors.textMuted} />
                  <Text style={[styles.durationChipText, isInside && styles.durationChipTextActive]}>
                    {isInside ? ` ${durationStr} in building` : ` ${durationStr} stay`}
                  </Text>
                </View>
              )}

              <Text style={styles.timeCategorySub} numberOfLines={1}>
                {' '}
                • {item.time}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons Row on Card */}
        <View style={styles.cardActionsRow}>
          {item.phone && (
            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={() => dialPhone(item.phone)}
            >
              <Ionicons name="call" size={15} color="#16a34a" />
              <Text style={[styles.cardActionBtnText, { color: '#16a34a' }]}>Call</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => {
              setRateEntry(item);
            }}
          >
            <Ionicons name="star-outline" size={15} color={colors.primary} />
            <Text style={styles.cardActionBtnText}>Rate Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => navigation.navigate('CreatePass')}
          >
            <Ionicons name="ticket-outline" size={15} color={colors.primary} />
            <Text style={styles.cardActionBtnText}>Gatepass</Text>
          </TouchableOpacity>

          {isInside && (
            <TouchableOpacity
              style={[styles.cardActionBtn, styles.cardActionOverstayBtn]}
              onPress={() => {
                setOverstayEntry(item);
              }}
            >
              <Ionicons name="warning" size={14} color="#dc2626" />
              <Text style={[styles.cardActionBtnText, { color: '#dc2626', fontWeight: '800' }]}>Overstay</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Activities</Text>
        <Text style={styles.subTitle}>{filteredEntries.length} Visitor & Entry logs</Text>
      </View>

      {/* FILTER & DATE CONTROLS BAR */}
      <View style={styles.filtersBar}>
        <TouchableOpacity
          style={[styles.filterBarBtn, categoryFilter !== 'ALL' && styles.filterBarBtnActive]}
          onPress={() => setFilterModalOpen(true)}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={categoryFilter !== 'ALL' ? '#fff' : colors.text}
          />
          <Text style={[styles.filterBarBtnText, categoryFilter !== 'ALL' && { color: '#fff', fontWeight: '800' }]}>
            {categoryFilter === 'ALL' ? 'Filter' : categoryFilter} ▾
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBarBtn, dateFilter !== 'ALL' && styles.filterBarBtnActive]}
          onPress={() => setDateModalOpen(true)}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={dateFilter !== 'ALL' ? '#fff' : colors.text}
          />
          <Text style={[styles.filterBarBtnText, dateFilter !== 'ALL' && { color: '#fff', fontWeight: '800' }]}>
            {dateFilter === 'ALL' ? 'Date' : dateFilter} ▾
          </Text>
        </TouchableOpacity>

        {(categoryFilter !== 'ALL' || dateFilter !== 'ALL') && (
          <TouchableOpacity
            style={styles.clearFilterBtn}
            onPress={() => {
              setCategoryFilter('ALL');
              setDateFilter('ALL');
            }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP PASS CARD (Matching Screenshot 1) */}
        {activePass && (
          <View style={styles.topPassCard}>
            <View style={styles.topPassHeaderRow}>
              <View style={styles.passIconCircle}>
                <Ionicons name="car" size={20} color="#b45309" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.passTitleText}>{activePass.name || activePass.type} • Frequent</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View style={styles.passCreatedBadge}>
                    <Text style={styles.passCreatedText}>CREATED</Text>
                  </View>
                  <Text style={styles.passCreatedTime}>{activePass.created || 'Recent'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.passDetailsList}>
              <View style={styles.passDetailLine}>
                <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                <Text style={styles.passDetailLineText}>{activePass.time || '12:00 AM - 11:59 PM • Everyday'}</Text>
              </View>

              <View style={styles.passDetailLine}>
                <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                <Text style={styles.passDetailLineText}>Valid Pass for Unit</Text>
              </View>

              <View style={styles.passDetailLine}>
                <Ionicons name="arrow-forward-circle-outline" size={15} color={colors.textMuted} />
                <Text style={styles.passDetailLineText}>Single entry per day</Text>
              </View>

              <View style={styles.passDetailLine}>
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.textMuted} />
                <Text style={styles.passDetailLineText}>Pre-approved by you</Text>
              </View>
            </View>

            <View style={styles.passCardBottomActions}>
              <TouchableOpacity
                style={styles.passCardBtn}
                onPress={() => navigation.navigate('PassDetail', { passId: activePass.id })}
              >
                <Ionicons name="create-outline" size={16} color={colors.text} style={{ marginRight: 4 }} />
                <Text style={styles.passCardBtnText}>Edit</Text>
              </TouchableOpacity>
              <View style={styles.passBtnDivider} />
              <TouchableOpacity
                style={styles.passCardBtn}
                onPress={() => handleDeletePass(activePass)}
              >
                <Ionicons name="close-outline" size={18} color="#ef4444" style={{ marginRight: 4 }} />
                <Text style={[styles.passCardBtnText, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* LOGS LIST */}
        {filteredEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="document-text-outline" size={38} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Entry Records</Text>
            <Text style={styles.emptySub}>
              {categoryFilter !== 'ALL' || dateFilter !== 'ALL'
                ? 'No activities match your current filter.'
                : 'Entries, cab arrivals, and visitor exits will appear here.'}
            </Text>
          </View>
        ) : (
          <>
            {entriesToday.length > 0 && (
              <>
                <View style={styles.dateSeparatorPill}>
                  <Text style={styles.dateSeparatorText}>Today</Text>
                </View>
                {entriesToday.map(renderEntryCard)}
              </>
            )}

            {entriesYesterday.length > 0 && (
              <>
                <View style={[styles.dateSeparatorPill, { marginTop: entriesToday.length > 0 ? 14 : 4 }]}>
                  <Text style={styles.dateSeparatorText}>Yesterday</Text>
                </View>
                {entriesYesterday.map(renderEntryCard)}
              </>
            )}

            {entriesEarlier.length > 0 && (
              <>
                <View style={[styles.dateSeparatorPill, { marginTop: 14 }]}>
                  <Text style={styles.dateSeparatorText}>Earlier</Text>
                </View>
                {entriesEarlier.map(renderEntryCard)}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* FLOATING ACTION BUTTON TO CREATE PASS */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => navigation.navigate('CreatePass')}
        activeOpacity={0.85}
      >
        <Ionicons name="person-add" size={24} color="#0f172a" />
      </TouchableOpacity>

      {/* ================= MODAL 1: FILTER ACTIVITY BY TYPE (Screenshot 2) ================= */}
      <Modal
        visible={filterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.bottomSheetBackdrop}
          activeOpacity={1}
          onPress={() => setFilterModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.bottomSheetContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Filter Activity by Type</Text>
              <TouchableOpacity
                onPress={() => setFilterModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Grid of Yellow Circular Icons */}
            <View style={styles.categoryGrid}>
              {CATEGORY_ITEMS.map((item) => {
                const isSelected = categoryFilter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.categoryItemCol}
                    onPress={() => {
                      setCategoryFilter(isSelected ? 'ALL' : item.key);
                      setFilterModalOpen(false);
                    }}
                  >
                    <View style={[styles.categoryYellowCircle, isSelected && styles.categorySelectedCircle]}>
                      <Ionicons
                        name={item.iconName}
                        size={26}
                        color={isSelected ? '#fff' : '#1f2937'}
                      />
                    </View>
                    <Text style={[styles.categoryLabelText, isSelected && { fontWeight: '800', color: colors.primary }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {categoryFilter !== 'ALL' && (
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => {
                  setCategoryFilter('ALL');
                  setFilterModalOpen(false);
                }}
              >
                <Text style={styles.resetFilterBtnText}>Show All Activities</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ================= MODAL 2: DATE SELECTOR MODAL ================= */}
      <Modal
        visible={dateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setDateModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalCardTitle}>Filter by Date</Text>
              <TouchableOpacity
                onPress={() => setDateModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10, marginVertical: 14 }}>
              {[
                { key: 'ALL', label: 'All Dates' },
                { key: 'TODAY', label: 'Today Only' },
                { key: 'YESTERDAY', label: 'Yesterday Only' },
                { key: 'EARLIER', label: 'Earlier (Past records)' },
              ].map((d) => (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.dateOptionBtn, dateFilter === d.key && styles.dateOptionBtnActive]}
                  onPress={() => {
                    setDateFilter(d.key as DateFilter);
                    setDateModalOpen(false);
                  }}
                >
                  <Text style={[styles.dateOptionText, dateFilter === d.key && styles.dateOptionTextActive]}>
                    {d.label}
                  </Text>
                  {dateFilter === d.key && <Ionicons name="checkmark-circle" size={18} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ================= MODAL 3: FULL VISITOR & ENTRY DETAIL MODAL ================= */}
      <Modal
        visible={!!detailsEntry}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsEntry(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setDetailsEntry(null)}
        >
          <TouchableOpacity
            style={styles.modalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalCardTitle}>Visitor & Entry Details</Text>
              <TouchableOpacity
                onPress={() => setDetailsEntry(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {detailsEntry && (
              <ScrollView style={{ maxHeight: 360, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
                {/* Person Header */}
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <View style={[styles.largeAvatar, { backgroundColor: detailsEntry.color }]}>
                    <Text style={styles.largeAvatarText}>{detailsEntry.initials}</Text>
                  </View>
                  <Text style={styles.detailModalName}>{detailsEntry.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <View
                      style={[
                        styles.statusBadge,
                        detailsEntry.status === 'Entered' ? styles.statusBadgeInside : styles.statusBadgeLeft,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          detailsEntry.status === 'Entered' ? styles.statusTextInside : styles.statusTextLeft,
                        ]}
                      >
                        {detailsEntry.status === 'Entered' ? 'CURRENTLY INSIDE' : 'EXITED PROPERTY'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Information Rows */}
                <View style={styles.infoSectionBox}>
                  <View style={styles.infoLine}>
                    <Ionicons name="time-outline" size={18} color={colors.textMuted} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.infoLineLabel}>Entry In-Time</Text>
                      <Text style={styles.infoLineVal}>{detailsEntry.time} ({detailsEntry.fullDate})</Text>
                    </View>
                  </View>

                  {detailsEntry.exitAt && (
                    <View style={[styles.infoLine, { marginTop: 10 }]}>
                      <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.infoLineLabel}>Exit Out-Time</Text>
                        <Text style={styles.infoLineVal}>
                          {new Date(detailsEntry.exitAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  )}

                  {getDurationText(detailsEntry.entryAt, detailsEntry.exitAt) && (
                    <View style={[styles.infoLine, { marginTop: 10 }]}>
                      <Ionicons name="timer-outline" size={18} color={detailsEntry.status === 'Entered' ? '#16a34a' : colors.textMuted} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.infoLineLabel}>Visit Duration</Text>
                        <Text style={[styles.infoLineVal, detailsEntry.status === 'Entered' && { color: '#16a34a', fontWeight: '800' }]}>
                          {getDurationText(detailsEntry.entryAt, detailsEntry.exitAt)} {detailsEntry.status === 'Entered' ? '• Currently inside building' : '• Total stay duration'}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={[styles.infoLine, { marginTop: 10 }]}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.infoLineLabel}>Entry Method & Gate</Text>
                      <Text style={styles.infoLineVal}>{detailsEntry.method} • {detailsEntry.gate || 'Main Gate 1'}</Text>
                    </View>
                  </View>

                  {detailsEntry.vehicleNumber && (
                    <View style={[styles.infoLine, { marginTop: 10 }]}>
                      <Ionicons name="car-outline" size={18} color={colors.textMuted} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.infoLineLabel}>Vehicle Number</Text>
                        <Text style={styles.infoLineVal}>{detailsEntry.vehicleNumber}</Text>
                      </View>
                    </View>
                  )}

                  {detailsEntry.phone && (
                    <View style={[styles.infoLine, { marginTop: 10 }]}>
                      <Ionicons name="call-outline" size={18} color={colors.textMuted} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.infoLineLabel}>Visitor Phone</Text>
                        <Text style={styles.infoLineVal}>{detailsEntry.phone}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* OVERSTAY ALERT BUTTON FOR VISITOR */}
                {detailsEntry.status === 'Entered' && (
                  <TouchableOpacity
                    style={styles.overstayBannerBtn}
                    onPress={() => {
                      const entryToAlert = detailsEntry;
                      setDetailsEntry(null);
                      setOverstayEntry(entryToAlert);
                    }}
                  >
                    <Ionicons name="warning" size={20} color="#fff" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.overstayBannerTitle}>Notify Guards of Overstay</Text>
                      <Text style={styles.overstayBannerSub}>
                        Visitor is staying longer than scheduled pass time. Click to alert security team immediately.
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}

            {/* Bottom Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              {detailsEntry?.phone && (
                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, { flex: 1, backgroundColor: '#16a34a' }]}
                  onPress={() => dialPhone(detailsEntry.phone)}
                >
                  <Ionicons name="call" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.modalPrimaryBtnText}>Call Visitor</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { flex: 1 }]}
                onPress={() => setDetailsEntry(null)}
              >
                <Text style={styles.modalSecondaryBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ================= MODAL 4: NOTIFY GUARDS OF EXTENDED STAY / OVERSTAY ================= */}
      <Modal
        visible={!!overstayEntry}
        transparent
        animationType="slide"
        onRequestClose={() => setOverstayEntry(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOverstayEntry(null)}
        >
          <TouchableOpacity
            style={styles.modalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="warning" size={22} color="#dc2626" style={{ marginRight: 8 }} />
                <Text style={styles.modalCardTitle}>Alert Security Guards</Text>
              </View>
              <TouchableOpacity
                onPress={() => setOverstayEntry(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.overstayExplainerText}>
              Broadcast an instant alert directly to all security guards on duty for visitor{' '}
              <Text style={{ fontWeight: '800', color: colors.text }}>"{overstayEntry?.name}"</Text>.
            </Text>

            {/* Expected Duration Extension */}
            <Text style={styles.inputFieldLabel}>Expected Extra Stay Duration:</Text>
            <View style={styles.durationPillsRow}>
              {['30 mins', '1 hour', '2 hours', 'Overnight', 'Unknown / Delay'].map((dur) => (
                <TouchableOpacity
                  key={dur}
                  style={[styles.durationPill, overstayDuration === dur && styles.durationPillActive]}
                  onPress={() => setOverstayDuration(dur)}
                >
                  <Text style={[styles.durationPillText, overstayDuration === dur && { color: '#fff', fontWeight: '800' }]}>
                    {dur}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reason input */}
            <Text style={styles.inputFieldLabel}>Note / Reason for Security Guards:</Text>
            <TextInput
              style={styles.overstayTextInput}
              placeholder="e.g. Work is still in progress, or visitor waiting for luggage..."
              placeholderTextColor={colors.textMuted}
              value={overstayReason}
              onChangeText={setOverstayReason}
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity
              style={[styles.modalPrimaryBtn, { backgroundColor: '#dc2626', marginTop: 14 }]}
              onPress={handleSendOverstayAlert}
              disabled={notifyingGuards}
            >
              <Ionicons name="megaphone" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.modalPrimaryBtnText}>
                {notifyingGuards ? 'Broadcasting Alert...' : 'Send Alert to All Guards'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ================= MODAL 5: RATE VISITOR MODAL ================= */}
      <Modal
        visible={!!rateEntry}
        transparent
        animationType="fade"
        onRequestClose={() => setRateEntry(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setRateEntry(null)}
        >
          <TouchableOpacity
            style={styles.modalCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalCardTitle}>Rate Service / Visitor</Text>
              <TouchableOpacity
                onPress={() => setRateEntry(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.overstayExplainerText, { marginVertical: 8 }]}>
              Rate your experience with {rateEntry?.name}.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 14 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setRatingVal(s)} style={{ padding: 6 }}>
                  <Ionicons
                    name={s <= ratingVal ? 'star' : 'star-outline'}
                    size={32}
                    color="#f59e0b"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setRateEntry(null);
                Alert.alert('Feedback Saved', `Thank you! Rating of ${ratingVal} stars submitted.`);
              }}
            >
              <Text style={styles.modalPrimaryBtnText}>Submit Rating</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

    // FILTER BAR
    filtersBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 10,
    },
    filterBarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    filterBarBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterBarBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    clearFilterBtn: {
      padding: 6,
    },

    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 90,
      paddingTop: 6,
    },

    // TOP PASS CARD (Screenshot 1)
    topPassCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    topPassHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    passIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#fef08a',
      justifyContent: 'center',
      alignItems: 'center',
    },
    passTitleText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    passCreatedBadge: {
      backgroundColor: '#38bdf8',
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 4,
      marginRight: 6,
    },
    passCreatedText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#0f172a',
    },
    passCreatedTime: {
      fontSize: 11,
      color: colors.textMuted,
    },
    passDetailsList: {
      marginVertical: 12,
      gap: 6,
    },
    passDetailLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    passDetailLineText: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '500',
    },
    passCardBottomActions: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      marginTop: 4,
    },
    passCardBtn: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 4,
    },
    passCardBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    passBtnDivider: {
      width: 1,
      height: 18,
      backgroundColor: colors.border,
    },

    // DATE SEPARATOR
    dateSeparatorPill: {
      alignSelf: 'center',
      backgroundColor: isDark ? '#334155' : '#e0f2fe',
      paddingHorizontal: 14,
      paddingVertical: 4,
      borderRadius: 10,
      marginVertical: 8,
    },
    dateSeparatorText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#bae6fd' : '#0369a1',
    },

    // ENTRY CARDS
    entryCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    entryTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '800',
    },
    entryMainContent: {
      flex: 1,
      marginLeft: 12,
    },
    nameStarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    visitorName: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
      flex: 1,
    },
    starRatingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 6,
    },
    starRatingText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
    },
    statusTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    statusBadgeInside: {
      backgroundColor: '#dcfce7',
    },
    statusBadgeLeft: {
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
    },
    statusBadgeText: {
      fontSize: 9,
      fontWeight: '800',
    },
    statusTextInside: {
      color: '#15803d',
    },
    statusTextLeft: {
      color: colors.textMuted,
    },
    durationChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    durationChipActive: {
      backgroundColor: isDark ? '#143823' : '#dcfce7',
      borderColor: isDark ? '#166534' : '#bbf7d0',
    },
    durationChipText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
    },
    durationChipTextActive: {
      color: '#16a34a',
    },
    timeCategorySub: {
      fontSize: 11,
      color: colors.textMuted,
      flex: 1,
    },
    cardActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      marginTop: 10,
      gap: 8,
    },
    cardActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      flex: 1,
      gap: 4,
    },
    cardActionBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    cardActionOverstayBtn: {
      backgroundColor: 'rgba(220, 38, 38, 0.12)',
    },

    // EMPTY STATE
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
      marginTop: 40,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? '#334155' : '#e0e7ff',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    emptySub: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
    },

    // FAB
    fabButton: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#facc15',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
    },

    // BOTTOM SHEET (Screenshot 2)
    bottomSheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    bottomSheetContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 36,
    },
    bottomSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    bottomSheetTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 16,
    },
    categoryItemCol: {
      width: '22%',
      alignItems: 'center',
    },
    categoryYellowCircle: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: '#fde047',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    categorySelectedCircle: {
      backgroundColor: colors.primary,
    },
    categoryLabelText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    resetFilterBtn: {
      marginTop: 20,
      paddingVertical: 12,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      borderRadius: 12,
      alignItems: 'center',
    },
    resetFilterBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },

    // GENERIC MODALS
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalCardTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    largeAvatar: {
      width: 58,
      height: 58,
      borderRadius: 29,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    largeAvatarText: {
      fontSize: 22,
      fontWeight: '800',
      color: '#fff',
    },
    detailModalName: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    infoSectionBox: {
      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 10,
    },
    infoLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    infoLineLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    infoLineVal: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginTop: 1,
    },
    overstayBannerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#dc2626',
      padding: 12,
      borderRadius: 14,
      marginTop: 8,
    },
    overstayBannerTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: '#fff',
    },
    overstayBannerSub: {
      fontSize: 11,
      color: '#fee2e2',
      marginTop: 2,
    },
    modalPrimaryBtn: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalPrimaryBtnText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 14,
    },
    modalSecondaryBtn: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#334155' : '#E2E8F0',
      paddingVertical: 12,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalSecondaryBtnText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 14,
    },

    // OVERSTAY ALERT MODAL SPECIFIC
    overstayExplainerText: {
      fontSize: 13,
      color: colors.textMuted,
      marginVertical: 8,
      lineHeight: 18,
    },
    inputFieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginTop: 10,
      marginBottom: 6,
    },
    durationPillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 6,
    },
    durationPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      borderWidth: 1,
      borderColor: colors.border,
    },
    durationPillActive: {
      backgroundColor: '#dc2626',
      borderColor: '#dc2626',
    },
    durationPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
    },
    overstayTextInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: colors.text,
      textAlignVertical: 'top',
    },

    dateOptionBtn: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
    },
    dateOptionBtnActive: {
      backgroundColor: colors.primary,
    },
    dateOptionText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    dateOptionTextActive: {
      color: '#fff',
    },
  });
