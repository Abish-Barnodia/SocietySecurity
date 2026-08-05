import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../context/ThemeContext';
import { useCommunity, ChatMessage, CommunityMember } from '../../context/CommunityContext';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import MessageBubble from '../../components/community/MessageBubble';
import MessageActionsSheet from '../../components/community/MessageActionsSheet';
import AttachmentSheet, { AttachmentAction } from '../../components/community/AttachmentSheet';
import CreatePollModal from '../../components/community/CreatePollModal';
import MentionAutocomplete from '../../components/community/MentionAutocomplete';

type ListItem = { kind: 'date'; label: string; key: string } | { kind: 'message'; message: ChatMessage };

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const formatDateLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatRecordingTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function CommunityScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const {
    messages,
    members,
    loadingInitial,
    loadingOlder,
    hasMore,
    typingUsers,
    searchResults,
    searching,
    fetchOlderMessages,
    sendTextMessage,
    sendMediaMessage,
    toggleReaction,
    deleteMessage,
    searchMessages,
    clearSearch,
    emitTyping,
  } = useCommunity();

  const { isRecording, elapsedSec, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const insets = useSafeAreaInsets();

  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);

  const lastTypingEmitRef = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listData = useMemo<ListItem[]>(() => {
    const chronological = [...messages].reverse();
    const items: ListItem[] = [];
    let lastLabel: string | null = null;
    for (const m of chronological) {
      const label = formatDateLabel(m.createdAt);
      if (label !== lastLabel) {
        items.push({ kind: 'date', label, key: `date-${label}-${m.id}` });
        lastLabel = label;
      }
      items.push({ kind: 'message', message: m });
    }
    return items.reverse();
  }, [messages]);

  const typingNames = typingUsers
    .map((id) => members.find((m) => m.userId === id)?.name)
    .filter((name): name is string => !!name);

  const handleChangeText = (value: string) => {
    setText(value);
    const match = value.match(/@([A-Za-z0-9_]*)$/);
    setMentionQuery(match ? match[1] : null);

    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      emitTyping();
      lastTypingEmitRef.current = now;
    }
  };

  const handleSelectMention = (member: CommunityMember) => {
    setText((prev) => prev.replace(/@([A-Za-z0-9_]*)$/, `@${member.name.replace(/\s+/g, '')} `));
    setMentionQuery(null);
    setMentionedIds((prev) => (prev.includes(member.userId) ? prev : [...prev, member.userId]));
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendTextMessage(text.trim(), replyTo?.id, mentionedIds);
      setText('');
      setMentionedIds([]);
      setMentionQuery(null);
      setReplyTo(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleMicPress = async () => {
    if (isRecording) {
      const result = await stopRecording();
      if (result) {
        try {
          await sendMediaMessage('AUDIO', result.uri, 'audio/m4a', `voice-${Date.now()}.m4a`, {
            replyToId: replyTo?.id,
            durationSec: result.durationSec,
          });
          setReplyTo(null);
        } catch {
          Alert.alert('Error', 'Failed to send voice message. Please try again.');
        }
      }
    } else {
      try {
        await startRecording();
      } catch {
        Alert.alert('Permission required', 'Microphone permission is required to record a voice message.');
      }
    }
  };

  const handleAttachmentSelect = async (action: AttachmentAction) => {
    try {
      if (action === 'poll') {
        setPollModalOpen(true);
        return;
      }

      if (action === 'gallery' || action === 'camera') {
        const permission =
          action === 'gallery'
            ? await ImagePicker.requestMediaLibraryPermissionsAsync()
            : await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission required', `${action === 'gallery' ? 'Photo library' : 'Camera'} permission is required.`);
          return;
        }

        const pickerOptions: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], quality: 0.8 };
        const result =
          action === 'gallery'
            ? await ImagePicker.launchImageLibraryAsync(pickerOptions)
            : await ImagePicker.launchCameraAsync(pickerOptions);

        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const type = asset.type === 'video' ? 'VIDEO' : 'IMAGE';
        await sendMediaMessage(
          type,
          asset.uri,
          asset.mimeType ?? (type === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
          asset.fileName ?? `${type.toLowerCase()}-${Date.now()}.${type === 'VIDEO' ? 'mp4' : 'jpg'}`,
          { replyToId: replyTo?.id }
        );
        setReplyTo(null);
        return;
      }

      if (action === 'document') {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        await sendMediaMessage('FILE', asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name, {
          replyToId: replyTo?.id,
        });
        setReplyTo(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send attachment. Please try again.');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => searchMessages(value), 300);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    clearSearch();
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.kind === 'date') {
      return (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{item.label}</Text>
        </View>
      );
    }
    return (
      <MessageBubble 
        message={item.message} 
        onPress={() => setActionMessage(item.message)} 
        onDoublePress={() => {
          if (!item.message.isMine) {
            Alert.alert('Resident Details', `Name: ${item.message.senderName}\nUnit: ${item.message.senderUnit || 'Unknown'}\nRole: ${item.message.senderRole || 'Resident'}`);
          }
        }}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="people" size={20} color={colors.primary} />
          <Text style={styles.headerTitle}>Community</Text>
        </View>
        <TouchableOpacity onPress={() => setSearchOpen((s) => !s)}>
          <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {searchOpen && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages"
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <TouchableOpacity onPress={closeSearch}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {searchOpen ? (
        searching ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MessageBubble 
                message={item} 
                onPress={() => setActionMessage(item)} 
                onDoublePress={() => {
                  if (!item.isMine) {
                    Alert.alert('Resident Details', `Name: ${item.senderName}\nUnit: ${item.senderUnit || 'Unknown'}\nRole: ${item.senderRole || 'Resident'}`);
                  }
                }}
              />
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              searchQuery ? <Text style={styles.emptyText}>No messages found</Text> : null
            }
          />
        )
      ) : loadingInitial ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => (item.kind === 'date' ? item.key : item.message.id)}
          renderItem={renderItem}
          inverted
          contentContainerStyle={styles.listContent}
          onEndReached={() => {
            if (hasMore && !loadingOlder) fetchOlderMessages();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingOlder ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Say hello 👋</Text>}
        />
      )}

      {typingNames.length > 0 && (
        <Text style={styles.typingText}>
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
        </Text>
      )}

      {mentionQuery !== null && (
          <MentionAutocomplete query={mentionQuery} members={members} onSelect={handleSelectMention} />
        )}

        {replyTo && (
          <View style={styles.replyPreview}>
            <View style={styles.replyPreviewBar} />
            <View style={styles.replyPreviewBody}>
              <Text style={styles.replyPreviewSender}>Replying to {replyTo.isMine ? 'yourself' : replyTo.senderName}</Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                {replyTo.type === 'TEXT' ? replyTo.body ?? '' : `📎 ${replyTo.type}`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {isRecording ? (
          <View style={styles.composerRow}>
            <TouchableOpacity onPress={cancelRecording} style={styles.iconButton}>
              <Ionicons name="trash" size={22} color={colors.danger} />
            </TouchableOpacity>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording… {formatRecordingTime(elapsedSec)}</Text>
            </View>
            <TouchableOpacity onPress={handleMicPress} style={styles.sendButton}>
              <Ionicons name="checkmark" size={20} color={colors.card} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.composerRow}>
            <TouchableOpacity onPress={() => setAttachmentOpen(true)} style={styles.iconButton}>
              <Ionicons name="add-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message…"
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={handleChangeText}
              multiline
            />
            {text.trim() ? (
              <TouchableOpacity onPress={handleSend} style={styles.sendButton} disabled={sending}>
                <Ionicons name="send" size={18} color={colors.card} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleMicPress} style={styles.sendButton}>
                <Ionicons name="mic" size={20} color={colors.card} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <MessageActionsSheet
        visible={!!actionMessage}
        isMine={!!actionMessage?.isMine}
        onClose={() => setActionMessage(null)}
        onReply={() => actionMessage && setReplyTo(actionMessage)}
        onReact={(emoji) => actionMessage && toggleReaction(actionMessage.id, emoji)}
        onDelete={() => {
          if (actionMessage) {
            deleteMessage(actionMessage.id).catch(() => Alert.alert('Error', 'Failed to delete message'));
            setActionMessage(null);
          }
        }}
      />
      <AttachmentSheet visible={attachmentOpen} onClose={() => setAttachmentOpen(false)} onSelect={handleAttachmentSelect} />
      <CreatePollModal visible={pollModalOpen} onClose={() => setPollModalOpen(false)} replyToId={replyTo?.id} />
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  keyboardAvoid: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: { flex: 1, marginHorizontal: 8, fontSize: 14, color: colors.text },
  listContent: { paddingVertical: 8, flexGrow: 1 },
  loader: { marginTop: 40 },
  emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  dateSeparator: { alignItems: 'center', marginVertical: 10 },
  dateSeparatorText: {
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typingText: { fontSize: 12, color: colors.textMuted, paddingHorizontal: 16, paddingBottom: 4 },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyPreviewBar: { width: 3, height: 30, backgroundColor: colors.primary, borderRadius: 2, marginRight: 8 },
  replyPreviewBody: { flex: 1 },
  replyPreviewSender: { fontSize: 12, fontWeight: '700', color: colors.primary },
  replyPreviewText: { fontSize: 12, color: colors.textMuted },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconButton: { padding: 6, marginRight: 4 },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
    color: colors.text,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, marginRight: 8 },
  recordingText: { fontSize: 14, color: colors.text },
});
