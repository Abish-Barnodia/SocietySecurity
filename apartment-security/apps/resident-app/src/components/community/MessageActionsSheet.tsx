import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageActionsSheet({
  visible,
  isMine,
  onClose,
  onReply,
  onReact,
  onDelete,
}: {
  visible: boolean;
  isMine?: boolean;
  onClose: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete?: () => void;
}) {
  const close = () => {
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close}>
        
        {/* Sleek Floating Emoji Row */}
        <View style={styles.emojiPill}>
          {QUICK_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.emojiButton}
              onPress={() => {
                onReact(emoji);
                close();
              }}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.emojiButton} onPress={close}>
            <Ionicons name="add" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Action List */}
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <TouchableOpacity style={styles.actionRow} onPress={() => { onReply(); close(); }}>
            <Ionicons name="arrow-undo-outline" size={22} color={colors.text} />
            <Text style={styles.actionText}>Reply</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionRow} onPress={close}>
            <Ionicons name="copy-outline" size={22} color={colors.text} />
            <Text style={styles.actionText}>Copy</Text>
          </TouchableOpacity>

          {isMine && onDelete && (
            <TouchableOpacity style={styles.actionRow} onPress={() => { onDelete(); close(); }}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
              <Text style={[styles.actionText, { color: colors.danger }]}>Delete for everyone</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

import { Ionicons } from '@expo/vector-icons';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emojiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  emojiButton: {
    padding: 4,
  },
  emoji: { fontSize: 26 },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 16,
  },
});
