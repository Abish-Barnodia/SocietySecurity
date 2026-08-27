import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export type PreviewAsset = {
  uri: string;
  mimeType?: string;
  fileName?: string | null;
  isVideo: boolean;
};

// WhatsApp-style staging step: picking photos used to send each one
// immediately with no way to review or caption them first. This shows
// thumbnails of everything picked, lets the sender drop any of them before
// sending, and attaches one caption (to the last item) instead of firing
// them off silently.
export default function MediaPreviewModal({
  visible,
  assets,
  sending,
  onClose,
  onSend,
}: {
  visible: boolean;
  assets: PreviewAsset[];
  sending: boolean;
  onClose: () => void;
  onSend: (assets: PreviewAsset[], caption: string) => void;
}) {
  const [items, setItems] = useState<PreviewAsset[]>(assets);
  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (visible) {
      setItems(assets);
      setCaption('');
    }
  }, [visible, assets]);

  const removeAt = (index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) onClose();
      return next;
    });
  };

  if (items.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={26} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerCount}>{items.length} selected</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.mainPreview}>
          {items[0]?.isVideo ? (
            <View style={styles.videoPlaceholder}>
              <Ionicons name="videocam" size={48} color={colors.white} />
            </View>
          ) : (
            <Image source={{ uri: items[0]?.uri }} style={styles.mainImage} resizeMode="contain" />
          )}
        </View>

        {items.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
            {items.map((item, index) => (
              <View key={item.uri + index} style={styles.thumbWrap}>
                {item.isVideo ? (
                  <View style={[styles.thumb, styles.videoThumb]}>
                    <Ionicons name="videocam" size={18} color={colors.white} />
                  </View>
                ) : (
                  <Image source={{ uri: item.uri }} style={styles.thumb} />
                )}
                <TouchableOpacity style={styles.removeBadge} onPress={() => removeAt(index)}>
                  <Ionicons name="close" size={12} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={caption}
            onChangeText={setCaption}
          />
          <TouchableOpacity
            style={[styles.sendButton, sending && { opacity: 0.6 }]}
            onPress={() => onSend(items, caption)}
            disabled={sending}
          >
            <Ionicons name="send" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 48,
    paddingBottom: 12,
  },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCount: { color: colors.white, fontSize: 15, fontWeight: '600' },
  mainPreview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mainImage: { width: '100%', height: '100%' },
  videoPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  thumbRow: { maxHeight: 76, marginBottom: 8 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#222' },
  videoThumb: { alignItems: 'center', justifyContent: 'center' },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  captionInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
