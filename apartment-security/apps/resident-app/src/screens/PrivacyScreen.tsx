import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';

export default function PrivacyScreen() {
  const { showUnitInCommunity, updateShowUnitInCommunity } = useData();
  const { colors } = useTheme();
  const styles = getStyles(colors);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.prefRow}>
        <View style={styles.prefTextGroup}>
          <Text style={styles.prefTitle}>Show my unit in Community</Text>
          <Text style={styles.prefDesc}>
            Let other residents see your tower and flat number next to your name in the Community chat.
          </Text>
        </View>
        {saving ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <TouchableOpacity
            style={[styles.toggleSwitch, { backgroundColor: showUnitInCommunity ? colors.success : colors.border }]}
            onPress={handleToggle}
          >
            <View style={[styles.toggleThumb, showUnitInCommunity && styles.toggleThumbActive]} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.footnote}>
        Your name is always visible to other residents in Community. Turning this off only hides your unit number.
      </Text>
    </ScrollView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20 },
    prefRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    prefTextGroup: { flex: 1, marginRight: 16 },
    prefTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    prefDesc: { fontSize: 14, color: colors.textMuted },
    toggleSwitch: { width: 50, height: 30, borderRadius: 15, justifyContent: 'center', padding: 2 },
    toggleThumb: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.card,
    },
    toggleThumbActive: { transform: [{ translateX: 20 }] },
    footnote: { fontSize: 12, color: colors.textMuted, marginTop: 16, lineHeight: 18 },
  });
