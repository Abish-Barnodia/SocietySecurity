import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export type AttachmentAction = 'gallery' | 'camera' | 'document';

const ITEMS: { key: AttachmentAction; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'gallery', label: 'Photo & Video', icon: 'images', color: '#8B5CF6' },
  { key: 'camera', label: 'Camera', icon: 'camera', color: '#EF4444' },
  { key: 'document', label: 'Document', icon: 'document-text', color: '#2563EB' },
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
  const { colors, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: isDark ? '#475569' : '#cbd5e1' }]} />
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
                  <Ionicons name={item.icon} size={22} color="#ffffff" />
                </View>
                <Text style={[styles.itemLabel, { color: colors.text }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  grid: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  item: { alignItems: 'center', minWidth: 70 },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
