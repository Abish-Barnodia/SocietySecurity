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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import { testGateNotificationWithRingtone } from '../../utils/notifications';

export const NOTIFICATION_ONBOARDING_KEY = '@resident_has_seen_notification_prompt';

const { width } = Dimensions.get('window');

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

  // Audio player for playing the loud gate ringtone live
  const ringAudio = require('../../../assets/visitor_ring.wav');
  const player = useAudioPlayer(ringAudio);

  // Pulse animation for sound waves
  const waveAnim1 = useRef(new Animated.Value(1)).current;
  const waveAnim2 = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

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

  const handleFinish = async () => {
    try {
      player.pause();
    } catch {}
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
    setTestSuccess(false);

    try {
      // 1. Start loud audio playback so resident hears ringtone immediately
      try {
        player.seekTo(0);
        player.play();
      } catch (e) {
        console.log('Audio playback note:', e);
      }

      startWaveAnimation();

      // 2. Trigger OS notification with MAX importance, vibration & approve/deny
      await testGateNotificationWithRingtone();
      setTestSuccess(true);
    } catch (error) {
      console.log('Test notification error:', error);
    } finally {
      setTimeout(() => {
        setTesting(false);
      }, 4000);
    }
  };

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
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
          <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
          <Text style={styles.successBannerText}>
            Loud ringtone & visitor alert sent!
          </Text>
        </View>
      )}

      {/* Bottom Action Area */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.testButton, testing && styles.testButtonActive]}
          onPress={handleTestNotification}
          activeOpacity={0.85}
        >
          {testing ? (
            <View style={styles.testingRow}>
              <ActivityIndicator size="small" color="#0F172A" />
              <Text style={styles.testButtonText}>Ringing & Testing...</Text>
            </View>
          ) : (
            <Text style={styles.testButtonText}>
              {testSuccess ? 'Test Again 🔔' : 'Test Notifications'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleFinish}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>
            {testSuccess ? 'Continue to App →' : 'Skip for now >'}
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803D',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  testButton: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFD900',
    paddingVertical: 17,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD900',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  testButtonActive: {
    backgroundColor: '#FFE347',
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
});
