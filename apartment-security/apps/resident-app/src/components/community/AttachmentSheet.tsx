import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export type AttachmentAction = 'gallery' | 'camera' | 'document' | 'poll';

const ITEMS: { key: AttachmentAction; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'gallery', label: 'Photo & Video', icon: 'images', color: '#8B5CF6' },
  { key: 'camera', label: 'Camera', icon: 'camera', color: colors.danger },
  { key: 'document', label: 'Document', icon: 'document-text', color: '#2563EB' },
  { key: 'poll', label: 'Poll', icon: 'stats-chart', color: colors.success },
];

export default function AttachmentSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: AttachmentAction) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.grid}>
            {ITEMS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.item}
                onPress={() => {
                  onSelect(item.key);
                  onClose();
                }}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={22} color={colors.white} />
                </View>
                <Text style={styles.itemLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 18,
  },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { alignItems: 'center', width: '23%' },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemLabel: { fontSize: 12, color: colors.text, textAlign: 'center' },
});
