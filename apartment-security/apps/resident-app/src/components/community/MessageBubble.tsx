import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { colors } from '../../theme/colors';
import { ChatMessage, useCommunity } from '../../context/CommunityContext';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import PollCard from './PollCard';

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const renderBodyWithMentions = (body: string, isMine: boolean) => {
  const parts = body.split(/(@[A-Za-z][A-Za-z0-9_]*)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <Text key={i} style={[styles.mention, isMine && styles.mentionMine]}>
        {part}
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    )
  );
};

export default function MessageBubble({
  message,
  onPress,
  onDoublePress,
}: {
  message: ChatMessage;
  onPress: () => void;
  onDoublePress?: () => void;
}) {
  const { toggleReaction } = useCommunity();
  const [imageOpen, setImageOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const reactionCounts = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  const lastPressRef = React.useRef(0);
  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastPressRef.current < DOUBLE_PRESS_DELAY) {
      onDoublePress?.();
      lastPressRef.current = 0; // Reset
    } else {
      lastPressRef.current = now;
      setTimeout(() => {
        if (lastPressRef.current === now) {
          onPress?.();
        }
      }, DOUBLE_PRESS_DELAY);
    }
  };

  return (
    <View style={[styles.wrapper, message.isMine ? styles.wrapperMine : styles.wrapperTheirs]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={[styles.bubble, message.isMine ? styles.bubbleMine : styles.bubbleTheirs]}
      >
        {!message.isMine && (
          <Text style={styles.senderName}>
            {message.senderName}
            {message.senderUnit ? ` · ${message.senderUnit}` : ''}
          </Text>
        )}

        {message.replyTo && (
          <View style={styles.replyBox}>
            <Text style={styles.replySender}>{message.replyTo.senderName}</Text>
            <Text style={styles.replyBody} numberOfLines={1}>
              {message.replyTo.type === 'TEXT' ? message.replyTo.body ?? '' : `📎 ${message.replyTo.type}`}
            </Text>
          </View>
        )}

        {message.type === 'TEXT' && !!message.body && (
          <Text style={[styles.bodyText, message.isMine && styles.bodyTextMine]}>
            {renderBodyWithMentions(message.body, !!message.isMine)}
          </Text>
        )}

        {message.type === 'IMAGE' && !!message.mediaUrl && (
          <TouchableOpacity onPress={() => setImageOpen(true)}>
            <Image source={{ uri: message.mediaUrl }} style={styles.mediaThumb} resizeMode="cover" />
          </TouchableOpacity>
        )}

        {message.type === 'VIDEO' && !!message.mediaUrl && (
          <TouchableOpacity onPress={() => setVideoOpen(true)} style={styles.videoThumbWrap}>
            <View style={[styles.mediaThumb, styles.videoPoster]} />
            <View style={styles.playOverlay}>
              <Ionicons name="play" size={26} color={colors.white} />
            </View>
          </TouchableOpacity>
        )}

        {message.type === 'FILE' && !!message.mediaUrl && (
          <TouchableOpacity style={styles.fileRow} onPress={() => Linking.openURL(message.mediaUrl!)}>
            <Ionicons name="document-text" size={28} color={colors.primary} />
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {message.fileName ?? 'File'}
              </Text>
              <Text style={styles.fileSize}>{formatFileSize(message.fileSizeBytes)}</Text>
            </View>
          </TouchableOpacity>
        )}

        {message.type === 'AUDIO' && !!message.mediaUrl && (
          <VoiceMessagePlayer
            uri={message.mediaUrl}
            fallbackDurationSec={message.mediaDurationSec}
            tint={message.isMine ? colors.primaryDark : colors.primary}
          />
        )}

        {message.type === 'POLL' && message.poll && (
          <PollCard poll={message.poll} tint={message.isMine ? colors.primaryDark : colors.primary} />
        )}

        <Text style={[styles.timestamp, message.isMine && styles.timestampMine]}>{formatTime(message.createdAt)}</Text>
      </TouchableOpacity>

      {Object.keys(reactionCounts).length > 0 && (
        <View style={[styles.reactionRow, message.isMine && styles.reactionRowMine]}>
          {Object.entries(reactionCounts).map(([emoji, count]) => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionPill}
              onPress={() => toggleReaction(message.id, emoji)}
            >
              <Text style={styles.reactionText}>
                {emoji}
                {count > 1 ? ` ${count}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {message.mediaUrl && (
        <Modal visible={imageOpen} transparent animationType="fade" onRequestClose={() => setImageOpen(false)}>
          <TouchableOpacity style={styles.imageModalBackdrop} activeOpacity={1} onPress={() => setImageOpen(false)}>
            <Image source={{ uri: message.mediaUrl }} style={styles.imageModalFull} resizeMode="contain" />
          </TouchableOpacity>
        </Modal>
      )}

      {videoOpen && !!message.mediaUrl && (
        <FullScreenVideoModal uri={message.mediaUrl} onClose={() => setVideoOpen(false)} />
      )}
    </View>
  );
}

function FullScreenVideoModal({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.videoModalContainer}>
        <TouchableOpacity style={styles.videoModalClose} onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.white} />
        </TouchableOpacity>
        <VideoView style={styles.videoModalPlayer} player={player} nativeControls contentFit="contain" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 4, paddingHorizontal: 10 },
  wrapperMine: { alignItems: 'flex-end' },
  wrapperTheirs: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: { backgroundColor: colors.primaryLight, borderTopRightRadius: 2 },
  bubbleTheirs: { backgroundColor: colors.white, borderTopLeftRadius: 2, borderWidth: 1, borderColor: colors.border },
  senderName: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 3 },
  replyBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  replySender: { fontSize: 12, fontWeight: '700', color: colors.primary },
  replyBody: { fontSize: 12, color: colors.textMuted },
  bodyText: { fontSize: 15, color: colors.text, lineHeight: 20 },
  bodyTextMine: { color: colors.text },
  mention: { color: colors.primary, fontWeight: '700' },
  mentionMine: { color: colors.primaryDark },
  timestamp: { fontSize: 10, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 4 },
  timestampMine: { color: colors.primaryDark },
  mediaThumb: { width: 210, height: 160, borderRadius: 10, backgroundColor: colors.border },
  videoThumbWrap: { justifyContent: 'center', alignItems: 'center' },
  videoPoster: { backgroundColor: '#1C1917' },
  playOverlay: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', minWidth: 200, maxWidth: 240 },
  fileInfo: { marginLeft: 10, flexShrink: 1 },
  fileName: { fontSize: 14, color: colors.text, fontWeight: '600' },
  fileSize: { fontSize: 12, color: colors.textMuted },
  reactionRow: { flexDirection: 'row', marginTop: 4, flexWrap: 'wrap' },
  reactionRowMine: { justifyContent: 'flex-end' },
  reactionPill: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
    marginTop: 2,
  },
  reactionText: { fontSize: 12, color: colors.text },
  imageModalBackdrop: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  imageModalFull: { width: '100%', height: '100%' },
  videoModalContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  videoModalClose: { position: 'absolute', top: 48, right: 20, zIndex: 1, padding: 8 },
  videoModalPlayer: { width: '100%', height: '100%' },
});
