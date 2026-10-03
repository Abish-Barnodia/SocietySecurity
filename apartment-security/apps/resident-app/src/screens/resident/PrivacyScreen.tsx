import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';

export default function PrivacyScreen() {
  const navigation = useNavigation();
  const { showUnitInCommunity, updateShowUnitInCommunity } = useData();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    setSaving(true);
    try {
      await updateShowUnitInCommunity(!showUnitInCommunity);
    } catch {
      Alert.alert('Error', 'Failed to update privacy setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Directory Privacy</Text>
          <Text style={styles.headerSubtitle}>Community visibility and profile controls</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>COMMUNITY VISIBILITY</Text>
        <View style={styles.card}>
          <View style={styles.prefRow}>
            <View style={styles.prefIconBox}>
              <Ionicons name="eye-outline" size={20} color={colors.text} />
            </View>
            <View style={styles.prefTextGroup}>
              <Text style={styles.prefTitle}>Show Unit in Community</Text>
              <Text style={styles.prefDesc}>
                Let other society residents see your tower and flat number next to your name.
              </Text>
            </View>
            {saving ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <TouchableOpacity
                style={[styles.toggleSwitch, { backgroundColor: showUnitInCommunity ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#334155' : '#e2e8f0') }]}
                onPress={handleToggle}
              >
                <View style={[styles.toggleThumb, showUnitInCommunity && (isDark ? styles.toggleThumbActiveDark : styles.toggleThumbActive)]} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={styles.footnote}>
            Your full name is visible to neighbors in the Resident Directory for community communications. Turning this setting off only conceals your flat number.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0f172a' : '#f5f3ef' },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    content: { paddingHorizontal: 20, paddingBottom: 40 },

    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    prefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
    },
    prefIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    prefTextGroup: { flex: 1, marginRight: 12 },
    prefTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    prefDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },

    toggleSwitch: { width: 48, height: 28, borderRadius: 14, justifyContent: 'center', padding: 2 },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#ffffff',
    },
    toggleThumbActive: { transform: [{ translateX: 20 }], backgroundColor: '#ffffff' },
    toggleThumbActiveDark: { transform: [{ translateX: 20 }], backgroundColor: '#0f172a' },

    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 4,
      marginTop: 4,
    },
    footnote: { fontSize: 12, color: colors.textMuted, lineHeight: 18, flex: 1 },
  });
