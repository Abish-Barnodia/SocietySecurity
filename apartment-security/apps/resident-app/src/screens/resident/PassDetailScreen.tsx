import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { useAuth } from '@apartment-security/shared-auth';
import { shareQrAsImage, detectThemeFromPass, THEME_CONFIGS } from '../../utils/shareQrPass';
import { ThemedPassCard } from '../../components/ThemedPassCard';
import { captureRef } from 'react-native-view-shot';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';

type RoutePropType = RouteProp<RootStackParamList, 'PassDetail'>;

export default function PassDetailScreen({ navigation, route }: { navigation: any, route: RoutePropType }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { passId } = route.params;
  const { passes, entries, suspendPass, revokePass } = useData();
  const { userProfile } = useAuth();
  const [isSharing, setIsSharing] = React.useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const passCardRef = React.useRef<View>(null);

  const pass = passes.find(p => p.id === passId);
  const propertyName = userProfile?.propertyName || 'Greenfield Heights';
  const themeKey = pass ? detectThemeFromPass({ purpose: pass.purpose, type: pass.type }) : 'home';
  const theme = THEME_CONFIGS[themeKey] || THEME_CONFIGS.home;

  const relatedEntry = entries.find(e => e.passId === pass?.id || (pass && e.name === pass.name && e.date === 'TODAY'));
  const isInside = relatedEntry?.status === 'Entered';
  const isExited = relatedEntry?.status === 'Exited';

  const shareThemedCard = async () => {
    if (!pass || isSharing) return;
    if (!pass.qrPayload) {
      Alert.alert('QR unavailable', 'This pass has no scannable QR code to share.');
      return;
    }
    setIsSharing(true);

    try {
      if (passCardRef.current) {
        const uri = await captureRef(passCardRef, {
          format: 'png',
          quality: 1.0,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `Share ${theme.name} Visitor Pass`,
          });
          return;
        }
      }
      
      // Fallback
      await shareQrAsImage(pass.qrPayload, pass.id.substring(pass.id.length - 8), {
        visitorName: pass.name,
        residentName: userProfile?.name || 'Resident',
        purpose: pass.purpose,
        passType: pass.type,
        greeting: `${userProfile?.name || 'Resident'} has invited you.`,
        validTimeWindow: pass.time || 'Valid Today',
        passCode: getPassCode(),
        propertyName: propertyName,
        unitName: (userProfile as any)?.unit || 'Flat 402',
      });
    } catch {
      Alert.alert('Error', 'Error sharing themed visitor pass');
    } finally {
      setIsSharing(false);
    }
  };

  const generateAndSharePDF = shareThemedCard;
  const shareViaWhatsApp = shareThemedCard;

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
    });
  }, [navigation, pass, isSharing]);

  if (!pass) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Pass not found.</Text>
      </View>
    );
  }

  const handleStatusUpdate = async (status: 'Suspended' | 'Expired') => {
    setIsUpdatingStatus(true);
    try {
      if (status === 'Suspended') {
        await suspendPass(pass.id);
      } else {
        await revokePass(pass.id);
      }
      Alert.alert('Success', `Pass has been ${status.toLowerCase()}.`);
      navigation.goBack();
    } catch {
      Alert.alert('Error', `Failed to ${status === 'Suspended' ? 'suspend' : 'revoke'} pass. Please try again.`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getPassCode = () => `PASS-${pass.id.substring(pass.id.length - 8).toUpperCase()}`;

  const shareViaSMS = async () => {
    const message = `Hello ${pass.name}, your visitor pass for ${propertyName} is: ${getPassCode()}`;
    const phoneNum = pass.phone ? pass.phone.replace(/\D/g, '') : '';
    const url = `sms:${phoneNum}?body=${encodeURIComponent(message)}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('SMS is not available.');
      }
    } catch {
      Alert.alert('Could not open SMS app');
    }
  };



  const shareViaEmail = async () => {
    const subject = `Visitor Pass - ${pass.name}`;
    const body = `Hello ${pass.name},\n\nYour visitor pass for ${propertyName} is: ${getPassCode()}.\nValid: ${pass.time}.\nGate: ${pass.gate || 'Any gate'}\n\nPlease show your pass code or QR at the gate.`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('No email app is available.');
      }
    } catch {
      Alert.alert('Could not open email app');
    }
  };

  const copyPassCode = async () => {
    try {
      await Share.share({
        message: getPassCode(),
      });
    } catch {
      Alert.alert('Could not share pass code');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Themed Occasion Header & Info Card */}
        <View style={styles.infoCard}>
          {/* Occasion Banner */}
          <View style={[styles.themePillBadge, { backgroundColor: theme.bannerColor }]}>
            <Text style={styles.themePillText}>{theme.emoji} {theme.tagline}</Text>
          </View>

          <View style={styles.userInfoRow}>
            <View style={styles.quickActionIconBox}>
              <Ionicons name="person-outline" size={24} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{pass.name}</Text>
              <Text style={styles.phoneText}>{pass.phone || 'Pre-approved Pass'}</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                pass.status === 'Active' && styles.statusPillActive,
                pass.status === 'Suspended' && styles.statusPillSuspended,
                pass.status === 'Expired' && styles.statusPillExpired,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  pass.status === 'Active' && styles.statusTextActive,
                  pass.status === 'Suspended' && styles.statusTextSuspended,
                  pass.status === 'Expired' && styles.statusTextExpired,
                ]}
              >
                {pass.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Purpose</Text>
              <Text style={styles.gridValue}>{pass.purpose || pass.type}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Date</Text>
              <Text style={styles.gridValue}>{pass.created || 'Today'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Time Window</Text>
              <Text style={styles.gridValue}>{pass.time || '12:00 AM - 11:59 PM'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Allowed Gate</Text>
              <Text style={styles.gridValue}>{pass.gate || 'All Gates'}</Text>
            </View>
          </View>
        </View>

        {/* QR Code Card with 2-Scan Progress */}
        <View style={styles.qrCard}>
          <View style={styles.qrCodeWrapper}>
            {pass.qrPayload ? (
              <QRCode
                value={pass.qrPayload}
                size={180}
                color="#000000"
                backgroundColor="#ffffff"
              />
            ) : (
              <Text style={styles.qrSubtitle}>QR unavailable for this pass</Text>
            )}
          </View>

          <Text style={styles.passIdText}>{getPassCode()}</Text>
          <Text style={styles.qrSubtitle}>2-Way Pass: Scan at entry gate & exit gate</Text>

          {/* 2-Phase Scan Progress Tracker */}
          <View style={styles.scanTrackerBox}>
            <View style={styles.scanStepRow}>
              <View style={[styles.scanStepDot, (isInside || isExited) && styles.scanStepDotDone]}>
                <Ionicons
                  name={(isInside || isExited) ? "checkmark" : "log-in-outline"}
                  size={12}
                  color={(isInside || isExited) ? "#ffffff" : colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scanStepTitle}>Scan 1 • Entry Check-in</Text>
                <Text style={styles.scanStepSub}>
                  {isInside || isExited
                    ? `Completed at ${relatedEntry?.time || 'Gate'} (Timer started)`
                    : 'Pending scan at entry barrier'}
                </Text>
              </View>
            </View>

            <View style={styles.scanStepDivider} />

            <View style={styles.scanStepRow}>
              <View style={[styles.scanStepDot, isExited && styles.scanStepDotDone]}>
                <Ionicons
                  name={isExited ? "checkmark" : "log-out-outline"}
                  size={12}
                  color={isExited ? "#ffffff" : colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scanStepTitle}>Scan 2 • Exit & Pass Expiry</Text>
                <Text style={styles.scanStepSub}>
                  {isExited
                    ? `Completed • Exited at ${new Date(relatedEntry!.exitAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : isInside
                    ? 'Awaiting visitor exit scan (Timer active)'
                    : 'Pending scan when leaving building'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons with Monochrome Icons */}
        <TouchableOpacity style={styles.primaryActionBtn} onPress={generateAndSharePDF} activeOpacity={0.85}>
          <Ionicons name="share-social-outline" size={18} color={isDark ? '#0f172a' : '#ffffff'} style={{ marginRight: 8 }} />
          <Text style={styles.primaryActionText}>Share Themed Pass Card</Text>
        </TouchableOpacity>

        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.secondaryActionBtn} onPress={shareViaWhatsApp} activeOpacity={0.8}>
            <Ionicons name="logo-whatsapp" size={16} color={colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.secondaryActionText}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryActionBtn} onPress={shareViaSMS} activeOpacity={0.8}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.secondaryActionText}>SMS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryActionBtn} onPress={shareViaEmail} activeOpacity={0.8}>
            <Ionicons name="mail-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.secondaryActionText}>Email</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryActionBtn} onPress={copyPassCode} activeOpacity={0.8}>
            <Ionicons name="copy-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.secondaryActionText}>Copy Code</Text>
          </TouchableOpacity>
        </View>

        {pass.status === 'Active' && (
          <TouchableOpacity
            style={[styles.statusToggleBtn, { opacity: isUpdatingStatus ? 0.6 : 1 }]}
            onPress={() => handleStatusUpdate('Suspended')}
            disabled={isUpdatingStatus}
            activeOpacity={0.8}
          >
            <Ionicons name="pause-circle-outline" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.statusToggleBtnText}>Pause / Suspend Pass</Text>
          </TouchableOpacity>
        )}

        {(pass.status === 'Active' || pass.status === 'Suspended') && (
          <TouchableOpacity
            style={[styles.revokeBtn, { opacity: isUpdatingStatus ? 0.6 : 1 }]}
            onPress={() => handleStatusUpdate('Expired')}
            disabled={isUpdatingStatus}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color="#dc2626" style={{ marginRight: 6 }} />
            <Text style={styles.revokeBtnText}>Cancel / Revoke Pass</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Offscreen Themed Pass Card for Instant Native Image Capture */}
      <View
        style={{
          position: 'absolute',
          top: -9999,
          left: -9999,
          opacity: 1,
        }}
        pointerEvents="none"
      >
        <ThemedPassCard
          ref={passCardRef}
          themeId={themeKey}
          visitorName={pass.name}
          residentName={userProfile?.name || 'Resident'}
          unitName={(userProfile as any)?.unit || 'Flat 402'}
          propertyName={propertyName}
          validTimeWindow={pass.time || 'Valid Today'}
          passCode={getPassCode()}
          qrPayload={pass.qrPayload || ''}
          note={pass.purpose}
        />
      </View>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f172a' : '#f5f3ef',
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 40,
    },
    infoCard: {
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
    themePillBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 12,
    },
    themePillText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '800',
    },
    userInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    quickActionIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    name: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 2,
    },
    phoneText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    statusPillActive: {
      backgroundColor: '#f0fdf4',
      borderColor: '#bbf7d0',
    },
    statusPillSuspended: {
      backgroundColor: '#fefce8',
      borderColor: '#fef08a',
    },
    statusPillExpired: {
      backgroundColor: '#f1f5f9',
      borderColor: '#e2e8f0',
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '800',
    },
    statusTextActive: {
      color: '#16a34a',
    },
    statusTextSuspended: {
      color: '#ca8a04',
    },
    statusTextExpired: {
      color: '#64748b',
    },
    detailsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#f1f5f9',
    },
    gridItem: {
      width: '48%',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    gridLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
      marginBottom: 2,
    },
    gridValue: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    qrCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    qrCodeWrapper: {
      padding: 12,
      backgroundColor: '#ffffff',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    passIdText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 1,
    },
    qrSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    scanTrackerBox: {
      width: '100%',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: 12,
      padding: 12,
      marginTop: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scanStepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    scanStepDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanStepDotDone: {
      backgroundColor: '#16a34a',
    },
    scanStepTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    scanStepSub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    scanStepDivider: {
      width: 2,
      height: 12,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      marginLeft: 11,
      marginVertical: 2,
    },
    primaryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      paddingVertical: 13,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    primaryActionText: {
      color: isDark ? '#0f172a' : '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 14,
    },
    secondaryActionBtn: {
      width: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      borderRadius: 12,
    },
    secondaryActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    statusToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      borderRadius: 12,
      marginBottom: 10,
    },
    statusToggleBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    revokeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#450a0a' : '#fef2f2',
      borderWidth: 1,
      borderColor: isDark ? '#7f1d1d' : '#fecaca',
      paddingVertical: 12,
      borderRadius: 12,
      marginBottom: 10,
    },
    revokeBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#dc2626',
    },
  });
