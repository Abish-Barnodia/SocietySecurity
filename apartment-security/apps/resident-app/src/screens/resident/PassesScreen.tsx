import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';

const tabs = ['All', 'Active', 'Suspended', 'Past'];

export default function PassesScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { passes, suspendPass, revokePass } = useData();
  const [activeTab, setActiveTab] = useState('All');

  const handleSuspend = (id: string) => {
    Alert.alert('Suspend Pass', 'Are you sure you want to suspend this pass?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Suspend',
        style: 'destructive',
        onPress: () => suspendPass(id).catch(() => Alert.alert('Error', 'Failed to suspend pass. Please try again.')),
      },
    ]);
  };

  const handleRevoke = (id: string) => {
    Alert.alert('Revoke Pass', 'Are you sure you want to revoke/cancel this pass?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Revoke',
        style: 'destructive',
        onPress: () => revokePass(id).catch(() => Alert.alert('Error', 'Failed to revoke pass. Please try again.')),
      },
    ]);
  };

  const filteredPasses = passes.filter(pass => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Active') return pass.status === 'Active';
    if (activeTab === 'Suspended') return pass.status === 'Suspended';
    if (activeTab === 'Past') return pass.status === 'Expired';
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
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
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted }}>No passes found.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('PassDetail', { passId: item.id })}>
            <View style={styles.cardHeader}>
              <View style={styles.cardUserInfo}>
                <View style={styles.userIconBg}>
                  <Ionicons name="person" size={22} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardSubtitle}>{item.purpose}</Text>
                </View>
              </View>
              <View style={[styles.badge, { backgroundColor: item.color + '20' }]}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={[styles.badgeText, { color: item.color }]}>
                  {item.status}
                </Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={styles.detailText}>{item.created}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={styles.detailText}>{item.time}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={styles.detailText}>{item.gate || 'Main Gate'}</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              {item.status === 'Active' && (
                <>
                  <TouchableOpacity style={styles.actionBtnSuspend} onPress={() => handleSuspend(item.id)}><Text style={styles.actionTextSuspend}>Suspend</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnRevoke} onPress={() => handleRevoke(item.id)}><Text style={styles.actionTextRevoke}>Revoke</Text></TouchableOpacity>
                </>
              )}
              {item.status === 'Suspended' && (
                <TouchableOpacity style={styles.actionBtnRevoke} onPress={() => handleRevoke(item.id)}><Text style={styles.actionTextRevoke}>Revoke</Text></TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('CreatePass')}
      >
        <Ionicons name="add" size={28} color={colors.card} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.card,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIconBg: {
    width: 48,
    height: 48,
    backgroundColor: colors.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userIcon: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 4,
    color: colors.textMuted,
  },
  detailText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtnEdit: {
    flex: 1,
    backgroundColor: colors.border,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  actionTextEdit: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  actionBtnSuspend: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  actionTextSuspend: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  actionBtnRevoke: {
    flex: 1,
    backgroundColor: colors.dangerLight,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionTextRevoke: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  actionBtnFull: {
    flex: 1,
    backgroundColor: colors.border,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    color: colors.card,
    marginTop: -2,
  },
});
