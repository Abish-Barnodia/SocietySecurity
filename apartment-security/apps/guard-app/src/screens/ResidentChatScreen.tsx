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
  ActivityIndicator,
  Keyboard,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getSocket } from '../utils/socket';
import api from '../utils/api';
import { copyToClipboard } from '../utils/clipboard';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import VoiceMessagePlayer from '../components/VoiceMessagePlayer';
import AttachmentSheet from '../components/AttachmentSheet';
import { ListSkeleton } from '../components/SkeletonLoader';

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
  const { userId, guardProfile } = useAuth();
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
  const [loadingMessages, setLoadingMessages] = useState(false);
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
          const entry = {
            lastMessage: item.lastMessage,
            unreadCount: item.unreadCount || 0,
          };
          if (item.partnerId) map[item.partnerId] = entry;
          if (item.partnerUserId) map[item.partnerUserId] = entry;
          if (item.partnerMemberId) map[item.partnerMemberId] = entry;
        });
        setConversationsSummary(map);
      }
    } catch (err) {
      console.log('Error fetching residents in guard-app:', err);
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

  // Load chat history when opening a resident chat
  const loadChatHistory = useCallback(async (residentIdOrUserId: string) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/community/dm/${residentIdOrUserId}`);
      if (res.data?.data) {
        setMessages(res.data.data);
      }
    } catch (err) {
      console.log('Error loading DM history in guard-app:', err);
    } finally {
      setLoadingMessages(false);
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

  // Real-time socket message & deletion handlers
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleDmMessage = (incomingMsg: DirectMessageItem) => {
      const isForActive =
        activeChatResident &&
        (incomingMsg.senderId === activeChatResident.userId ||
          incomingMsg.recipientId === activeChatResident.userId ||
          incomingMsg.senderId === activeChatResident.id ||
          incomingMsg.recipientId === activeChatResident.id);

      if (isForActive) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incomingMsg.id)) return prev;
          return [...prev, incomingMsg];
        });
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        api.post(`/community/dm/${activeChatResident.userId || activeChatResident.id}/read`).catch(() => {});
      }

      const partnerId = incomingMsg.senderId === userId ? incomingMsg.recipientId : incomingMsg.senderId;
      const isUnread = incomingMsg.senderId !== userId && !isForActive;

      setConversationsSummary((prev) => {
        const existing = prev[partnerId];
        return {
          ...prev,
          [partnerId]: {
            lastMessage: incomingMsg,
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
  }, [activeChatResident, userId]);

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

    const partnerTarget = activeChatResident.userId || activeChatResident.id;

    const optimisticMsg: DirectMessageItem = {
      id: `dm_opt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      senderId: userId || 'guard',
      senderName: guardProfile?.name || 'Security Guard',
      senderRole: 'GUARD',
      recipientId: partnerTarget,
      text: textToSend,
      replyToId: currentReply?.id,
      replyToText: currentReply ? (currentReply.text || (currentReply.mediaType === 'IMAGE' ? 'Photo' : currentReply.mediaType === 'AUDIO' ? 'Voice note' : currentReply.mediaType === 'FILE' ? 'Document' : undefined)) : undefined,
      replyToSender: currentReply?.senderName,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await api.post(`/community/dm/${partnerTarget}`, {
        text: textToSend,
        replyToId: optimisticMsg.replyToId,
        replyToText: optimisticMsg.replyToText,
        replyToSender: optimisticMsg.replyToSender,
      });
      if (res.data?.data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? res.data.data : m))
        );
      }
    } catch (err) {
      console.log('Error sending direct message:', err);
    }
  };

  const handleSendVoiceNote = async () => {
    if (!activeChatResident) return;
    const currentReply = replyingTo;
    setReplyingTo(null);

    try {
      const recorded = await voiceRecorder.stopRecording();
      if (!recorded || !recorded.uri) return;

      const formData = new FormData();
      formData.append('file', {
        uri: recorded.uri,
        name: `voice_${Date.now()}.m4a`,
        type: 'audio/m4a',
      } as any);

      const uploadRes = await api.post('/community/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const audioUrl = uploadRes.data?.data?.url || recorded.uri;
      const partnerTarget = activeChatResident.userId || activeChatResident.id;

      const res = await api.post(`/community/dm/${partnerTarget}`, {
        mediaType: 'AUDIO',
        mediaUri: audioUrl,
        durationSec: recorded.durationSec || 0,
        fileName: 'Voice note.m4a',
        replyToId: currentReply?.id,
        replyToText: currentReply?.text,
        replyToSender: currentReply?.senderName,
      });

      if (res.data?.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.data.id)) return prev;
          return [...prev, res.data.data];
        });
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      Alert.alert('Voice Note Failed', 'Could not upload or send voice recording.');
    }
  };

  const handleAttachment = async (action: 'camera' | 'gallery' | 'document') => {
    setAttachmentOpen(false);
    if (!activeChatResident) return;
    const currentReply = replyingTo;
    setReplyingTo(null);
    const partnerTarget = activeChatResident.userId || activeChatResident.id;

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
          const asset = res.assets[0];
          const formData = new FormData();
          formData.append('file', {
            uri: asset.uri,
            name: asset.fileName || `photo_${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
          } as any);

          const uploadRes = await api.post('/community/uploads', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const imgUrl = uploadRes.data?.data?.url || asset.uri;

          const msgRes = await api.post(`/community/dm/${partnerTarget}`, {
            mediaType: 'IMAGE',
            mediaUri: imgUrl,
            fileName: asset.fileName || 'Photo.jpg',
            fileSize: asset.fileSize,
            replyToId: currentReply?.id,
            replyToText: currentReply?.text,
            replyToSender: currentReply?.senderName,
          });

          if (msgRes.data?.data) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msgRes.data.data.id)) return prev;
              return [...prev, msgRes.data.data];
            });
          }
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
          const asset = res.assets[0];
          const formData = new FormData();
          formData.append('file', {
            uri: asset.uri,
            name: asset.fileName || `photo_${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
          } as any);

          const uploadRes = await api.post('/community/uploads', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const imgUrl = uploadRes.data?.data?.url || asset.uri;

          const msgRes = await api.post(`/community/dm/${partnerTarget}`, {
            mediaType: 'IMAGE',
            mediaUri: imgUrl,
            fileName: asset.fileName || 'Photo.jpg',
            fileSize: asset.fileSize,
            replyToId: currentReply?.id,
            replyToText: currentReply?.text,
            replyToSender: currentReply?.senderName,
          });

          if (msgRes.data?.data) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msgRes.data.data.id)) return prev;
              return [...prev, msgRes.data.data];
            });
          }
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      } else if (action === 'document') {
        const res = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          const asset = res.assets[0];
          const formData = new FormData();
          formData.append('file', {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType || 'application/octet-stream',
          } as any);

          const uploadRes = await api.post('/community/uploads', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const fileUrl = uploadRes.data?.data?.url || asset.uri;

          const msgRes = await api.post(`/community/dm/${partnerTarget}`, {
            mediaType: 'FILE',
            mediaUri: fileUrl,
            fileName: asset.name,
            fileSize: asset.size ?? undefined,
            replyToId: currentReply?.id,
            replyToText: currentReply?.text,
            replyToSender: currentReply?.senderName,
          });

          if (msgRes.data?.data) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msgRes.data.data.id)) return prev;
              return [...prev, msgRes.data.data];
            });
          }
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }
    } catch (e: any) {
      Alert.alert('Attachment Error', e?.message || 'Unable to attach selected item.');
    }
  };

  // Delete message handler
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
            // Optimistic local removal
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            if (activeChatResident) {
              try {
                const partnerTarget = activeChatResident.userId || activeChatResident.id;
                await api.delete(`/community/dm/${partnerTarget}/${msg.id}`);
              } catch (err) {
                console.log('Error deleting direct message in guard-app:', err);
              }
            }
          },
        },
      ]
    );
  };

  // Copy message handler
  const handleCopyMessage = async (msg: DirectMessageItem) => {
    setActionMessage(null);
    if (msg.text) {
      await copyToClipboard(msg.text);
      Alert.alert('Copied', 'Message copied to clipboard.');
    }
  };

  // Start Reply to Message
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
          keyExtractor={(item) => item.userId || item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={38} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Residents Found</Text>
              <Text style={styles.emptySub}>
                {searchText ? `No residents match "${searchText}".` : 'No registered residents in the building yet.'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const avatarBg = AVATAR_COLORS[index % AVATAR_COLORS.length]!;
            const initials = getInitials(item.name);
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
                style={[styles.residentCard, unreadCount > 0 && styles.residentCardUnread]}
                activeOpacity={0.75}
                onPress={() => openChatWith(item)}
              >
                <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={styles.residentInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.residentName, unreadCount > 0 && styles.residentNameBold]} numberOfLines={1}>{item.name}</Text>
                    {item.isPrimary && (
                      <View style={styles.ownerBadge}>
                        <Text style={styles.ownerBadgeText}>Owner</Text>
                      </View>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.residentLastMsg,
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
            {loadingMessages ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
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
                    Direct private chat with {activeChatResident?.name}. Tap & hold any message to reply or delete.
                  </Text>
                </View>

                {messages.map((msg, index) => {
                  const isMine = msg.senderId === userId || msg.senderId === 'guard' || msg.senderRole === 'GUARD';
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
                        {/* Quoted Reply Preview inside bubble */}
                        {hasReply ? (
                          <View
                            style={[
                              styles.quotedBubbleWrap,
                              isMine ? styles.quotedBubbleWrapMine : styles.quotedBubbleWrapOther,
                            ]}
                          >
                            <View style={styles.quotedBar} />
                            <View style={styles.quotedContent}>
                              <Text
                                style={[
                                  styles.quotedSenderText,
                                  isMine ? { color: '#ffffff' } : { color: '#0284c7' },
                                ]}
                                numberOfLines={1}
                              >
                                {msg.replyToSender || 'Resident'}
                              </Text>
                              <Text
                                style={[
                                  styles.quotedSnippetText,
                                  isMine ? { color: 'rgba(255,255,255,0.85)' } : { color: colors.textMuted },
                                ]}
                                numberOfLines={2}
                              >
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
                              tint={isMine ? '#ffffff' : '#0284c7'}
                            />
                          </View>
                        )}

                        {/* File / Document attachment */}
                        {msg.mediaType === 'FILE' && !!msg.mediaUri && (
                          <TouchableOpacity
                            style={[styles.fileCard, isMine && styles.fileCardMine]}
                            activeOpacity={0.8}
                            onPress={() => msg.mediaUri && Linking.openURL(msg.mediaUri)}
                          >
                            <Ionicons
                              name="document-text"
                              size={24}
                              color={isMine ? '#ffffff' : '#0284c7'}
                              style={{ marginRight: 8 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.fileName, isMine && { color: '#ffffff' }]} numberOfLines={1}>
                                {msg.fileName || 'Attachment Document'}
                              </Text>
                              {!!msg.fileSize && (
                                <Text style={[styles.fileSize, isMine && { color: 'rgba(255,255,255,0.8)' }]}>
                                  {formatFileSize(msg.fileSize)}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        )}

                        {/* Text body */}
                        {!!msg.text && (
                          <Text style={[styles.msgText, isMine && { color: '#ffffff' }]}>
                            {msg.text}
                          </Text>
                        )}

                        <Text style={[styles.msgTime, isMine && { color: 'rgba(255,255,255,0.7)' }]}>
                          {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Replying-To Floating Bar */}
            {replyingTo && (
              <View style={[styles.replyBanner, { backgroundColor: isDark ? '#1e293b' : '#e0f2fe' }]}>
                <View style={styles.replyBannerLeft}>
                  <Ionicons name="return-down-forward" size={18} color="#0284c7" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.replyBannerSender, { color: '#0284c7' }]} numberOfLines={1}>
                      Replying to {replyingTo.senderName || 'Resident'}
                    </Text>
                    <Text style={[styles.replyBannerSnippet, { color: colors.text }]} numberOfLines={1}>
                      {replyingTo.text || (replyingTo.mediaType === 'IMAGE' ? '📷 Photo' : replyingTo.mediaType === 'AUDIO' ? '🎤 Voice note' : '📄 File attachment')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyBannerClose}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {/* Composer */}
            {voiceRecorder.isRecording ? (
              <View style={styles.composerRow}>
                <TouchableOpacity onPress={voiceRecorder.cancelRecording} style={styles.composerIconBtn}>
                  <Ionicons name="trash" size={22} color={colors.danger} />
                </TouchableOpacity>
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording… {formatRecordingTime(voiceRecorder.elapsedSec)}</Text>
                </View>
                <TouchableOpacity onPress={handleSendVoiceNote} style={styles.sendButton}>
                  <Ionicons name="checkmark" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.composerRow}>
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
                    onPress={voiceRecorder.startRecording}
                    style={styles.sendButton}
                  >
                    <Ionicons name="mic" size={20} color="#ffffff" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Message Options Action Sheet */}
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

                  {/* Reply Action */}
                  <TouchableOpacity
                    style={styles.actionModalItem}
                    onPress={() => actionMessage && handleStartReply(actionMessage)}
                  >
                    <View style={[styles.actionIconCircle, { backgroundColor: '#e0f2fe' }]}>
                      <Ionicons name="arrow-undo" size={18} color="#0284c7" />
                    </View>
                    <Text style={[styles.actionModalItemText, { color: colors.text }]}>Reply to message</Text>
                  </TouchableOpacity>

                  {/* Copy Text Action */}
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

                  {/* Delete Message Action */}
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
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Attachment Bottom Sheet */}
      <AttachmentSheet
        visible={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
        onSelect={handleAttachment}
      />

      {/* Fullscreen Photo Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.fullscreenBackdrop}>
          <SafeAreaView style={styles.fullscreenCloseWrap}>
            <TouchableOpacity
              onPress={() => setPreviewImage(null)}
              style={styles.fullscreenCloseBtn}
            >
              <Ionicons name="close" size={26} color="#ffffff" />
            </TouchableOpacity>
          </SafeAreaView>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
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
      paddingBottom: 14,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    subTitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      marginLeft: 8,
      padding: 0,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    chipTextActive: {
      color: '#ffffff',
      fontWeight: '800',
    },
    listContent: {
      padding: 16,
      paddingBottom: 40,
    },
    residentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    residentCardUnread: {
      borderColor: 'rgba(16, 185, 129, 0.45)',
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.04)',
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    avatarText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
    },
    residentInfo: {
      flex: 1,
      marginRight: 8,
    },
    residentName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    residentNameBold: {
      fontWeight: '900',
    },
    ownerBadge: {
      backgroundColor: 'rgba(2, 132, 199, 0.12)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
      marginLeft: 6,
    },
    ownerBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.primary,
    },
    residentLastMsg: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 3,
    },
    cardRightCol: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    lastMsgTime: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
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
    emptyContainer: {
      alignItems: 'center',
      marginTop: 48,
      paddingHorizontal: 24,
    },
    emptyIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 4,
    },
    emptySub: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },

    // 1-ON-1 CHAT MODAL STYLES
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    chatHeaderCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginLeft: 6,
    },
    chatAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chatAvatarText: {
      color: '#ffffff',
      fontWeight: '800',
      fontSize: 14,
    },
    chatHeaderName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    chatHeaderSub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    chatCallBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(22, 163, 74, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    privacyNoticeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 16,
      gap: 6,
    },
    privacyNoticeText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    msgRow: {
      marginVertical: 4,
      flexDirection: 'row',
    },
    msgRowMine: {
      justifyContent: 'flex-end',
    },
    msgRowOther: {
      justifyContent: 'flex-start',
    },
    msgBubble: {
      maxWidth: '78%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
    },
    msgBubbleMine: {
      backgroundColor: '#0284c7',
      borderBottomRightRadius: 2,
    },
    msgBubbleOther: {
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      borderBottomLeftRadius: 2,
    },
    quotedBubbleWrap: {
      flexDirection: 'row',
      borderRadius: 8,
      padding: 6,
      marginBottom: 6,
      gap: 6,
    },
    quotedBubbleWrapMine: {
      backgroundColor: 'rgba(0,0,0,0.2)',
    },
    quotedBubbleWrapOther: {
      backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
    },
    quotedBar: {
      width: 3,
      backgroundColor: '#38bdf8',
      borderRadius: 2,
    },
    quotedContent: {
      flex: 1,
    },
    quotedSenderText: {
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 2,
    },
    quotedSnippetText: {
      fontSize: 12,
    },
    msgText: {
      fontSize: 14,
      color: colors.text,
    },
    msgTime: {
      fontSize: 10,
      color: colors.textMuted,
      alignSelf: 'flex-end',
      marginTop: 4,
    },
    mediaThumb: {
      width: 200,
      height: 180,
      borderRadius: 12,
    },
    fileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.06)',
      marginBottom: 4,
      minWidth: 180,
      maxWidth: 220,
    },
    fileCardMine: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    fileName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    fileSize: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },

    // Quoted reply banner
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    replyBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      marginRight: 8,
    },
    replyBannerSender: {
      fontSize: 12,
      fontWeight: '700',
    },
    replyBannerSnippet: {
      fontSize: 11,
      marginTop: 1,
    },
    replyBannerClose: {
      padding: 4,
    },

    // Composer
    composerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 10,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    composerIconBtn: {
      padding: 6,
      marginRight: 4,
    },
    textInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 15,
      color: colors.text,
      marginRight: 8,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#0284c7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    recordingIndicator: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 8,
    },
    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.danger,
      marginRight: 8,
    },
    recordingText: {
      fontSize: 14,
      color: colors.text,
    },

    // Options Modal
    actionModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    actionModalSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 28,
    },
    actionModalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#94a3b8',
      alignSelf: 'center',
      marginBottom: 14,
    },
    actionModalTitle: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 14,
    },
    actionModalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 12,
    },
    actionIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionModalItemText: {
      fontSize: 14,
      fontWeight: '600',
    },

    fullscreenBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.94)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullscreenCloseWrap: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
    },
    fullscreenCloseBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullscreenImage: {
      width: '92%',
      height: '75%',
      borderRadius: 12,
    },
  });
