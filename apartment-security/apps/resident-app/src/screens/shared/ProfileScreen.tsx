import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../../context/ThemeContext';
import LogoutConfirmModal from '../../components/LogoutConfirmModal';

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { logout, userProfile, userPhone } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const name = userProfile?.name || 'Resident';
  const phone = userProfile?.phone || userPhone || '';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const propertyName = userProfile?.propertyName || 'Apartment Security';

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await logout();
    } finally {
      setIsLoggingOut(false);
      setLogoutModalVisible(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER (Matching Entries & Home Design) */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subTitle}>{propertyName} • Resident Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* MAIN PROFILE CARD */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.profileRow}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('Household')}
          >
            {/* Quick Actions Style Monochrome Icon Box */}
            <View style={styles.quickActionAvatarBox}>
              <Ionicons name="person-outline" size={26} color={colors.text} />
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.propertyText}>{propertyName}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* CONTACT INFO */}
          <View style={styles.detailsContainer}>
            {!!phone && (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={15} color={colors.textMuted} />
                <Text style={styles.detailText}>{phone}</Text>
              </View>
            )}
            {!!userProfile?.email && (
              <View style={styles.detailRow}>
                <Ionicons name="mail-outline" size={15} color={colors.textMuted} />
                <Text style={styles.detailText}>{userProfile.email}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* RESIDENT INFO GRID (Box sizes matching Entries) */}
          <View style={styles.infoGrid}>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoGridLabel}>Tower</Text>
              <Text style={styles.infoGridValue}>{userProfile?.wing || 'Tower A'}</Text>
            </View>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoGridLabel}>Flat</Text>
              <Text style={styles.infoGridValue}>{userProfile?.flat || 'Flat 402'}</Text>
            </View>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoGridLabel}>Role</Text>
              <Text style={styles.infoGridValue}>{userProfile?.residentType || 'Owner'}</Text>
            </View>
            <View style={styles.infoGridItem}>
              <Text style={styles.infoGridLabel}>Membership</Text>
              <Text style={styles.infoGridValue}>
                {userProfile?.isPrimary ? 'Primary' : userProfile?.relationship || 'Resident'}
              </Text>
            </View>
          </View>
        </View>

        {/* APPEARANCE TOGGLE ROW */}
        <TouchableOpacity style={styles.appearanceRow} onPress={toggleTheme} activeOpacity={0.8}>
          <View style={styles.quickActionIconBox}>
            <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={colors.text} />
          </View>
          <View style={styles.rowTextGroup}>
            <Text style={styles.rowTitle}>Theme & Appearance</Text>
            <Text style={styles.rowSubtitle}>{isDark ? 'Dark Theme (Active)' : 'Light Theme (Active)'}</Text>
          </View>
          <View style={styles.appearanceToggle}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={15} color={colors.text} />
          </View>
        </TouchableOpacity>

        {/* SETTINGS SECTION */}
        <Text style={styles.sectionLabel}>PREFERENCES & SECURITY</Text>
        <View style={styles.menuCard}>
          <MenuRow
            icon="people-outline"
            label="My Family & Household"
            subLabel="Manage family members & permissions"
            colors={colors}
            isDark={isDark}
            onPress={() => navigation.navigate('Household')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="notifications-outline"
            label="Notification Preferences"
            subLabel="Gate alerts, intercom, WhatsApp"
            colors={colors}
            isDark={isDark}
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="shield-checkmark-outline"
            label="Security & Guard Settings"
            subLabel="Duress PIN, Auto-approval rules"
            colors={colors}
            isDark={isDark}
            onPress={() => navigation.navigate('SecuritySettings')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="eye-off-outline"
            label="Privacy & Visibility"
            subLabel="Control profile visibility in directory"
            colors={colors}
            isDark={isDark}
            onPress={() => navigation.navigate('Privacy')}
          />
        </View>

        {/* ABOUT SECTION */}
        <Text style={styles.sectionLabel}>SYSTEM & SUPPORT</Text>
        <View style={styles.menuCard}>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.quickActionIconBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.text} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.rowTitle}>App Version</Text>
                <Text style={styles.rowSubtitle}>Latest stable release</Text>
              </View>
            </View>
            <Text style={styles.versionValue}>v{appVersion}</Text>
          </View>

          <View style={styles.menuDivider} />

          <MenuRow
            icon="help-circle-outline"
            label="Help & Society Support"
            subLabel="Gate helpline and management office"
            colors={colors}
            isDark={isDark}
            onPress={() => navigation.navigate('HelpSupport')}
          />
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setLogoutModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color="#dc2626" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out Account</Text>
        </TouchableOpacity>
      </ScrollView>

      <LogoutConfirmModal
        visible={logoutModalVisible}
        loading={isLoggingOut}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={handleConfirmLogout}
        title="Log Out"
        message="Are you sure you want to log out of your account?"
      />
    </SafeAreaView>
  );
}

function MenuRow({
  icon,
  label,
  subLabel,
  colors,
  isDark,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subLabel?: string;
  colors: any;
  isDark: boolean;
  onPress: () => void;
}) {
  const styles = getStyles(colors, isDark);
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.menuItemLeft}>
        <View style={styles.quickActionIconBox}>
          <Ionicons name={icon} size={20} color={colors.text} />
        </View>
        <View style={styles.menuTextCol}>
          <Text style={styles.rowTitle}>{label}</Text>
          {!!subLabel && <Text style={styles.rowSubtitle}>{subLabel}</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
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
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 40,
    },

    // PROFILE CARD (Matching Entries & Home Box Sizes)
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    quickActionAvatarBox: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    profileInfo: {
      flex: 1,
    },
    name: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 2,
    },
    propertyText: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '500',
    },
    detailsContainer: {
      gap: 6,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#f1f5f9',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      marginVertical: 12,
    },
    infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    infoGridItem: {
      width: '48%',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoGridLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
      marginBottom: 2,
    },
    infoGridValue: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },

    // APPEARANCE ROW
    appearanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 2,
    },
    quickActionIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    rowTextGroup: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    rowSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    appearanceToggle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // SECTION HEADINGS
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 8,
      marginLeft: 4,
    },

    // MENU CARDS
    menuCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      paddingHorizontal: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 2,
    },
    menuItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    menuItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    menuTextCol: {
      flex: 1,
      marginRight: 8,
    },
    menuDivider: {
      height: 1,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
    },
    versionValue: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '700',
    },

    // LOGOUT BUTTON
    logoutButton: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#450a0a' : '#fef2f2',
      borderWidth: 1,
      borderColor: isDark ? '#7f1d1d' : '#fecaca',
      paddingVertical: 14,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 16,
    },
    logoutText: {
      color: '#dc2626',
      fontSize: 14,
      fontWeight: '800',
    },
  });
