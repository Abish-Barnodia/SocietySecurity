import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../../context/ThemeContext';

const FAQS = [
  {
    q: 'How do I generate a visitor pass?',
    a: 'Tap the "Visitor" or "Delivery" Quick Action on the home screen or go to the Passes tab and tap "Create Pass". Fill in visitor details to get a fast-entry QR code and OTP.',
  },
  {
    q: 'How do I approve or deny guest arrivals?',
    a: 'When an unannounced guest or delivery arrives at the gate, guards verify your unit and you receive an instant push notification with a photo. Tap Approve or Deny directly from the screen.',
  },
  {
    q: 'How does the Resident Directory & Community work?',
    a: 'The Community Hub lets you view society notices, communicate with neighbors in the society group chat, or start 1-on-1 direct messages with fellow verified residents.',
  },
  {
    q: 'What happens when I trigger Silent Panic SOS?',
    a: 'Security Settings → "Silent Panic Alert" immediately and discreetly dispatches a high-priority alert to the gate security guards and estate management desk without making any noise.',
  },
  {
    q: 'How do I manage daily help and staff entries?',
    a: 'Go to Daily Help under Quick Actions to add your housekeeper, cook, or driver. You will receive automatic check-in timestamps whenever they enter the society.',
  },
];

export default function HelpSupportScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSubtitle}>FAQ guides and emergency society helplines</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>EMERGENCY HELPLINES</Text>
        <View style={styles.card}>
          <View style={styles.emergencyRow}>
            <View style={styles.emergencyIconBox}>
              <Ionicons name="call-outline" size={22} color="#ef4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.emergencyTitle}>National Emergency Services</Text>
              <Text style={styles.emergencyNumbers}>
                <Text style={styles.emergencyBold}>112</Text> (National SOS) · <Text style={styles.emergencyBold}>100</Text> (Police) · <Text style={styles.emergencyBold}>101</Text> (Fire) · <Text style={styles.emergencyBold}>102</Text> (Ambulance)
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>FREQUENTLY ASKED QUESTIONS</Text>
        <View style={styles.card}>
          {FAQS.map((item, index) => (
            <View key={item.q} style={[styles.faqItem, index === FAQS.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={styles.qIconBox}>
                  <Ionicons name="help-circle-outline" size={18} color={colors.text} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  <Text style={styles.faqAnswer}>{item.a}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.versionFooter}>Smart Society Security · Version {appVersion}</Text>
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

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 14,
    },
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    emergencyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
    },
    emergencyIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emergencyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    emergencyNumbers: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    emergencyBold: { fontWeight: '800', color: colors.text },

    faqItem: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    qIconBox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    faqQuestion: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
    faqAnswer: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    versionFooter: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 24, marginBottom: 8 },
  });
