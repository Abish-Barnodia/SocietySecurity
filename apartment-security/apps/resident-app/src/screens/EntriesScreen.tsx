import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { colors } from '../theme/colors';
import { useData } from '../context/DataContext';

export default function EntriesScreen() {
  const { entries } = useData();

  const renderEntry = (item: any) => (
    <View key={item.id} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: item.color }]}>
          <Text style={styles.avatarText}>{item.initials}</Text>
        </View>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.time}>{item.time}</Text>
          </View>
          <View style={styles.detailsRow}>
            <View style={[styles.badge, { backgroundColor: item.statusColor + '20' }]}>
              <Text style={[styles.badgeText, { color: item.statusColor }]}>{item.status}</Text>
            </View>
            <Text style={styles.methodText}> • {item.method}</Text>
          </View>
          {item.gate ? <Text style={styles.gateText}>{item.gate}</Text> : null}
        </View>
      </View>
    </View>
  );

  const entriesToday = entries.filter(e => e.date === 'TODAY');
  const entriesYesterday = entries.filter(e => e.date === 'YESTERDAY');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Entry log</Text>
      </View>
      <ScrollView contentContainerStyle={styles.listContent}>
        {entries.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center', marginTop: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📜</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>No entry records</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>Entries and exits will appear here.</Text>
          </View>
        ) : (
          <>
            {entriesToday.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>TODAY</Text>
                {entriesToday.map(renderEntry)}
              </>
            )}

            {entriesYesterday.length > 0 && (
              <>
                <Text style={[styles.sectionHeader, { marginTop: entriesToday.length > 0 ? 16 : 0 }]}>YESTERDAY</Text>
                {entriesYesterday.map(renderEntry)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textMuted,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  time: {
    fontSize: 14,
    color: colors.textMuted,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  methodText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  gateText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
});
