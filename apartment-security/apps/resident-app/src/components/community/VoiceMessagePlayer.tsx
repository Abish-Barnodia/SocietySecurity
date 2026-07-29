import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors } from '../../theme/colors';

const formatDuration = (sec: number) => {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function VoiceMessagePlayer({
  uri,
  fallbackDurationSec,
  tint,
}: {
  uri: string;
  fallbackDurationSec?: number;
  tint?: string;
}) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const duration = status.duration || fallbackDurationSec || 0;
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const accent = tint ?? colors.primary;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.playButton}
        onPress={() => (status.playing ? player.pause() : player.play())}
      >
        <Ionicons name={status.playing ? 'pause' : 'play'} size={16} color={accent} />
      </TouchableOpacity>
      <View style={styles.track}>
        <View style={[styles.progress, { width: `${progress * 100}%`, backgroundColor: accent }]} />
      </View>
      <Text style={styles.duration}>
        {formatDuration(status.currentTime > 0 ? status.currentTime : duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minWidth: 190 },
  playButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  track: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  progress: { height: 4, borderRadius: 2 },
  duration: { marginLeft: 8, fontSize: 12, color: colors.textMuted, minWidth: 34 },
});
