import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Linking,
  Image,
  RefreshControl,
  Keyboard,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';
import { copyToClipboard } from '../../utils/clipboard';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import VoiceMessagePlayer from '../../components/community/VoiceMessagePlayer';
import AttachmentSheet from '../../components/community/AttachmentSheet';
import { ListSkeleton } from '../../components/SkeletonLoader';

export interface ResidentMember {
  id: string;
  userId: string;
  name: string;
  residentType?: string;
  isPrimary?: boolean;
  unit?: {
    unitNumber: string;
    tower?: string | null;
  } | null;
  phone?: string | null;
  email?: string | null;
}

export interface DirectMessageItem {
  id: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  senderUnit?: string;
  recipientId: string;
  text?: string;
  mediaType?: 'IMAGE' | 'AUDIO' | 'FILE';
  mediaUri?: string;
  fileName?: string;
  fileSize?: number;
  durationSec?: number;
  replyToId?: string;
  replyToText?: string;
  replyToSender?: string;
  createdAt: string;
}

const AVATAR_COLORS = [
  '#0284c7', '#16a34a', '#8b5cf6', '#d97706', '#dc2626',
  '#0d9488', '#4f46e5', '#ea580c', '#0891b2', '#65a30d',
];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatRecordingTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function ResidentChatScreen({ onBack }: { onBack?: () => void }) {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { guardProfile, userId } = useAuth();
  const socket = useSocket();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [residents, setResidents] = useState<ResidentMember[]>([]);
  const [conversationsSummary, setConversationsSummary] = useState<Record<string, { lastMessage: DirectMessageItem; unreadCount: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'OWNERS' | 'TENANTS'>('ALL');

  // Direct 1-on-1 Chat States
  const [activeChatResident, setActiveChatResident] = useState<ResidentMember | null>(null);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Message Actions & Reply State
  const [actionMessage, setActionMessage] = useState<DirectMessageItem | null>(null);
  const [replyingTo, setReplyingTo] = useState<DirectMessageItem | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const voiceRecorder = useVoiceRecorder();

  // Scroll to bottom when keyboard appears
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );
    return () => {
      showSub.remove();
    };
  }, []);

  const fetchResidents = useCallback(async () => {
    try {
      const [membersRes, convsRes] = await Promise.allSettled([
        api.get('/community/members'),
        api.get('/community/dm/summary/conversations'),
      ]);

      if (membersRes.status === 'fulfilled') {
        setResidents(membersRes.value.data.data ?? []);
      }

      if (convsRes.status === 'fulfilled' && convsRes.value.data?.data?.conversations) {
        const map: Record<string, { lastMessage: DirectMessageItem; unreadCount: number }> = {};
        convsRes.value.data.data.conversations.forEach((item: any) => {
          map[item.partnerId] = {
            lastMessage: item.lastMessage,
            unreadCount: item.unreadCount || 0,
          };
        });
        setConversationsSummary(map);
      }
    } catch (err) {
      console.log('Error fetching residents:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchResidents();
  }, [fetchResidents]);

  const openChatWith = (resident: ResidentMember) => {
    setActiveChatResident(resident);
    setConversationsSummary((prev) => {
      const targetKey = prev[resident.userId] ? resident.userId : resident.id;
      if (!prev[targetKey]) return prev;
      return {
        ...prev,
        [targetKey]: {
          ...prev[targetKey]!,
          unreadCount: 0,
        },
      };
    });
    api.post(`/community/dm/${resident.userId || resident.id}/read`).catch(() => {});
  };

  // Load chat history when selecting resident
  const loadChatHistory = useCallback(async (residentUserId: string) => {
    try {
      const res = await api.get(`/community/dm/${residentUserId}`);
      if (res.data?.data) {
        setMessages(res.data.data);
      }
    } catch (err) {
      console.log('Error loading DM history:', err);
    }
  }, []);

  useEffect(() => {
    if (activeChatResident) {
      loadChatHistory(activeChatResident.userId || activeChatResident.id);
    } else {
      setMessages([]);
      setReplyingTo(null);
    }
  }, [activeChatResident, loadChatHistory]);

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;

    const handleDmMessage = (incoming: DirectMessageItem) => {
      const isForActive =
        activeChatResident &&
        (incoming.senderId === activeChatResident.userId ||
          incoming.recipientId === activeChatResident.userId ||
          incoming.senderId === activeChatResident.id ||
          incoming.recipientId === activeChatResident.id);

      if (isForActive) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        api.post(`/community/dm/${activeChatResident.userId || activeChatResident.id}/read`).catch(() => {});
      }

      const partnerId = incoming.senderId === userId ? incoming.recipientId : incoming.senderId;
      const isUnread = incoming.senderId !== userId && !isForActive;

      setConversationsSummary((prev) => {
        const existing = prev[partnerId];
        return {
          ...prev,
          [partnerId]: {
            lastMessage: incoming,
            unreadCount: isUnread ? (existing?.unreadCount || 0) + 1 : 0,
          },
        };
      });
    };

    const handleDmDelete = (payload: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
    };

    const handleDmRead = (payload: { partnerId: string; readerId: string }) => {
      if (payload.readerId === userId) {
        setConversationsSummary((prev) => {
          if (!prev[payload.partnerId]) return prev;
          return {
            ...prev,
            [payload.partnerId]: {
              ...prev[payload.partnerId]!,
              unreadCount: 0,
            },
          };
        });
      }
    };

    socket.on('dm:message', handleDmMessage);
    socket.on('dm:delete', handleDmDelete);
    socket.on('dm:read', handleDmRead);
    return () => {
      socket.off('dm:message', handleDmMessage);
      socket.off('dm:delete', handleDmDelete);
      socket.off('dm:read', handleDmRead);
    };
  }, [socket, activeChatResident, userId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchResidents();
  };

  const dialPhone = (num?: string | null) => {
    if (!num) {
      Alert.alert('Phone Unavailable', 'No registered phone number found for this resident.');
      return;
    }
    Linking.openURL(`tel:${num}`).catch(() => Alert.alert('Dialer Error', `Unable to call ${num}`));
  };

  const formatMessageTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (isYesterday) {
        return 'Yesterday';
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const filteredResidents = useMemo(() => {
    const list = residents.filter((r) => {
      const query = searchText.toLowerCase().trim();
      const nameMatch = r.name.toLowerCase().includes(query);
      const unitStr = r.unit ? `${r.unit.tower || ''} ${r.unit.unitNumber}`.toLowerCase() : '';
      const unitMatch = unitStr.includes(query);

      if (query && !nameMatch && !unitMatch) return false;

      if (selectedFilter === 'OWNERS') return r.isPrimary || r.residentType?.toUpperCase() === 'OWNER';
      if (selectedFilter === 'TENANTS') return r.residentType?.toUpperCase() === 'TENANT';
      return true;
    });

    // WhatsApp style sorting: active conversations & unread first
    return list.sort((a, b) => {
      const convA = conversationsSummary[a.userId] || conversationsSummary[a.id];
      const convB = conversationsSummary[b.userId] || conversationsSummary[b.id];

      const unreadA = convA?.unreadCount || 0;
      const unreadB = convB?.unreadCount || 0;
      if (unreadA !== unreadB) return unreadB - unreadA;

      const timeA = convA?.lastMessage ? new Date(convA.lastMessage.createdAt).getTime() : 0;
      const timeB = convB?.lastMessage ? new Date(convB.lastMessage.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;

      return a.name.localeCompare(b.name);
    });
  }, [residents, searchText, selectedFilter, conversationsSummary]);

  const sendTextMessage = async () => {
    if (!chatInput.trim() || !activeChatResident) return;
    const textToSend = chatInput.trim();
    setChatInput('');

    const currentReply = replyingTo;
    setReplyingTo(null);

    const partnerId = activeChatResident.userId || activeChatResident.id;

    const optimisticMsg: DirectMessageItem = {
      id: `dm_opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: userId || 'me',
      senderName: guardProfile?.name || 'Security Guard',
      senderRole: 'GUARD',
      senderUnit: 'Security Station',
      recipientId: partnerId,
      text: textToSend,
      replyToId: currentReply?.id || undefined,
      replyToText: currentReply ? (currentReply.text || (currentReply.mediaType === 'IMAGE' ? 'Photo' : currentReply.mediaType === 'AUDIO' ? 'Voice note' : 'Document')) : undefined,
      replyToSender: currentReply ? (currentReply.senderName || activeChatResident.name) : undefined,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await api.post(`/community/dm/${partnerId}`, {
        text: textToSend,
        replyToId: optimisticMsg.replyToId,
        replyToText: optimisticMsg.replyToText,
        replyToSender: optimisticMsg.replyToSender,
      });
      if (res.data?.data) {
        setMessages((prev) => prev.map((m) => (m.id === optimisticMsg.id ? res.data.data : m)));
      }
    } catch (err) {
      console.log('Error sending guard direct message:', err);
    }
  };

  const handleMicPress = async () => {
    if (!activeChatResident) return;
    if (voiceRecorder.isRecording) {
      const result = await voiceRecorder.stopRecording();
      if (result) {
        sendMediaMessage('AUDIO', result.uri, undefined, undefined, result.durationSec);
      }
    } else {
      try {
        await voiceRecorder.startRecording();
      } catch {
        Alert.alert('Permission required', 'Microphone permission is required to record voice notes.');
      }
    }
  };

  const sendMediaMessage = async (
    mediaType: 'IMAGE' | 'AUDIO' | 'FILE',
    mediaUri: string,
    fileName?: string,
    fileSize?: number,
    durationSec?: number
  ) => {
    if (!activeChatResident) return;
    const partnerId = activeChatResident.userId || activeChatResident.id;
    const currentReply = replyingTo;
    setReplyingTo(null);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: mediaUri,
        name: fileName || (mediaType === 'AUDIO' ? `voice_${Date.now()}.m4a` : `file_${Date.now()}.jpg`),
        type: mediaType === 'AUDIO' ? 'audio/m4a' : 'image/jpeg',
      } as any);

      const uploadRes = await api.post('/community/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const finalUrl = uploadRes.data?.data?.url || mediaUri;

      const res = await api.post(`/community/dm/${partnerId}`, {
        mediaType,
        mediaUri: finalUrl,
        fileName,
        fileSize,
        durationSec,
        replyToId: currentReply?.id || undefined,
        replyToText: currentReply ? currentReply.text : undefined,
        replyToSender: currentReply ? currentReply.senderName : undefined,
      });

      if (res.data?.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.data.id)) return prev;
          return [...prev, res.data.data];
        });
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      Alert.alert('Upload Failed', 'Could not send attachment.');
    }
  };

  const handleAttachment = async (action: 'camera' | 'gallery' | 'document' | 'poll') => {
    setAttachmentOpen(false);
    if (action === 'poll') return;
    try {
      if (action === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission required', 'Camera permission is required to take photos.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          sendMediaMessage('IMAGE', res.assets[0].uri, res.assets[0].fileName || 'Photo.jpg', res.assets[0].fileSize);
        }
      } else if (action === 'gallery') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission required', 'Media library permission is required to select photos.');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          sendMediaMessage('IMAGE', res.assets[0].uri, res.assets[0].fileName || 'Photo.jpg', res.assets[0].fileSize);
        }
      } else if (action === 'document') {
        const res = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          const asset = res.assets[0];
          sendMediaMessage('FILE', asset.uri, asset.name, asset.size ?? undefined);
        }
      }
    } catch (e: any) {
      Alert.alert('Attachment Error', e?.message || 'Unable to attach selected item.');
    }
  };

  const confirmDeleteMessage = (msg: DirectMessageItem) => {
    setActionMessage(null);
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message for everyone in this chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            if (activeChatResident) {
              const partnerId = activeChatResident.userId || activeChatResident.id;
              try {
                await api.delete(`/community/dm/${partnerId}/${msg.id}`);
              } catch (err) {
                console.log('Error deleting guard direct message:', err);
              }
            }
          },
        },
      ]
    );
  };

  const handleCopyMessage = async (msg: DirectMessageItem) => {
    setActionMessage(null);
    if (msg.text) {
      await copyToClipboard(msg.text);
      Alert.alert('Copied', 'Message copied to clipboard.');
    }
  };

  const handleStartReply = (msg: DirectMessageItem) => {
    setActionMessage(null);
    setReplyingTo(msg);
    setTimeout(() => textInputRef.current?.focus(), 100);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={{ marginRight: 10, padding: 4 }}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Resident Directory & Chat</Text>
            <Text style={styles.subTitle}>
              {residents.length} building residents • 1-on-1 private messaging
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search resident name, flat (e.g. 201)..."
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.chip, selectedFilter === 'ALL' && styles.chipActive]}
            onPress={() => setSelectedFilter('ALL')}
          >
            <Text style={[styles.chipText, selectedFilter === 'ALL' && styles.chipTextActive]}>
              All ({residents.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, selectedFilter === 'OWNERS' && styles.chipActive]}
            onPress={() => setSelectedFilter('OWNERS')}
          >
            <Text style={[styles.chipText, selectedFilter === 'OWNERS' && styles.chipTextActive]}>
              Owners
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, selectedFilter === 'TENANTS' && styles.chipActive]}
            onPress={() => setSelectedFilter('TENANTS')}
          >
            <Text style={[styles.chipText, selectedFilter === 'TENANTS' && styles.chipTextActive]}>
              Tenants
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Residents List */}
      {loading && !refreshing ? (
        <ListSkeleton count={5} />
      ) : (
        <FlatList
          data={filteredResidents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No residents found</Text>
              <Text style={styles.emptySub}>Try adjusting your search or filters.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length]!;
            const isOwner = item.isPrimary || item.residentType?.toUpperCase() === 'OWNER';
            const conv = conversationsSummary[item.userId] || conversationsSummary[item.id];
            const lastMsg = conv?.lastMessage;
            const unreadCount = conv?.unreadCount || 0;

            let lastMsgSnippet = item.unit
              ? `${item.unit.tower ? `Tower ${item.unit.tower} • ` : ''}Flat ${item.unit.unitNumber}`
              : 'Flat Assigned';

            if (lastMsg) {
              const isMine = lastMsg.senderId === userId || lastMsg.senderId === 'me' || lastMsg.senderRole === 'GUARD';
              const prefix = isMine ? 'You: ' : '';
              if (lastMsg.text) {
                lastMsgSnippet = `${prefix}${lastMsg.text}`;
              } else if (lastMsg.mediaType === 'IMAGE') {
                lastMsgSnippet = `${prefix}📷 Photo`;
              } else if (lastMsg.mediaType === 'AUDIO') {
                lastMsgSnippet = `${prefix}🎤 Voice note`;
              } else if (lastMsg.mediaType === 'FILE') {
                lastMsgSnippet = `${prefix}📄 ${lastMsg.fileName || 'Document'}`;
              }
            }

            return (
              <TouchableOpacity
                style={[styles.card, unreadCount > 0 && styles.cardUnread]}
                activeOpacity={0.8}
                onPress={() => openChatWith(item)}
              >
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                </View>

                <View style={styles.cardInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.residentName, unreadCount > 0 && styles.residentNameBold]} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.tag, isOwner ? styles.tagOwner : styles.tagTenant]}>
                      <Text style={[styles.tagText, isOwner ? styles.tagTextOwner : styles.tagTextTenant]}>
                        {isOwner ? 'Owner' : 'Tenant'}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.unitText,
                      unreadCount > 0 && { color: colors.text, fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {lastMsgSnippet}
                  </Text>
                </View>

                <View style={styles.cardRightCol}>
                  {lastMsg ? (
                    <Text style={[styles.lastMsgTime, unreadCount > 0 && { color: '#10b981', fontWeight: '800' }]}>
                      {formatMessageTime(lastMsg.createdAt)}
                    </Text>
                  ) : null}

                  <View style={styles.cardActions}>
                    {unreadCount > 0 ? (
                      <View style={styles.unreadBadgePill}>
                        <Text style={styles.unreadBadgePillText}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                      </View>
                    ) : null}

                    {item.phone ? (
                      <TouchableOpacity
                        style={styles.actionCircleBtn}
                        onPress={() => dialPhone(item.phone)}
                      >
                        <Ionicons name="call" size={15} color="#16a34a" />
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={[styles.actionCircleBtn, { backgroundColor: 'rgba(2, 132, 199, 0.12)' }]}
                      onPress={() => openChatWith(item)}
                    >
                      <Ionicons name="chatbubble-ellipses" size={15} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ================= MODAL: 1-ON-1 DIRECT CHAT WITH RESIDENT ================= */}
      <Modal
        visible={!!activeChatResident}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (voiceRecorder.isRecording) voiceRecorder.cancelRecording();
          setActiveChatResident(null);
          setReplyingTo(null);
        }}
      >
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#f5f3ef' }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            {/* Direct Chat Header */}
            <View style={styles.chatHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (voiceRecorder.isRecording) voiceRecorder.cancelRecording();
                  setActiveChatResident(null);
                  setReplyingTo(null);
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-back" size={26} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.chatHeaderCenter}>
                <View style={[styles.chatAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.chatAvatarText}>
                    {activeChatResident ? getInitials(activeChatResident.name) : 'R'}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.chatHeaderName} numberOfLines={1}>{activeChatResident?.name}</Text>
                  <Text style={styles.chatHeaderSub} numberOfLines={1}>
                    {activeChatResident?.unit
                      ? `${activeChatResident.unit.tower ? `T-${activeChatResident.unit.tower} • ` : ''}Flat ${activeChatResident.unit.unitNumber}`
                      : 'Resident'}
                  </Text>
                </View>
              </View>

              {activeChatResident?.phone ? (
                <TouchableOpacity
                  style={styles.chatCallBtn}
                  onPress={() => dialPhone(activeChatResident.phone)}
                >
                  <Ionicons name="call" size={16} color="#16a34a" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Direct Messages Thread */}
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              <View style={styles.privacyNoticeBox}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
                <Text style={styles.privacyNoticeText}>
                  Direct private chat with {activeChatResident?.name}. Tap and hold any message to reply or delete.
                </Text>
              </View>

              {messages.map((msg, index) => {
                const isMine = msg.senderId === userId || msg.senderId === 'me' || msg.senderRole === 'GUARD';
                const hasReply = Boolean(msg.replyToId && msg.replyToText);
                return (
                  <View
                    key={msg.id ? `${msg.id}_${index}` : `dm_${index}`}
                    style={[
                      styles.msgRow,
                      isMine ? styles.msgRowMine : styles.msgRowOther,
                    ]}
                  >
                    <Pressable
                      onLongPress={() => setActionMessage(msg)}
                      delayLongPress={300}
                      style={({ pressed }) => [
                        styles.msgBubble,
                        isMine ? styles.msgBubbleMine : styles.msgBubbleOther,
                        pressed && { opacity: 0.88 },
                      ]}
                    >
                      {/* Quoted Reply Preview */}
                      {hasReply ? (
                        <View style={[styles.quotedWrap, isMine ? styles.quotedWrapMine : styles.quotedWrapOther]}>
                          <View style={styles.quotedBar} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.quotedSender, isMine ? { color: '#ffffff' } : { color: '#0284c7' }]} numberOfLines={1}>
                              {msg.replyToSender || 'Resident'}
                            </Text>
                            <Text style={[styles.quotedSnippet, isMine ? { color: 'rgba(255,255,255,0.85)' } : { color: colors.textMuted }]} numberOfLines={2}>
                              {msg.replyToText}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {/* Photo attachment */}
                      {msg.mediaType === 'IMAGE' && !!msg.mediaUri && (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => setPreviewImage(msg.mediaUri || null)}
                          style={{ marginBottom: 6 }}
                        >
                          <Image
                            source={{ uri: msg.mediaUri }}
                            style={styles.mediaThumb}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      )}

                      {/* Voice note audio */}
                      {msg.mediaType === 'AUDIO' && !!msg.mediaUri && (
                        <View style={{ marginVertical: 4 }}>
                          <VoiceMessagePlayer
                            uri={msg.mediaUri}
                            fallbackDurationSec={msg.durationSec}
                            tint={isMine ? '#ffffff' : colors.primary}
                          />
                        </View>
                      )}

                      {/* Document file */}
                      {msg.mediaType === 'FILE' && !!msg.mediaUri && (
                        <TouchableOpacity
                          style={[styles.fileBox, isMine ? styles.fileBoxMine : styles.fileBoxOther]}
                          onPress={() => msg.mediaUri && Linking.openURL(msg.mediaUri)}
                        >
                          <Ionicons name="document-text" size={24} color={isMine ? '#ffffff' : colors.primary} />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={[styles.fileName, isMine && { color: '#ffffff' }]} numberOfLines={1}>
                              {msg.fileName || 'Document'}
                            </Text>
                            <Text style={[styles.fileSize, isMine && { color: 'rgba(255,255,255,0.8)' }]}>
                              {formatFileSize(msg.fileSize)} • Tap to open
                            </Text>
                          </View>
                          <Ionicons name="arrow-down-circle" size={18} color={isMine ? '#ffffff' : colors.textMuted} />
                        </TouchableOpacity>
                      )}

                      {/* Text */}
                      {!!msg.text && (
                        <Text style={[styles.msgText, isMine ? styles.msgTextMine : styles.msgTextOther]}>
                          {msg.text}
                        </Text>
                      )}

                      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 }}>
                        <Text style={[styles.msgTime, isMine && { color: 'rgba(255,255,255,0.7)' }]}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {isMine && (
                          <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.75)" style={{ marginLeft: 3 }} />
                        )}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>

            {/* Replying-To Floating Bar */}
            {replyingTo && (
              <View style={[styles.replyBanner, { backgroundColor: isDark ? '#1e293b' : '#e0f2fe' }]}>
                <View style={styles.replyBannerLeft}>
                  <Ionicons name="return-down-forward" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.replyBannerSender, { color: colors.primary }]} numberOfLines={1}>
                      Replying to {replyingTo.senderName || 'Resident'}
                    </Text>
                    <Text style={[styles.replyBannerSnippet, { color: colors.text }]} numberOfLines={1}>
                      {replyingTo.text || (replyingTo.mediaType === 'IMAGE' ? '📷 Photo' : replyingTo.mediaType === 'AUDIO' ? '🎤 Voice note' : '📄 File attachment')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {/* Composer */}
            <View style={styles.composerRow}>
              {voiceRecorder.isRecording ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <TouchableOpacity onPress={voiceRecorder.cancelRecording} style={styles.composerIconBtn}>
                    <Ionicons name="trash" size={22} color={colors.danger} />
                  </TouchableOpacity>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording… {formatRecordingTime(voiceRecorder.elapsedSec)}</Text>
                  </View>
                  <TouchableOpacity onPress={handleMicPress} style={styles.sendButton}>
                    <Ionicons name="checkmark" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => setAttachmentOpen(true)}
                    style={styles.composerIconBtn}
                  >
                    <Ionicons name="add-circle" size={28} color="#0284c7" />
                  </TouchableOpacity>

                  <TextInput
                    ref={textInputRef}
                    style={styles.textInput}
                    placeholder={`Message ${activeChatResident?.name || 'resident'}...`}
                    placeholderTextColor={colors.textMuted}
                    value={chatInput}
                    onChangeText={setChatInput}
                    multiline
                  />

                  {chatInput.trim() ? (
                    <TouchableOpacity
                      onPress={sendTextMessage}
                      style={styles.sendButton}
                    >
                      <Ionicons name="send" size={18} color="#ffffff" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={handleMicPress}
                      style={styles.micButton}
                    >
                      <Ionicons name="mic" size={20} color="#ffffff" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Message Action Sheet */}
            <Modal
              visible={!!actionMessage}
              transparent
              animationType="fade"
              onRequestClose={() => setActionMessage(null)}
            >
              <TouchableOpacity
                style={styles.actionModalBackdrop}
                activeOpacity={1}
                onPress={() => setActionMessage(null)}
              >
                <View style={[styles.actionModalSheet, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
                  <View style={styles.actionModalHandle} />
                  <Text style={[styles.actionModalTitle, { color: colors.text }]}>Message Options</Text>

                  {/* Reply */}
                  <TouchableOpacity
                    style={styles.actionModalItem}
                    onPress={() => actionMessage && handleStartReply(actionMessage)}
                  >
                    <View style={[styles.actionIconCircle, { backgroundColor: '#e0f2fe' }]}>
                      <Ionicons name="arrow-undo" size={18} color="#0284c7" />
                    </View>
                    <Text style={[styles.actionModalItemText, { color: colors.text }]}>Reply to message</Text>
                  </TouchableOpacity>

                  {/* Copy */}
                  {actionMessage?.text ? (
                    <TouchableOpacity
                      style={styles.actionModalItem}
                      onPress={() => actionMessage && handleCopyMessage(actionMessage)}
                    >
                      <View style={[styles.actionIconCircle, { backgroundColor: '#f1f5f9' }]}>
                        <Ionicons name="copy-outline" size={18} color={colors.text} />
                      </View>
                      <Text style={[styles.actionModalItemText, { color: colors.text }]}>Copy text</Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Delete */}
                  <TouchableOpacity
                    style={[styles.actionModalItem, { borderBottomWidth: 0 }]}
                    onPress={() => actionMessage && confirmDeleteMessage(actionMessage)}
                  >
                    <View style={[styles.actionIconCircle, { backgroundColor: '#fee2e2' }]}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </View>
                    <Text style={[styles.actionModalItemText, { color: '#ef4444', fontWeight: '700' }]}>
                      Delete message
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Media Attachment Sheet */}
            <AttachmentSheet
              visible={attachmentOpen}
              onClose={() => setAttachmentOpen(false)}
              onSelect={handleAttachment}
            />

            {/* Fullscreen Photo Modal */}
            <Modal
              visible={!!previewImage}
              transparent
              animationType="fade"
              onRequestClose={() => setPreviewImage(null)}
            >
              <View style={styles.photoModalBackdrop}>
                <TouchableOpacity
                  style={styles.photoCloseBtn}
                  onPress={() => setPreviewImage(null)}
                >
                  <Ionicons name="close" size={28} color="#ffffff" />
                </TouchableOpacity>
                {!!previewImage && (
                  <Image
                    source={{ uri: previewImage }}
                    style={styles.fullscreenPhoto}
                    resizeMode="contain"
                  />
                )}
              </View>
            </Modal>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTopRow: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    subTitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderRadius: 10,
      paddingHorizontal: 10,
      height: 38,
      marginTop: 10,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: colors.text },
    filterRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    chipTextActive: { color: '#ffffff' },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardUnread: {
      borderColor: 'rgba(16, 185, 129, 0.45)',
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.04)',
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
    cardInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
    residentName: { fontSize: 15, fontWeight: '700', color: colors.text },
    residentNameBold: { fontWeight: '800' },
    tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
    tagOwner: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
    tagTenant: { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
    tagText: { fontSize: 10, fontWeight: '700' },
    tagTextOwner: { color: '#10b981' },
    tagTextTenant: { color: '#3b82f6' },
    unitText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    cardRightCol: { alignItems: 'flex-end', justifyContent: 'center' },
    lastMsgTime: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    unreadBadgePill: {
      backgroundColor: '#10b981',
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 2,
    },
    unreadBadgePillText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '800',
    },
    actionCircleBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(22, 163, 74, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    emptySub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },

    // Chat Modal
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    chatHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
    chatAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    chatAvatarText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
    chatHeaderName: { fontSize: 15, fontWeight: '700', color: colors.text },
    chatHeaderSub: { fontSize: 11, color: colors.textMuted },
    chatCallBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(22, 163, 74, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    privacyNoticeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
      padding: 8,
      borderRadius: 8,
      marginBottom: 14,
    },
    privacyNoticeText: { fontSize: 11, color: colors.textMuted, marginLeft: 6, flex: 1, textAlign: 'center' },
    msgRow: { marginVertical: 4, flexDirection: 'row' },
    msgRowMine: { justifyContent: 'flex-end' },
    msgRowOther: { justifyContent: 'flex-start' },
    msgBubble: {
      maxWidth: '82%',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
    },
    msgBubbleMine: { backgroundColor: '#0284c7', borderBottomRightRadius: 2 },
    msgBubbleOther: { backgroundColor: colors.card, borderBottomLeftRadius: 2, borderWidth: 1, borderColor: colors.border },
    quotedWrap: {
      flexDirection: 'row',
      borderRadius: 6,
      padding: 6,
      marginBottom: 6,
      gap: 6,
    },
    quotedWrapMine: { backgroundColor: 'rgba(0,0,0,0.2)' },
    quotedWrapOther: { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' },
    quotedBar: { width: 3, backgroundColor: '#38bdf8', borderRadius: 2 },
    quotedSender: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
    quotedSnippet: { fontSize: 12 },
    msgText: { fontSize: 14, lineHeight: 19 },
    msgTextMine: { color: '#ffffff' },
    msgTextOther: { color: colors.text },
    msgTime: { fontSize: 10, color: colors.textMuted },
    mediaThumb: { width: 200, height: 150, borderRadius: 10 },
    fileBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 8,
      marginVertical: 4,
    },
    fileBoxMine: { backgroundColor: 'rgba(255,255,255,0.15)' },
    fileBoxOther: { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
    fileName: { fontSize: 12, fontWeight: '700', color: colors.text },
    fileSize: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    replyBannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    replyBannerSender: { fontSize: 12, fontWeight: '700' },
    replyBannerSnippet: { fontSize: 12, marginTop: 1 },
    composerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 10,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    composerIconBtn: { padding: 6 },
    textInput: {
      flex: 1,
      minHeight: 38,
      maxHeight: 90,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderRadius: 19,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 8 : 6,
      fontSize: 14,
      color: colors.text,
      marginHorizontal: 6,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#0284c7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    micButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#0284c7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    recordingIndicator: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, marginRight: 6 },
    recordingText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
    actionModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    actionModalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 32,
    },
    actionModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#94a3b8', alignSelf: 'center', marginBottom: 14 },
    actionModalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },
    actionModalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(150,150,150,0.15)',
      gap: 14,
    },
    actionIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    actionModalItemText: { fontSize: 15, fontWeight: '600' },
    photoModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
    photoCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
    fullscreenPhoto: { width: '92%', height: '80%' },
  });
