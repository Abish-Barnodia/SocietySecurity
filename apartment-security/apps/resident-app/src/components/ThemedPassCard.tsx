import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Image } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export interface ThemedPassProps {
  themeId?: string;
  visitorName: string;
  residentName: string;
  unitName: string;
  propertyName?: string;
  validTimeWindow: string;
  passCode: string;
  qrPayload: string;
  note?: string;
}

const THEME_IMAGES: Record<string, any> = {
  home: require('../../assets/themes/home.jpg'),
  party: require('../../assets/themes/party.jpg'),
  balloons: require('../../assets/themes/balloons.jpg'),
  formal: require('../../assets/themes/home.jpg'),
  games: require('../../assets/themes/party.jpg'),
  help: require('../../assets/themes/home.jpg'),
  delivery: require('../../assets/themes/home.jpg'),
  cab: require('../../assets/themes/home.jpg'),
};

const THEME_LABELS: Record<string, { emoji: string; title: string }> = {
  home: { emoji: '🏠', title: "You're Invited" },
  party: { emoji: '🍷', title: 'Dinner & Celebrations' },
  balloons: { emoji: '🎈', title: 'Party & Celebration' },
  formal: { emoji: '💼', title: 'Scheduled Meeting' },
  games: { emoji: '🎮', title: 'Game Night' },
  help: { emoji: '🛠️', title: 'Visiting Help' },
  delivery: { emoji: '🛵', title: 'Delivery Entry' },
  cab: { emoji: '🚗', title: 'Cab Entry' },
};

export const ThemedPassCard = React.forwardRef<View, ThemedPassProps>(
  (
    {
      themeId = 'home',
      visitorName,
      residentName,
      unitName,
      propertyName = 'Greenfield Heights',
      validTimeWindow,
      passCode,
      qrPayload,
      note,
    },
    ref
  ) => {
    const bgImage = THEME_IMAGES[themeId] || THEME_IMAGES.home;
    const label = THEME_LABELS[themeId] || THEME_LABELS.home;

    return (
      <View ref={ref} collapsable={false} style={styles.cardContainer}>
        <ImageBackground
          source={bgImage}
          style={styles.bgImage}
          imageStyle={styles.bgImageStyle}
          resizeMode="cover"
        >
          {/* Dark luxury overlay for readability */}
          <View style={styles.overlay}>
            {/* Top Fairy Lights / Header Decor */}
            <View style={styles.lightsRow}>
              <View style={styles.lightDot} />
              <View style={[styles.lightDot, { backgroundColor: '#FDBA74' }]} />
              <View style={styles.lightDot} />
              <View style={[styles.lightDot, { backgroundColor: '#FDBA74' }]} />
              <View style={styles.lightDot} />
            </View>

            {/* Header Calligraphy & Emblem */}
            <View style={styles.headerBox}>
              <Text style={styles.emblemEmoji}>{label.emoji}</Text>
              <Text style={styles.invitedScriptTitle}>{label.title}</Text>
              <View style={styles.heartDivider}>
                <View style={styles.heartLine} />
                <Text style={styles.heartText}>♥</Text>
                <View style={styles.heartLine} />
              </View>
            </View>

            {/* Central Gold-Bordered QR Code Card */}
            <View style={styles.qrGoldFrame}>
              <View style={styles.qrWhiteBox}>
                {qrPayload ? (
                  <QRCode
                    value={qrPayload}
                    size={190}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                  />
                ) : (
                  <View style={{ width: 190, height: 190, backgroundColor: '#E2E8F0' }} />
                )}
              </View>

              {/* Passcode Badge */}
              <View style={styles.passcodeBadge}>
                <Text style={styles.passcodeText}>{passCode}</Text>
              </View>
            </View>

            {/* Details Glass Card */}
            <View style={styles.detailsGlassCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>GUEST</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {visitorName}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>HOST</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {residentName} ({unitName})
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>LOCATION</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {propertyName}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>VALID</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {validTimeWindow}
                </Text>
              </View>
            </View>

            {note ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>📝 Note: {note}</Text>
              </View>
            ) : null}

            {/* Fast-Track Gate Footer */}
            <View style={styles.footerBox}>
              <Text style={styles.footerText}>
                🛡️ <Text style={{ color: '#FACC15', fontWeight: '800' }}>Fast-Track Entry Pass</Text>
                {' • '}
                Show at security gate
              </Text>
            </View>
          </View>
        </ImageBackground>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  cardContainer: {
    width: 380,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#1C1917',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  bgImage: {
    width: '100%',
  },
  bgImageStyle: {
    borderRadius: 28,
  },
  overlay: {
    backgroundColor: 'rgba(12, 10, 9, 0.45)',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  lightsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  lightDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FDE047',
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 12,
  },
  emblemEmoji: {
    fontSize: 26,
    marginBottom: 2,
  },
  invitedScriptTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFBEB',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heartDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  heartLine: {
    width: 36,
    height: 1.5,
    backgroundColor: '#D4AF37',
  },
  heartText: {
    color: '#D4AF37',
    fontSize: 12,
  },
  qrGoldFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 3.5,
    borderColor: '#D4AF37',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  qrWhiteBox: {
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 12,
  },
  passcodeBadge: {
    marginTop: 10,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  passcodeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#78350F',
    letterSpacing: 3,
  },
  detailsGlassCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E4E4E7',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    maxWidth: '65%',
    textAlign: 'right',
  },
  noteBox: {
    width: '100%',
    backgroundColor: 'rgba(250, 204, 21, 0.15)',
    borderRadius: 12,
    padding: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.4)',
    marginBottom: 10,
  },
  noteText: {
    fontSize: 12,
    color: '#FEF08A',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footerBox: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerText: {
    fontSize: 11,
    color: '#E4E4E7',
    fontWeight: '600',
    textAlign: 'center',
  },
});
