import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'GuardTabs'>;

export default function GuardHomeScreen({ navigation }: { navigation: NavigationProp }) {
  const { userPhone, logout } = useAuth();
  const { scanRequests } = useData();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const pendingCount = scanRequests.filter(r => r.status === 'PENDING').length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Security Dashboard</Text>
            <Text style={styles.subtitle}>Logged in as {userPhone}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={24} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{scanRequests.length}</Text>
            <Text style={styles.statLabel}>Requests Sent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending Approval</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ScanPass')}>
          <Ionicons name="qr-code-outline" size={32} color={colors.white} />
          <Text style={styles.actionText}>Scan Entry Pass</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.success }]} onPress={() => navigation.navigate('ScanPass')}>
          <Ionicons name="person-add-outline" size={32} color={colors.white} />
          <Text style={styles.actionText}>Walk-in Entry</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Requests</Text>
        {scanRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ color: colors.textMuted }}>No recent scan requests.</Text>
          </View>
        ) : (
          scanRequests.map(req => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestName}>{req.visitorName}</Text>
                  <Text style={styles.requestTime}>{req.time}</Text>
                </View>
                <View style={[styles.statusBadge, {
                  backgroundColor: req.status === 'APPROVED' ? colors.successLight : req.status === 'DENIED' ? colors.dangerLight : colors.warningLight
                }]}>
                  <Text style={[styles.statusText, {
                    color: req.status === 'APPROVED' ? colors.success : req.status === 'DENIED' ? colors.danger : colors.warning
                  }]}>{req.status}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: colors.dangerLight,
    borderRadius: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 16,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
  },
  actionText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 16,
  },
  emptyCard: {
    backgroundColor: colors.card,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestCard: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  requestTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
