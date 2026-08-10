import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './HomeScreen';
import ScanScreen from './ScanScreen';
import WalkInScreen from './WalkInScreen';
import AlertsScreen from './AlertsScreen';
import ShiftHandoverScreen from './ShiftHandoverScreen';
import OfflineBanner from '../components/OfflineBanner';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ThemeColors } from '../theme/colors';
import { TranslationKey } from '../i18n/translations';

type Tab = 'home' | 'scan' | 'walkin' | 'handover' | 'alerts';

const TAB_CONFIG: { key: Tab; icon: keyof typeof Ionicons.glyphMap; labelKey: TranslationKey }[] = [
  { key: 'home', icon: 'home', labelKey: 'tab_home' },
  { key: 'scan', icon: 'scan-outline', labelKey: 'tab_scan' },
  { key: 'walkin', icon: 'person-add-outline', labelKey: 'tab_walkin' },
  { key: 'handover', icon: 'swap-horizontal-outline', labelKey: 'tab_handover' },
  { key: 'alerts', icon: 'warning-outline', labelKey: 'tab_alerts' },
];

export default function GuardShell() {
  const [tab, setTab] = useState<Tab>('home');
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors);

  // Android's status bar height is a stable ~24dp regardless of device — use that directly
  // instead of insets.top, which some Android skins over-report under edge-to-edge, leaving
  // a large blank gap above every header. iOS notch/Dynamic Island heights genuinely vary
  // per device, so those stay dynamic.
  const topPadding = Platform.OS === 'android' ? 24 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <OfflineBanner />
      <View style={styles.body}>
        {tab === 'home' && <HomeScreen onNavigate={setTab} />}
        {tab === 'scan' && <ScanScreen />}
        {tab === 'walkin' && <WalkInScreen navigation={{ goBack: () => setTab('home') }} />}
        {tab === 'handover' && <ShiftHandoverScreen onNavigate={setTab} />}
        {tab === 'alerts' && <AlertsScreen />}
      </View>

      <View style={styles.tabBar}>
        {TAB_CONFIG.map((tabItem) => {
          const active = tabItem.key === tab;
          return (
            <TouchableOpacity key={tabItem.key} style={styles.tabItem} onPress={() => setTab(tabItem.key)}>
              <Ionicons name={tabItem.icon} size={22} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t(tabItem.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
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
