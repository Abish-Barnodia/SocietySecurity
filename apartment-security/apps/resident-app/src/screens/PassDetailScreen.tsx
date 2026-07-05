import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme/colors';
import { useData } from '../context/DataContext';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

type RoutePropType = RouteProp<RootStackParamList, 'PassDetail'>;

export default function PassDetailScreen({ navigation, route }: { navigation: any, route: RoutePropType }) {
  const { passId } = route.params;
  const { passes, updatePassStatus } = useData();
  const [isSharing, setIsSharing] = React.useState(false);
  
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
              
              <div style="margin: 40px 0;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://apartment-security.com/pass/${pass.id}" width="250" height="250" />
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
    });
  }, [navigation, pass, isSharing]);

  if (!pass) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Pass not found.</Text>
      </View>
    );
  }

  const handleStatusUpdate = (status: 'Suspended' | 'Expired') => {
    updatePassStatus(pass.id, status);
    alert(`Pass has been ${status.toLowerCase()}`);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.card}>
          <View style={styles.badgeContainer}>
            <View style={[styles.badgeSuccess, { backgroundColor: pass.color + '20' }]}>
              {pass.status === 'Active' && <View style={[styles.dot, { backgroundColor: pass.color }]} />}
              <Text style={[styles.badgeSuccessText, { color: pass.color }]}>{pass.status}</Text>
            </View>
          </View>

          <Text style={styles.name}>{pass.name}</Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={`https://apartment-security.com/pass/${pass.id}`}
              size={200}
              color={colors.text}
              backgroundColor="white"
            />
            {/* Logo overlay on QR mock */}
            <View style={styles.qrLogo}>
              <Text style={{fontSize: 20}}>🏢</Text>
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
          <TouchableOpacity style={styles.suspendButton} onPress={() => handleStatusUpdate('Suspended')}>
            <Text style={styles.suspendButtonText}>⏸ Suspend</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.revokeButton} onPress={() => handleStatusUpdate('Expired')}>
          <Text style={styles.revokeButtonText}>✕ Revoke</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 400, // Extra space to force scrolling on Android
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  badgeContainer: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  badgeSuccessText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
    position: 'relative',
  },
  qrLogo: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    backgroundColor: colors.white,
    padding: 4,
    borderRadius: 8,
  },
  qrSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  validText: {
    fontSize: 16,
    color: colors.success,
    fontWeight: '600',
    marginBottom: 24,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suspendButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: 'center',
    marginRight: 8,
  },
  suspendButtonText: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: 'bold',
  },
  revokeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerLight,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    marginLeft: 8,
  },
  revokeButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
