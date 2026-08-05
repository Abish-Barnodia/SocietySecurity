import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from '../../context/ThemeContext';

const FAQS = [
  {
    q: 'How do I create a visitor pass?',
    a: 'Go to the Passes tab and tap "Create pass". Fill in the visitor details and share the QR code or OTP with them.',
  },
  {
    q: 'How does Community work?',
    a: 'The Community tab is a shared group chat for everyone in your property — send messages, photos, voice notes, and polls.',
  },
  {
    q: 'What happens when I send a silent alert?',
    a: 'Security Settings → "Send silent alert" immediately and silently notifies the guard station and property management, with no sound on your device.',
  },
  {
    q: 'How do I stop receiving entry notifications?',
    a: 'Go to Profile → Notification Settings and turn off the alert types you no longer want.',
  },
];

export default function HelpSupportScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>FREQUENTLY ASKED QUESTIONS</Text>
      <View style={styles.card}>
        {FAQS.map((item, index) => (
          <View key={item.q} style={[styles.faqItem, index === FAQS.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={styles.faqQuestion}>{item.q}</Text>
            <Text style={styles.faqAnswer}>{item.a}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>EMERGENCY NUMBERS</Text>
      <View style={styles.card}>
        <Text style={styles.emergencyText}>
          For immediate danger, call emergency services directly:
        </Text>
        <Text style={styles.emergencyNumbers}>
          <Text style={styles.emergencyBold}>100</Text> (Police) · <Text style={styles.emergencyBold}>112</Text> (Emergency)
        </Text>
      </View>

      <Text style={styles.versionFooter}>App version {appVersion}</Text>
    </ScrollView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 8,
      marginTop: 8,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingHorizontal: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    faqItem: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    faqQuestion: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
    faqAnswer: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    emergencyText: { fontSize: 13, color: colors.textMuted, paddingTop: 14 },
    emergencyNumbers: { fontSize: 14, color: colors.text, paddingBottom: 14, paddingTop: 6 },
    emergencyBold: { fontWeight: 'bold' },
    versionFooter: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 12 },
  });
