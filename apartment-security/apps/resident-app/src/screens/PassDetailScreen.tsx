import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

type RoutePropType = RouteProp<RootStackParamList, 'PassDetail'>;

export default function PassDetailScreen({ navigation, route }: { navigation: any, route: RoutePropType }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { passId } = route.params;
  const { passes, suspendPass, revokePass } = useData();
  const { userProfile } = useAuth();
  const [isSharing, setIsSharing] = React.useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  const pass = passes.find(p => p.id === passId);
  const propertyName = userProfile?.propertyName || 'the property';

  const generateAndSharePDF = async () => {
    if (!pass || isSharing) return;
    setIsSharing(true);
    
    const qrData = JSON.stringify({
      id: pass.id,
      name: pass.name,
      type: pass.type,
      purpose: pass.purpose,
      time: pass.time,
      phone: pass.phone || 'N/A',
      gate: pass.gate || 'Main Gate'
    });

    try {
      const html = `
        <html>
          <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc;">
            <div style="background-color: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 80%; max-width: 400px; text-align: center;">
              <h1 style="color: #0f172a; margin-bottom: 5px; font-size: 32px;">${pass.name}</h1>
              <p style="color: #64748b; font-size: 18px; margin-top: 0;">${pass.purpose}</p>
              
              <div style="margin: 40px 0;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}" width="250" height="250" />
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
      const { base64 } = await Print.printToFileAsync({ html, base64: true });
      
      const safeFilename = `VisitorPass_${pass.id.substring(pass.id.length - 8)}.pdf`;
      const newUri = FileSystem.documentDirectory + safeFilename;
      
      await FileSystem.writeAsStringAsync(newUri, base64 || '', {
        encoding: FileSystem.EncodingType.Base64
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Visitor Pass',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Sharing is not available on your device');
      }
    } catch (error) {
      Alert.alert('Error', 'Error sharing pass as PDF');
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
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* User Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.userInfoRow}>
            <View style={styles.userIconBg}>
              <Text style={styles.userIcon}>👤</Text>
            </View>
            <View>
              <Text style={styles.name}>{pass.name}</Text>
              <Text style={styles.phoneText}>{pass.phone || 'No phone on file'}</Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Purpose</Text>
              <Text style={styles.gridValue}>{pass.purpose}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Date</Text>
              <Text style={styles.gridValue}>{pass.created}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Time</Text>
              <Text style={styles.gridValue}>{pass.time}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Gate</Text>
              <Text style={styles.gridValue}>{pass.gate || 'Main Gate'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{pass.status.toUpperCase()}</Text>

        {/* QR Code Card */}
        <View style={styles.qrCard}>
          <View style={styles.qrCodeWrapper}>
            <QRCode
              value={JSON.stringify({
                id: pass.id,
                name: pass.name,
                type: pass.type,
                purpose: pass.purpose,
                time: pass.time,
                phone: pass.phone || 'N/A',
                gate: pass.gate || 'Main Gate'
              })}
              size={200}
              color={colors.text}
              backgroundColor="white"
            />
          </View>

          <Text style={styles.passIdText}>{getPassCode()}</Text>
          <Text style={styles.qrSubtitle}>Show this QR code at the gate</Text>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.primaryActionBtn} onPress={generateAndSharePDF}>
          <Text style={styles.primaryActionText}>📤 Share Pass PDF</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.secondaryActionBtn} onPress={shareViaSMS}>
          <Text style={styles.secondaryActionText}>Share via SMS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryActionBtn} onPress={copyPassCode}>
          <Text style={styles.secondaryActionText}>Share Pass Code</Text>
        </TouchableOpacity>

        {pass.status === 'Active' && (
          <TouchableOpacity
            style={[styles.secondaryActionBtn, { opacity: isUpdatingStatus ? 0.6 : 1 }]}
            onPress={() => handleStatusUpdate('Suspended')}
            disabled={isUpdatingStatus}
          >
            <Text style={styles.secondaryActionText}>Suspend Pass</Text>
          </TouchableOpacity>
        )}
        {(pass.status === 'Active' || pass.status === 'Suspended') && (
          <TouchableOpacity
            style={[styles.secondaryActionBtn, { opacity: isUpdatingStatus ? 0.6 : 1 }]}
            onPress={() => handleStatusUpdate('Expired')}
            disabled={isUpdatingStatus}
          >
            <Text style={[styles.secondaryActionText, { color: colors.danger }]}>Revoke Pass</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  userIconBg: {
    width: 56,
    height: 56,
    backgroundColor: '#EBEBEB',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userIcon: {
    fontSize: 28,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  phoneText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 16,
  },
  gridLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 16,
  },
  qrCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: 24,
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  passIdText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    letterSpacing: 2,
  },
  qrSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  primaryActionBtn: {
    backgroundColor: '#B67318',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryActionText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActionBtn: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
