import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../../context/ThemeContext';

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { logout, userProfile, userPhone } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = getStyles(colors);

  const name = userProfile?.name || 'Resident';
  const phone = userProfile?.phone || userPhone || '';
  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Profile</Text>

        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.profileRow} 
            activeOpacity={0.7} 
            onPress={() => navigation.navigate('Household')}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={28} color={colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.propertyText}>{userProfile?.propertyName || 'Apartment Security'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.detailsContainer}>
            {!!phone && (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                <Text style={styles.detailText}>{phone}</Text>
              </View>
            )}
            {!!userProfile?.email && (
              <View style={styles.detailRow}>
                <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                <Text style={styles.detailText}>{userProfile.email}</Text>
              </View>
            )}
          </View>

          <View style={[styles.divider, { marginVertical: 16 }]} />

          <View style={styles.infoGrid}>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoGridLabel}>Tower</Text>
              <Text style={styles.infoGridValue}>{userProfile?.wing || '—'}</Text>
            </View>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoGridLabel}>Flat</Text>
              <Text style={styles.infoGridValue}>{userProfile?.flat || '—'}</Text>
            </View>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoGridLabel}>Role</Text>
              <Text style={styles.infoGridValue}>{userProfile?.residentType || 'Owner'}</Text>
            </View>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoGridLabel}>Type</Text>
              <Text style={styles.infoGridValue}>{userProfile?.isPrimary ? 'Primary' : (userProfile?.relationship || 'Member')}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.appearanceRow} onPress={toggleTheme} activeOpacity={0.7}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={colors.primary} />
          </View>
          <View style={styles.rowTextGroup}>
            <Text style={styles.rowTitle}>Appearance</Text>
            <Text style={styles.rowSubtitle}>{isDark ? 'Dark mode' : 'Light mode'}</Text>
          </View>
          <View style={styles.appearanceToggle}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.menuCard}>
          <MenuRow
            icon="people"
            iconBg={colors.primaryLight}
            iconColor={colors.primary}
            label="My Family / Household"
            colors={colors}
            onPress={() => navigation.navigate('Household')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="notifications"
            iconBg={colors.primaryLight}
            iconColor={colors.primary}
            label="Notification Settings"
            colors={colors}
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="shield-checkmark"
            iconBg={colors.dangerLight}
            iconColor={colors.danger}
            label="Security Settings"
            colors={colors}
            onPress={() => navigation.navigate('SecuritySettings')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="eye-off"
            iconBg={colors.border}
            iconColor={colors.textMuted}
            label="Privacy"
            colors={colors}
            onPress={() => navigation.navigate('Privacy')}
          />
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.menuCard}>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="information-circle" size={18} color={colors.primary} />
              </View>
              <Text style={styles.rowTitle}>App Version</Text>
            </View>
            <Text style={styles.versionValue}>{appVersion}</Text>
          </View>
          <View style={styles.divider} />
          <MenuRow
            icon="help-circle"
            iconBg={colors.primaryLight}
            iconColor={colors.primary}
            label="Help & Support"
            colors={colors}
            onPress={() => navigation.navigate('HelpSupport')}
          />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({
  icon,
  iconBg,
  iconColor,
  label,
  colors,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
}) {
  const styles = getStyles(colors);
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.rowTitle}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    pageTitle: {
      fontSize: 26,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    profileInfo: { flex: 1 },
    name: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 2,
    },
    propertyText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    detailsContainer: {
      gap: 8,
      marginTop: 4,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      fontSize: 15,
      color: colors.text,
    },
    infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    infoGridItem: {
      width: '48%',
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoGridLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
    },
    infoGridValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    appearanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    rowTextGroup: { flex: 1 },
    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 1,
    },
    appearanceToggle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 8,
      marginLeft: 4,
    },
    menuCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingHorizontal: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
    },
    menuItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    versionValue: {
      fontSize: 14,
      color: colors.textMuted,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    logoutButton: {
      flexDirection: 'row',
      backgroundColor: colors.dangerLight,
      padding: 16,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoutText: {
      color: colors.danger,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
