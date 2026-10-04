import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  onNewUser: () => void;
  onExistingUser: () => void;
}

export default function WelcomeScreen({ onNewUser, onExistingUser }: Props) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.content}>
        {/* Top Brand & Hero */}
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <View style={styles.iconInner}>
              <Ionicons name="shield-checkmark" size={44} color="#00A67C" />
            </View>
          </View>

          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>SMART APARTMENT SECURITY</Text>
          </View>

          <Text style={styles.title}>Welcome to SecureGate</Text>
          <Text style={styles.subtitle}>
            Your comprehensive portal for visitor approvals, society billing, quick digital passes, and smart living.
          </Text>
        </View>

        {/* Action Choice Cards */}
        <View style={styles.actionsContainer}>
          {/* Option 1: New User */}
          <TouchableOpacity
            style={styles.actionCardPrimary}
            onPress={onNewUser}
            activeOpacity={0.88}
          >
            <View style={styles.actionIconCirclePrimary}>
              <Ionicons name="home-outline" size={26} color="#ffffff" />
            </View>
            <View style={styles.actionCardContent}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitlePrimary}>New User</Text>
                <View style={styles.tagPrimary}>
                  <Text style={styles.tagTextPrimary}>Add Home</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitlePrimary}>
                Register your apartment or request access to your society
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#00A67C" />
          </TouchableOpacity>

          {/* Option 2: Existing User */}
          <TouchableOpacity
            style={styles.actionCardSecondary}
            onPress={onExistingUser}
            activeOpacity={0.88}
          >
            <View style={styles.actionIconCircleSecondary}>
              <Ionicons name="log-in-outline" size={26} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <View style={styles.actionCardContent}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitleSecondary}>Already Existing User</Text>
                <View style={styles.tagSecondary}>
                  <Text style={styles.tagTextSecondary}>Login</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitleSecondary}>
                Sign in with your phone or email to access your account
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Ionicons name="lock-closed" size={13} color={colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>Secure 256-bit Encrypted Society Gate Access</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingVertical: 20,
      justifyContent: 'space-between',
    },
    heroSection: {
      alignItems: 'center',
      paddingTop: 36,
    },
    iconContainer: {
      width: 96,
      height: 96,
      borderRadius: 28,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(0, 166, 124, 0.3)' : '#e2e8f0',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#00A67C',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.3 : 0.12,
      shadowRadius: 16,
      elevation: 6,
      marginBottom: 20,
    },
    iconInner: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(0, 166, 124, 0.15)' : '#ecfdf5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeContainer: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(0, 166, 124, 0.2)' : '#d1fae5',
      marginBottom: 12,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#00A67C',
      letterSpacing: 1,
    },
    title: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 320,
    },
    actionsContainer: {
      gap: 16,
      marginVertical: 24,
    },
    actionCardPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 20,
      padding: 18,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(0, 166, 124, 0.4)' : '#a7f3d0',
      shadowColor: '#00A67C',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    actionIconCirclePrimary: {
      width: 50,
      height: 50,
      borderRadius: 16,
      backgroundColor: '#00A67C',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    actionCardContent: {
      flex: 1,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 3,
    },
    cardTitlePrimary: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    tagPrimary: {
      backgroundColor: isDark ? 'rgba(0, 166, 124, 0.2)' : '#ecfdf5',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    tagTextPrimary: {
      fontSize: 11,
      fontWeight: '700',
      color: '#00A67C',
    },
    cardSubtitlePrimary: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    },
    actionCardSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#e2e8f0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    actionIconCircleSecondary: {
      width: 50,
      height: 50,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    cardTitleSecondary: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    tagSecondary: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    tagTextSecondary: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#38bdf8' : '#0284c7',
    },
    cardSubtitleSecondary: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    footerText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },
  });
