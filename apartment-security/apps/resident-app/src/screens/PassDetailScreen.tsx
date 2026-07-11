import { usePasses } from '../context/DomainContexts';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';

type RoutePropType = RouteProp<RootStackParamList, 'PassDetail'>;

export default function PassDetailScreen({ navigation, route }: { navigation: any, route: RoutePropType }) {
  const { passId } = route.params;
  const { passes, updatePassStatus, deletePass } = usePasses();
  const [isSharing, setIsSharing] = React.useState(false);
  
  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);

  const pass = passes.find(p => p.id === passId);

  const generateAndSharePDF = async () => {
    if (!pass || isSharing) return;
    setIsSharing(true);
    try {
      const html = `
        <html>
          <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc;">
            <div style="background-color: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 80%; max-width: 400px; text-align: center;">
              <h1 style="color: #0f172a; margin-bottom: 5px; font-size: 32px;">${pass.name}</h1>
              <p style="color: #64748b; font-size: 18px; margin-top: 0;">${pass.purpose}</p>
              
              <div style="margin: 40px 0; word-break: break-all; background: #f1f5f9; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 11px; color: #334155;">
                ${pass.qrPayload || pass.id}
              </div>
              
              <h2 style="color: #16a34a; margin-bottom: 5px;">Valid: ${pass.time}</h2>
              <p style="color: #64748b; font-size: 16px;">Gate: ${pass.gate || 'Main Gate'} &nbsp;&bull;&nbsp; Phone: ${pass.phone || 'N/A'}</p>
              
              <div style="margin-top: 30px; font-size: 12px; color: #94a3b8;">
                Apartment Security App &nbsp;&bull;&nbsp; Pass ID: ${pass.id}
              </div>
            </div>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Share Visitor Pass' });
    } catch (error) {
      console.error(error);
      alert('Error sharing pass as PDF');
    } finally {
      setIsSharing(false);
    }
  };

  React.useLayoutEffect(() => {
    if (!pass) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={generateAndSharePDF} disabled={isSharing}>
          <Text style={{ color: isSharing ? colors.textMuted : colors.primary, fontSize: 16, fontWeight: '600' }}>
            {isSharing ? 'Sharing...' : 'Share'}
          </Text>
        </TouchableOpacity>
      ),
      headerStyle: {
        backgroundColor: colors.background,
      },
      headerTintColor: colors.text,
    });
  }, [navigation, pass, isSharing, colors]);

  if (!pass) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Pass not found.</Text>
      </View>
    );
  }

  const handleStatusUpdate = async (action: 'suspend' | 'revoke') => {
    try {
      await updatePassStatus(pass.id, action);
      alert(`Pass has been ${action === 'suspend' ? 'suspended' : 'revoked'}`);
      // ponytail: check if we can go back before trying
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to update pass status');
    }
  };

  const handleDelete = async () => {
    try {
      await deletePass(pass.id);
      alert('Pass has been deleted permanently.');
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to delete pass');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <View style={styles.badgeContainer}>
            <View style={[styles.badgeSuccess, { backgroundColor: isDarkMode ? '#262626' : pass.color + '20' }]}>
              {pass.status === 'Active' && <View style={[styles.dot, { backgroundColor: pass.color }]} />}
              <Text style={[styles.badgeSuccessText, { color: isDarkMode ? colors.text : pass.color }]}>{pass.status}</Text>
            </View>
          </View>

          <Text style={styles.name}>{pass.name}</Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={pass.qrPayload || pass.id}
              size={200}
              color="#000000"
              backgroundColor="#FFFFFF"
            />
            {/* Logo overlay on QR mock */}
            <View style={styles.qrLogo}>
              <Text style={{ fontSize: 20 }}>🏢</Text>
            </View>
          </View>

          <Text style={styles.qrSubtitle}>Show at gate • HMAC signed</Text>
          <Text style={styles.validText}>{pass.time}</Text>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Purpose</Text>
            <Text style={styles.detailValue}>{pass.purpose}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Entry gate</Text>
            <Text style={styles.detailValue}>{pass.gate || 'Main Gate'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>{pass.phone || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{pass.created}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Used</Text>
            <Text style={styles.detailValue}>0 times</Text>
          </View>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        {pass.status === 'Active' && (
          <TouchableOpacity style={styles.suspendButton} onPress={() => handleStatusUpdate('suspend')}>
            <Text style={styles.suspendButtonText}>⏸ Suspend</Text>
          </TouchableOpacity>
        )}
        {(pass.status === 'Suspended' || pass.status === 'Expired') && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>🗑 Delete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.revokeButton} onPress={() => handleStatusUpdate('revoke')}>
          <Text style={styles.revokeButtonText}>✕ Revoke</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100, // Extra space to force scrolling on Android
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: roundness.xl,
    padding: spacing.xl,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
    alignItems: 'center' as const,
  },
  badgeContainer: {
    width: '100%' as const,
    alignItems: 'flex-start' as const,
    marginBottom: spacing.md,
  },
  badgeSuccess: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: roundness.full,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeSuccessText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  name: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.extrabold,
    color: colors.text,
    marginBottom: spacing.xl,
    textAlign: 'center' as const,
  },
  qrContainer: {
    padding: spacing.lg,
    backgroundColor: '#FFFFFF', // Keep QR white background even in dark mode for scanning
    borderRadius: roundness.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: spacing.lg,
    position: 'relative' as const,
  },
  qrLogo: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 8,
  },
  qrSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  validText: {
    fontSize: typography.sizes.md,
    color: colors.success,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xl,
  },
  divider: {
    width: '100%' as const,
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.xl,
  },
  detailRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    width: '100%' as const,
    marginBottom: spacing.lg,
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  footer: {
    flexDirection: 'row' as const,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suspendButton: {
    flex: 1,
    padding: 16,
    borderRadius: roundness.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: 'center' as const,
    marginRight: spacing.sm,
  },
  suspendButtonText: {
    color: colors.warning,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  revokeButton: {
    flex: 1,
    padding: 16,
    borderRadius: roundness.lg,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.dangerLight,
    backgroundColor: isDarkMode ? '#450a0a' : colors.dangerLight,
    alignItems: 'center' as const,
    marginLeft: spacing.sm,
  },
  revokeButtonText: {
    color: colors.danger,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  deleteButton: {
    flex: 1,
    padding: 16,
    borderRadius: roundness.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center' as const,
    marginRight: spacing.sm,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
