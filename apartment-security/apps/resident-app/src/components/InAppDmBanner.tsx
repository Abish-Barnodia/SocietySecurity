import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../context/ThemeContext';
import { navigationRef } from '../navigation/navigationRef';

export interface IncomingDmPayload {
  id: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  senderUnit?: string;
  text?: string;
  mediaType?: 'IMAGE' | 'AUDIO' | 'FILE';
  mediaUri?: string;
  fileName?: string;
  createdAt: string;
}

export default function InAppDmBanner() {
  const socket = useSocket();
  const { userId } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [activeNotification, setActiveNotification] = useState<IncomingDmPayload | null>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setActiveNotification(null);
    });
  };

  useEffect(() => {
    if (!socket) return;

    const handleDm = (msg: IncomingDmPayload) => {
      // Don't show toast for messages sent by self
      if (msg.senderId === userId || msg.senderId === 'me') return;

      if (timerRef.current) clearTimeout(timerRef.current);
      setActiveNotification(msg);

      // Slide In
      Animated.spring(slideAnim, {
        toValue: insets.top + (Platform.OS === 'android' ? 12 : 6),
        useNativeDriver: true,
        bounciness: 6,
      }).start();

      // Auto dismiss after 6 seconds
      timerRef.current = setTimeout(() => {
        dismiss();
      }, 6000);
    };

    socket.on('dm:message', handleDm);
    return () => {
      socket.off('dm:message', handleDm);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [socket, userId, insets.top, slideAnim]);

  if (!activeNotification) return null;

  const handleOpenChat = () => {
    const payload = activeNotification;
    dismiss();
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate('ResidentChat', {
        initialPartnerId: payload.senderId,
        initialPartnerName: payload.senderName,
        initialPartnerUnit: payload.senderUnit,
      });
    }
  };

  const previewText = activeNotification.text
    ? activeNotification.text
    : activeNotification.mediaType === 'IMAGE'
    ? '📷 Sent a photo'
    : activeNotification.mediaType === 'AUDIO'
    ? '🎤 Sent a voice note'
    : activeNotification.mediaType === 'FILE'
    ? `📄 ${activeNotification.fileName || 'Sent a file'}`
    : 'Sent a personal message';

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          borderColor: isDark ? '#334155' : '#e2e8f0',
        },
      ]}
    >
      <TouchableOpacity
        style={styles.bannerInner}
        activeOpacity={0.88}
        onPress={handleOpenChat}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#ffffff" />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.senderRow}>
            <Text style={[styles.senderName, { color: colors.text }]} numberOfLines={1}>
              {activeNotification.senderName || 'Resident'}
            </Text>
            {activeNotification.senderUnit && (
              <Text style={[styles.senderUnit, { color: colors.primary }]} numberOfLines={1}>
                {activeNotification.senderUnit}
              </Text>
            )}
          </View>
          <Text style={[styles.previewText, { color: colors.textMuted }]} numberOfLines={1}>
            {previewText}
          </Text>
        </View>

        <TouchableOpacity style={styles.replyButton} onPress={handleOpenChat}>
          <Text style={styles.replyButtonText}>Reply</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeButton} onPress={dismiss}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    zIndex: 9999,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  bannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '700',
  },
  senderUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewText: {
    fontSize: 13,
  },
  replyButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  replyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
});
