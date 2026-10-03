import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Dimensions,
  ActivityIndicator,
  Modal,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import { testGateNotificationWithRingtone } from '../../utils/notifications';

export const NOTIFICATION_ONBOARDING_KEY = '@resident_has_seen_notification_prompt';

const { width, height } = Dimensions.get('window');

interface NotificationSetupScreenProps {
  onComplete?: () => void;
  navigation?: any;
}

export default function NotificationSetupScreen({
  onComplete,
  navigation,
}: NotificationSetupScreenProps) {
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [showLiveCallModal, setShowLiveCallModal] = useState(false);
  const [lastAction, setLastAction] = useState<'APPROVED' | 'DENIED' | null>(null);

  // Audio player for playing the loud gate ringtone live
  const ringAudio = require('../../../assets/visitor_ring.wav');
  const player = useAudioPlayer(ringAudio);

  // Pulse animation for sound waves on main screen
  const waveAnim1 = useRef(new Animated.Value(1)).current;
  const waveAnim2 = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  // Pulse animation for the incoming visitor modal
  const modalPulseAnim = useRef(new Animated.Value(1)).current;

  const startWaveAnimation = () => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(waveAnim1, {
            toValue: 1.25,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim1, {
            toValue: 1,
            duration: 900,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(waveAnim2, {
            toValue: 1.45,
            duration: 1100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim2, {
            toValue: 1,
            duration: 1100,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(cardScale, {
            toValue: 1.03,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(cardScale, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  };

  const startModalPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(modalPulseAnim, {
          toValue: 1.15,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(modalPulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopAllRinging = () => {
    try {
      player.pause();
    } catch {}
    try {
      Vibration.cancel();
    } catch {}
    setTesting(false);
  };

  const handleFinish = async () => {
    stopAllRinging();
    await AsyncStorage.setItem(NOTIFICATION_ONBOARDING_KEY, 'true');
    if (onComplete) {
      onComplete();
    } else if (navigation?.canGoBack()) {
      navigation.goBack();
    } else if (navigation?.navigate) {
      navigation.navigate('MainTabs');
    }
  };

  const handleTestNotification = async () => {
    if (testing) return;
    setTesting(true);
    setShowLiveCallModal(true);
    startWaveAnimation();
    startModalPulse();

    try {
      // 1. Play loud visitor ring tone
      try {
        player.seekTo(0);
        player.play();
      } catch (e) {
        console.log('Audio playback note:', e);
      }

      // 2. Continuous pattern vibration
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 500, 200, 500], true);
      }

      // 3. Trigger OS native notification with high priority
      await testGateNotificationWithRingtone();
    } catch (error) {
      console.log('Test notification error:', error);
    }
  };

  const handleModalDecision = (decision: 'APPROVED' | 'DENIED') => {
    stopAllRinging();
    setShowLiveCallModal(false);
    setLastAction(decision);
    setTestSuccess(true);
  };

  useEffect(() => {
    return () => {
      stopAllRinging();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Close Button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={handleFinish}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      >
        <Ionicons name="close-outline" size={32} color="#1E293B" />
      </TouchableOpacity>

      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.title}>First things first</Text>
        <Text style={styles.subtitle}>
          Let's make sure you are receiving notifications
        </Text>
      </View>

      {/* Central Illustration / Calling Card with Sound Waves */}
      <View style={styles.illustrationArea}>
        {/* Concentric Outer Soundwaves */}
        <Animated.View
          style={[
            styles.waveRing,
            styles.waveOuter,
            { transform: [{ scale: waveAnim2 }], opacity: testing ? 0.7 : 0.25 },
          ]}
        />
        <Animated.View
          style={[
            styles.waveRing,
            styles.waveInner,
            { transform: [{ scale: waveAnim1 }], opacity: testing ? 0.9 : 0.4 },
          ]}
        />

        {/* Stacked Shadow Card behind */}
        <View style={styles.backgroundCard} />

        {/* Main Interactive Visitor Prompt Card */}
        <Animated.View
          style={[
            styles.visitorCard,
            { transform: [{ scale: cardScale }] },
            testing && styles.visitorCardRinging,
          ]}
        >
          {/* Avatar Icon */}
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={44} color="#94A3B8" />
          </View>

          <Text style={styles.cardHeader}>You have a</Text>
          <Text style={styles.cardTitle}>Visitor!</Text>

          {/* Approve / Deny Action Pill Mockups */}
          <View style={styles.actionPillApprove}>
            <Text style={styles.actionPillText}>Approve</Text>
          </View>

          <View style={styles.actionPillDeny}>
            <Text style={styles.actionPillText}>Deny</Text>
          </View>
        </Animated.View>
      </View>

      {/* Success Notification Banner when verified */}
      {testSuccess && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
          <Text style={styles.successBannerText}>
            {lastAction === 'APPROVED'
              ? 'Visitor Approved! Gate notification & loud ring verified 🎉'
              : 'Visitor Denied! Gate notification & loud ring verified 🎉'}
          </Text>
        </View>
      )}

      {/* Bottom Action Area */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.testButton, testSuccess && styles.testButtonSuccess]}
          onPress={testSuccess ? handleFinish : handleTestNotification}
          activeOpacity={0.85}
        >
          {testing ? (
            <View style={styles.testingRow}>
              <ActivityIndicator size="small" color="#0F172A" />
              <Text style={styles.testButtonText}>Ringing & Testing...</Text>
            </View>
          ) : (
            <Text style={styles.testButtonText}>
              {testSuccess ? 'Continue to App →' : 'Test Notifications'}
            </Text>
          )}
        </TouchableOpacity>

        {testSuccess ? (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleTestNotification}
            activeOpacity={0.7}
          >
            <Text style={styles.testAgainText}>Test Again 🔔</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleFinish}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip for now &gt;</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ========================================================= */}
      {/* REALISTIC INCOMING VISITOR LIVE GATE CALL MODAL OVERLAY */}
      {/* ========================================================= */}
      <Modal
        visible={showLiveCallModal}
        transparent
        animationType="slide"
        onRequestClose={() => handleModalDecision('DENIED')}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.callCardContainer}>
            {/* Live Indicator Header */}
            <View style={styles.callHeaderBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.callHeaderBadgeText}>LIVE GATE CALL - GATE #1</Text>
              <TouchableOpacity
                onPress={() => handleModalDecision('DENIED')}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Visitor Avatar with soundwaves */}
            <View style={styles.visitorAvatarWrapper}>
              <Animated.View
                style={[
                  styles.avatarPulseRing,
                  { transform: [{ scale: modalPulseAnim }] },
                ]}
              />
              <View style={styles.visitorAvatarBox}>
                <Ionicons name="cube" size={38} color="#0284C7" />
              </View>
            </View>

            <Text style={styles.visitorNameText}>Rohan Sharma</Text>
            <View style={styles.visitorTagPill}>
              <Ionicons name="bicycle-outline" size={14} color="#0369A1" style={{ marginRight: 4 }} />
              <Text style={styles.visitorTagText}>Delivery Partner (Amazon Express)</Text>
            </View>

            {/* Details Box */}
            <View style={styles.callInfoBox}>
              <View style={styles.callInfoRow}>
                <Text style={styles.callInfoLabel}>Destination</Text>
                <Text style={styles.callInfoVal}>Flat 103, Tower A</Text>
              </View>
              <View style={styles.callInfoDivider} />
              <View style={styles.callInfoRow}>
                <Text style={styles.callInfoLabel}>Vehicle</Text>
                <Text style={styles.callInfoVal}>KA-01-MJ-8821</Text>
              </View>
              <View style={styles.callInfoDivider} />
              <View style={styles.callInfoRow}>
                <Text style={styles.callInfoLabel}>Purpose</Text>
                <Text style={styles.callInfoVal}>Package Delivery</Text>
              </View>
            </View>

            {/* Audio Alert Status */}
            <View style={styles.ringingStatusRow}>
              <Ionicons name="volume-high" size={18} color="#EA580C" />
              <Text style={styles.ringingStatusText}>Loud Ringtone Playing...</Text>
            </View>

            {/* Approve / Deny Action Buttons */}
            <View style={styles.callActionRow}>
              <TouchableOpacity
                style={styles.denyCallBtn}
                onPress={() => handleModalDecision('DENIED')}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={22} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.denyCallText}>Deny Entry</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.approveCallBtn}
                onPress={() => handleModalDecision('APPROVED')}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.approveCallText}>Approve Entry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 32,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
    marginTop: 4,
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  illustrationArea: {
    width: width * 0.85,
    height: 330,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    position: 'relative',
  },
  waveRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#94A3B8',
  },
  waveOuter: {
    width: 290,
    height: 330,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderRadius: 145,
  },
  waveInner: {
    width: 250,
    height: 290,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderRadius: 125,
  },
  backgroundCard: {
    position: 'absolute',
    width: 175,
    height: 255,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    transform: [{ rotate: '-6deg' }, { translateY: -4 }],
  },
  visitorCard: {
    width: 180,
    height: 260,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  visitorCardRinging: {
    borderColor: '#00A67C',
    shadowColor: '#00A67C',
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  actionPillApprove: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionPillDeny: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
  },
  actionPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    marginBottom: 10,
    maxWidth: 340,
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803D',
    flex: 1,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  testButton: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFD200',
    paddingVertical: 17,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD200',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  testButtonSuccess: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  testingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testButtonText: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  testAgainText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0284C7',
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  callCardContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  callHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  callHeaderBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
    flex: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  visitorAvatarWrapper: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  avatarPulseRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#BAE6FD',
    opacity: 0.5,
  },
  visitorAvatarBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0F9FF',
    borderWidth: 2.5,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorNameText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
  },
  visitorTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  visitorTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  callInfoBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  callInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  callInfoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  callInfoVal: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  callInfoDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  ringingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  ringingStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EA580C',
  },
  callActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  denyCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  denyCallText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  approveCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  approveCallText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
