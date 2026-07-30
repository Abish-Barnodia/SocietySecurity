import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './HomeScreen';
import ScanScreen from './ScanScreen';
import WalkInScreen from './WalkInScreen';
import { colors } from '../theme/colors';

type Tab = 'home' | 'scan' | 'walkin' | 'directory' | 'alerts';

const TABS: { key: Tab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'scan', icon: 'scan-outline', label: 'Scan' },
  { key: 'walkin', icon: 'person-add-outline', label: 'Walk-In' },
  { key: 'directory', icon: 'id-card-outline', label: 'Directory' },
  { key: 'alerts', icon: 'warning-outline', label: 'Alerts' },
];

// ponytail: Walk-In/Directory/Alerts are still placeholders — the underlying
// screens aren't built yet. Swap them in once they exist; the tab wiring
// here won't need to change.
function ComingSoon({ label }: { label: string }) {
  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonText}>{label} is coming soon.</Text>
    </View>
  );
}

export default function GuardShell() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        {tab === 'home' && <HomeScreen onNavigate={setTab} />}
        {tab === 'scan' && <ScanScreen />}
        {tab === 'walkin' && <WalkInScreen navigation={{ goBack: () => setTab('home') }} />}
        {tab === 'directory' && <ComingSoon label="Resident directory" />}
        {tab === 'alerts' && <ComingSoon label="Raise Alert" />}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTab(t.key)}>
              <Ionicons name={t.icon} size={22} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  comingSoon: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  comingSoonText: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },
});
