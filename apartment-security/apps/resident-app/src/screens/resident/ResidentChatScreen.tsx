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
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';
import { copyToClipboard } from '../../utils/clipboard';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import VoiceMessagePlayer from '../../components/community/VoiceMessagePlayer';
import AttachmentSheet from '../../components/community/AttachmentSheet';
import { ListSkeleton } from '../../components/SkeletonLoader';

export interface ChatContact {
  id: string;
  userId: string;
  name: string;
  type: 'RESIDENT' | 'GUARD' | 'MANAGER' | 'COMMITTEE';
  roleLabel: string;
  unitOrLocation?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary?: boolean;
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

export default function ResidentChatScreen({
  navigation,
  route,
}: {
  navigation?: any;
  route?: any;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { userId, userProfile } = useAuth();
  const socket = useSocket();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [conversationsSummary, setConversationsSummary] = useState<Record<string, { lastMessage: DirectMessageItem; unreadCount: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'RESIDENTS' | 'GUARDS' | 'COMMITTEE'>('ALL');

  // Direct 1-on-1 Chat States
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
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

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Scroll to bottom whenever keyboard shows up
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load Contacts & Conversations Summary
  const fetchContacts = useCallback(async () => {
    try {
      const [membersRes, hubRes, convsRes] = await Promise.allSettled([
        api.get('/community/members'),
        api.get('/community/hub'),
        api.get('/community/dm/summary/conversations'),
      ]);

      const allContacts: ChatContact[] = [];

      // Add Residents
      if (membersRes.status === 'fulfilled' && membersRes.value.data?.data) {
        const residents = membersRes.value.data.data;
        residents.forEach((r: any) => {
          if (r.userId === userId || r.id === userId) return;
          const unitStr = r.unit ? `${r.unit.tower ? `${r.unit.tower} • ` : ''}Flat ${r.unit.unitNumber}` : 'Resident';
          allContacts.push({
            id: r.id,
            userId: r.userId || r.id,
            name: r.name,
            type: 'RESIDENT',
            roleLabel: r.residentType || (r.isPrimary ? 'Owner' : 'Resident'),
            unitOrLocation: unitStr,
            phone: r.phone,
            email: r.email,
            isPrimary: r.isPrimary,
          });
        });
      }

      // Add Guards & Committee
      if (hubRes.status === 'fulfilled' && hubRes.value.data?.data) {
        const hub = hubRes.value.data.data;
        if (hub.guards) {
          hub.guards.forEach((g: any) => {
            if (g.userId === userId) return;
            allContacts.push({
              id: g.id,
              userId: g.userId || g.id,
              name: g.name,
              type: 'GUARD',
              roleLabel: `Security Guard • ${g.gate || 'Main Gate'}`,
              unitOrLocation: g.gate || 'Security Station',
              phone: g.phone,
            });
          });
        }
        if (hub.committee) {
          hub.committee.forEach((c: any) => {
            if (c.userId === userId) return;
            allContacts.push({
              id: c.id,
              userId: c.userId || c.id,
              name: c.name,
              type: 'COMMITTEE',
              roleLabel: c.role || 'Management Committee',
              unitOrLocation: c.unit || 'Office',
              phone: c.phone,
              email: c.email,
            });
          });
        }
      }

      setContacts(allContacts);

      // Parse conversations summary
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

      // If routed with initial partner params
      if (route?.params?.initialPartnerId) {
        const found = allContacts.find((c) => c.userId === route.params.initialPartnerId || c.id === route.params.initialPartnerId);
        if (found) {
          openChatWith(found);
        } else if (route.params.initialPartnerName) {
          openChatWith({
            id: route.params.initialPartnerId,
            userId: route.params.initialPartnerId,
            name: route.params.initialPartnerName,
            type: 'RESIDENT',
            roleLabel: 'Resident',
            unitOrLocation: route.params.initialPartnerUnit || 'Resident',
          });
        }
      }
    } catch (err) {
      console.log('Error fetching chat contacts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, route?.params]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const openChatWith = (contact: ChatContact) => {
    setActiveContact(contact);
    // Clear unread badge locally for this partner
    setConversationsSummary((prev) => {
      const targetKey = prev[contact.userId] ? contact.userId : contact.id;
      if (!prev[targetKey]) return prev;
      return {
        ...prev,
        [targetKey]: {
          ...prev[targetKey]!,
          unreadCount: 0,
        },
      };
    });
    // Inform API that messages were read
    api.post(`/community/dm/${contact.userId || contact.id}/read`).catch(() => {});
  };

  // Load chat history when opening activeContact
  const loadChatHistory = useCallback(async (contactUserId: string) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/community/dm/${contactUserId}`);
      if (res.data?.data) {
        setMessages(res.data.data);
      }
    } catch (err) {
      console.log('Error loading DM history:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeContact) {
      loadChatHistory(activeContact.userId);
    } else {
      setMessages([]);
      setReplyingTo(null);
    }
  }, [activeContact, loadChatHistory]);

  // Real-time socket message & deletion & read handlers
  useEffect(() => {
    if (!socket) return;

    const handleDmMessage = (incomingMsg: DirectMessageItem) => {
      const isForActiveChat =
        activeContact &&
        (incomingMsg.senderId === activeContact.userId ||
          incomingMsg.recipientId === activeContact.userId ||
          incomingMsg.senderId === activeContact.id ||
          incomingMsg.recipientId === activeContact.id);

      if (isForActiveChat) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incomingMsg.id)) return prev;
          return [...prev, incomingMsg];
        });
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        api.post(`/community/dm/${activeContact.userId}/read`).catch(() => {});
      }

      // Update conversations summary live
      const partnerId = incomingMsg.senderId === userId ? incomingMsg.recipientId : incomingMsg.senderId;
      const isUnread = incomingMsg.senderId !== userId && !isForActiveChat;

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
  }, [socket, activeContact, userId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchContacts();
  };

  const dialPhone = (num?: string | null) => {
    if (!num) {
      Alert.alert('Phone Unavailable', 'No contact phone number on record.');
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

  const filteredContacts = useMemo(() => {
    const list = contacts.filter((c) => {
      const query = searchText.toLowerCase().trim();
      const nameMatch = c.name.toLowerCase().includes(query);
      const unitMatch = c.unitOrLocation ? c.unitOrLocation.toLowerCase().includes(query) : false;
      const roleMatch = c.roleLabel.toLowerCase().includes(query);

      if (query && !nameMatch && !unitMatch && !roleMatch) return false;

      if (selectedFilter === 'RESIDENTS') return c.type === 'RESIDENT';
      if (selectedFilter === 'GUARDS') return c.type === 'GUARD';
      if (selectedFilter === 'COMMITTEE') return c.type === 'COMMITTEE' || c.type === 'MANAGER';
      return true;
    });

    // Sort WhatsApp style: active conversations and unread messages first
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
  }, [contacts, searchText, selectedFilter, conversationsSummary]);

  const sendTextMessage = async () => {
    if (!chatInput.trim() || !activeContact) return;
    const textToSend = chatInput.trim();
    setChatInput('');

    const currentReply = replyingTo;
    setReplyingTo(null);

    // Optimistic UI update
    const optimisticMsg: DirectMessageItem = {
      id: `dm_opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: userId || 'me',
      senderName: userProfile?.name || 'Me',
      senderRole: 'RESIDENT',
      senderUnit: userProfile?.flat ? `Flat ${userProfile.flat}` : undefined,
      recipientId: activeContact.userId,
      text: textToSend,
      replyToId: currentReply?.id || undefined,
      replyToText: currentReply ? (currentReply.text || (currentReply.mediaType === 'IMAGE' ? 'Photo' : currentReply.mediaType === 'AUDIO' ? 'Voice note' : currentReply.mediaType === 'FILE' ? 'Document' : undefined)) : undefined,
      replyToSender: currentReply ? (currentReply.senderName || 'Neighbor') : undefined,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setConversationsSummary((prev) => ({
      ...prev,
      [activeContact.userId]: {
        lastMessage: optimisticMsg,
        unreadCount: 0,
      },
      [activeContact.id]: {
        lastMessage: optimisticMsg,
        unreadCount: 0,
      },
    }));
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await api.post(`/community/dm/${activeContact.userId}`, {
        text: textToSend,
        replyToId: optimisticMsg.replyToId,
        replyToText: optimisticMsg.replyToText,
        replyToSender: optimisticMsg.replyToSender,
      });
      if (res.data?.data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? res.data.data : m))
        );
        setConversationsSummary((prev) => ({
          ...prev,
          [activeContact.userId]: {
            lastMessage: res.data.data,
            unreadCount: 0,
          },
          [activeContact.id]: {
            lastMessage: res.data.data,
            unreadCount: 0,
          },
        }));
      }
    } catch (err) {
      console.log('Error sending direct message:', err);
    }
  };

  const handleSendVoiceNote = async () => {
    if (!activeContact) return;
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

      const res = await api.post(`/community/dm/${activeContact.userId}`, {
        mediaType: 'AUDIO',
        mediaUri: audioUrl,
        durationSec: recorded.durationSec || 0,
        fileName: 'Voice note.m4a',
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
      Alert.alert('Voice Note Failed', 'Could not upload or send voice recording.');
    }
  };

  const handlePickImage = async (fromCamera = false) => {
    setAttachmentOpen(false);
    if (!activeContact) return;
    const currentReply = replyingTo;
    setReplyingTo(null);

    try {
      let result;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsEditing: true });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
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

        const res = await api.post(`/community/dm/${activeContact.userId}`, {
          mediaType: 'IMAGE',
          mediaUri: imgUrl,
          fileName: asset.fileName || 'Photo.jpg',
          fileSize: asset.fileSize,
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
      }
    } catch (err) {
      Alert.alert('Photo Failed', 'Could not upload or send selected photo.');
    }
  };

  const handlePickDocument = async () => {
    setAttachmentOpen(false);
    if (!activeContact) return;
    const currentReply = replyingTo;
    setReplyingTo(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as any);

        const uploadRes = await api.post('/community/uploads', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const fileUrl = uploadRes.data?.data?.url || file.uri;

        const res = await api.post(`/community/dm/${activeContact.userId}`, {
          mediaType: 'FILE',
          mediaUri: fileUrl,
          fileName: file.name,
          fileSize: file.size,
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
      }
    } catch (err) {
      Alert.alert('Document Failed', 'Could not upload or send selected file.');
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
            if (activeContact) {
              try {
                await api.delete(`/community/dm/${activeContact.userId}/${msg.id}`);
              } catch (err) {
                console.log('Error deleting direct message:', err);
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

  // --- RENDER 1-ON-1 DIRECT CHAT VIEW ---
  if (activeContact) {
    const contactColor = AVATAR_COLORS[Math.abs(activeContact.name.charCodeAt(0)) % AVATAR_COLORS.length]!;

    return (
      <SafeAreaView style={styles.safeContainer} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                setActiveContact(null);
                setReplyingTo(null);
              }}
              accessibilityLabel="Back to directory"
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            <View style={[styles.avatarCircleSmall, { backgroundColor: contactColor }]}>
              <Text style={styles.avatarTextSmall}>{getInitials(activeContact.name)}</Text>
            </View>

            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName} numberOfLines={1}>
                {activeContact.name}
              </Text>
              <Text style={styles.chatHeaderSub} numberOfLines={1}>
                {activeContact.unitOrLocation || activeContact.roleLabel}
              </Text>
            </View>

            {activeContact.phone && (
              <TouchableOpacity
                style={styles.phoneHeaderBtn}
                onPress={() => dialPhone(activeContact.phone)}
                accessibilityLabel="Call contact"
              >
                <Ionicons name="call" size={18} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Messages Feed */}
          {loadingMessages ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            >
              <View style={styles.encryptionNotice}>
                <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                <Text style={styles.encryptionNoticeText}>
                  Private 1-on-1 direct conversation with {activeContact.name}. Tap and hold any message to reply or delete.
                </Text>
              </View>

              {messages.length === 0 ? (
                <View style={styles.emptyMessagesBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={44} color={colors.textMuted} />
                  <Text style={styles.emptyMessagesTitle}>No messages yet</Text>
                  <Text style={styles.emptyMessagesSub}>
                    Say hello or send a personal note to {activeContact.name}.
                  </Text>
                </View>
              ) : (
                messages.map((item, index) => {
                  const isMine = item.senderId === userId || item.senderId === 'me';
                  const hasReply = Boolean(item.replyToId && item.replyToText);
                  return (
                    <View
                      key={item.id ? `${item.id}_${index}` : `dm_${index}`}
                      style={[
                        styles.messageRow,
                        isMine ? styles.messageRowMine : styles.messageRowTheirs,
                      ]}
                    >
                      <Pressable
                        onLongPress={() => setActionMessage(item)}
                        delayLongPress={300}
                        style={({ pressed }) => [
                          styles.messageBubble,
                          isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs,
                          pressed && { opacity: 0.88 },
                        ]}
                      >
                        {/* Quoted Reply Preview inside bubble (only when replyToId exists) */}
                        {hasReply ? (
                          <View
                            style={[
                              styles.quotedBubbleWrap,
                              isMine ? styles.quotedBubbleWrapMine : styles.quotedBubbleWrapTheirs,
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
                                {item.replyToSender || 'Neighbor'}
                              </Text>
                              <Text
                                style={[
                                  styles.quotedSnippetText,
                                  isMine ? { color: 'rgba(255,255,255,0.85)' } : { color: colors.textMuted },
                                ]}
                                numberOfLines={2}
                              >
                                {item.replyToText}
                              </Text>
                            </View>
                          </View>
                        ) : null}

                        {/* Text */}
                        {item.text ? (
                          <Text
                            style={[
                              styles.messageText,
                              isMine ? styles.messageTextMine : styles.messageTextTheirs,
                            ]}
                          >
                            {item.text}
                          </Text>
                        ) : null}

                        {/* Photo / Image */}
                        {item.mediaType === 'IMAGE' && item.mediaUri ? (
                          <TouchableOpacity
                            onPress={() => setPreviewImage(item.mediaUri!)}
                            activeOpacity={0.9}
                            style={styles.imageWrap}
                          >
                            <Image source={{ uri: item.mediaUri }} style={styles.chatImage} />
                            <View style={styles.imageOverlayBadge}>
                              <Ionicons name="expand" size={14} color="#ffffff" />
                            </View>
                          </TouchableOpacity>
                        ) : null}

                        {/* Voice Note */}
                        {item.mediaType === 'AUDIO' && item.mediaUri ? (
                          <VoiceMessagePlayer
                            uri={item.mediaUri}
                            fallbackDurationSec={item.durationSec}
                            tint={isMine ? '#ffffff' : colors.primary}
                          />
                        ) : null}

                        {/* Document File */}
                        {item.mediaType === 'FILE' && (
                          <TouchableOpacity
                            style={[
                              styles.docCard,
                              isMine ? styles.docCardMine : styles.docCardTheirs,
                            ]}
                            onPress={() => item.mediaUri && Linking.openURL(item.mediaUri)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="document-text"
                              size={28}
                              color={isMine ? '#ffffff' : colors.primary}
                            />
                            <View style={styles.docInfo}>
                              <Text
                                style={[
                                  styles.docName,
                                  isMine ? styles.docNameMine : styles.docNameTheirs,
                                ]}
                                numberOfLines={1}
                              >
                                {item.fileName || 'Attachment'}
                              </Text>
                              <Text
                                style={[
                                  styles.docSize,
                                  isMine ? styles.docSizeMine : styles.docSizeTheirs,
                                ]}
                              >
                                {formatFileSize(item.fileSize)} • Tap to open
                              </Text>
                            </View>
                            <Ionicons
                              name="arrow-down-circle"
                              size={20}
                              color={isMine ? '#ffffff' : colors.textMuted}
                            />
                          </TouchableOpacity>
                        )}

                        <View style={styles.timeAndStatusRow}>
                          <Text
                            style={[
                              styles.messageTime,
                              isMine ? styles.messageTimeMine : styles.messageTimeTheirs,
                            ]}
                          >
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                          {isMine && (
                            <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.75)" style={{ marginLeft: 3 }} />
                          )}
                        </View>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Replying-To Floating Bar */}
          {replyingTo && (
            <View style={[styles.replyBanner, { backgroundColor: isDark ? '#1e293b' : '#e0f2fe' }]}>
              <View style={styles.replyBannerLeft}>
                <Ionicons name="return-down-forward" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.replyBannerSender, { color: colors.primary }]} numberOfLines={1}>
                    Replying to {replyingTo.senderName || 'Neighbor'}
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
          <View
            style={[
              styles.composerBar,
              { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 10) },
            ]}
          >
            {voiceRecorder.isRecording ? (
              <View style={styles.recordingRow}>
                <View style={styles.recordingPulse}>
                  <View style={styles.recordingDot} />
                </View>
                <Text style={styles.recordingTime}>
                  {formatRecordingTime(voiceRecorder.elapsedSec)}
                </Text>
                <Text style={styles.recordingHint}>Recording audio...</Text>
                <TouchableOpacity
                  style={styles.cancelRecBtn}
                  onPress={voiceRecorder.cancelRecording}
                >
                  <Text style={styles.cancelRecText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sendRecBtn}
                  onPress={handleSendVoiceNote}
                >
                  <Ionicons name="checkmark" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.inputRow}>
                <TouchableOpacity
                  style={styles.attachBtn}
                  onPress={() => setAttachmentOpen(true)}
                  accessibilityLabel="Attach media or files"
                >
                  <Ionicons name="add-circle" size={26} color="#0284c7" />
                </TouchableOpacity>

                <TextInput
                  ref={textInputRef}
                  style={styles.textInput}
                  placeholder={`Message ${activeContact.name.split(' ')[0]}...`}
                  placeholderTextColor={colors.textMuted}
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  maxLength={1000}
                />

                {chatInput.trim().length > 0 ? (
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={sendTextMessage}
                    accessibilityLabel="Send message"
                  >
                    <Ionicons name="send" size={18} color="#ffffff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.micBtn}
                    onPress={voiceRecorder.startRecording}
                    accessibilityLabel="Record voice message"
                  >
                    <Ionicons name="mic" size={20} color="#ffffff" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Message Actions Modal (Reply, Copy, Delete) */}
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

          {/* Attachment Modal */}
          <AttachmentSheet
            visible={attachmentOpen}
            onClose={() => setAttachmentOpen(false)}
            onSelect={(action: 'camera' | 'gallery' | 'document' | 'poll') => {
              if (action === 'camera') handlePickImage(true);
              else if (action === 'gallery') handlePickImage(false);
              else if (action === 'document') handlePickDocument();
            }}
          />

          {/* Full-Screen Image Viewer */}
          <Modal
            visible={!!previewImage}
            transparent
            animationType="fade"
            onRequestClose={() => setPreviewImage(null)}
          >
            <View style={styles.modalBg}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPreviewImage(null)}
              >
                <Ionicons name="close-circle" size={32} color="#ffffff" />
              </TouchableOpacity>
              {previewImage && (
                <Image
                  source={{ uri: previewImage }}
                  style={styles.modalFullImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- RENDER RESIDENT & GUARD DIRECTORY LIST ---
  return (
    <SafeAreaView style={styles.safeContainer} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {navigation?.goBack && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.goBack()}
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.headerTitle}>Resident & Guard Chat</Text>
              <Text style={styles.headerSubtitle}>
                1-on-1 private messaging with neighbors & security
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search neighbor, flat, tower, guard..."
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            clearButtonMode="while-editing"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'RESIDENTS', label: 'Neighbors' },
              { key: 'GUARDS', label: 'Security Guards' },
              { key: 'COMMITTEE', label: 'Committee' },
            ] as const
          ).map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.filterChip,
                selectedFilter === chip.key && styles.filterChipActive,
              ]}
              onPress={() => setSelectedFilter(chip.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === chip.key && styles.filterChipTextActive,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Directory List */}
        {loading ? (
          <View style={styles.skeletonContainer}>
            <ListSkeleton count={6} />
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.userId || item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyStateTitle}>No members found</Text>
                <Text style={styles.emptyStateSub}>
                  {searchText
                    ? 'No resident, guard, or committee member matched your search.'
                    : 'The community directory is currently empty.'}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length]!;
              const isGuard = item.type === 'GUARD';
              const isCommittee = item.type === 'COMMITTEE';
              const conv = conversationsSummary[item.userId] || conversationsSummary[item.id];
              const lastMsg = conv?.lastMessage;
              const unreadCount = conv?.unreadCount || 0;

              let lastMsgSnippet = item.unitOrLocation || item.roleLabel;
              if (lastMsg) {
                const isMine = lastMsg.senderId === userId || lastMsg.senderId === 'me';
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
                  style={[styles.contactCard, unreadCount > 0 && styles.contactCardUnread]}
                  onPress={() => openChatWith(item)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
                    <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                  </View>

                  <View style={styles.contactDetails}>
                    <View style={styles.contactNameRow}>
                      <Text style={[styles.contactName, unreadCount > 0 && styles.contactNameBold]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.isPrimary && (
                        <View style={styles.ownerBadge}>
                          <Text style={styles.ownerBadgeText}>Owner</Text>
                        </View>
                      )}
                      {isGuard && (
                        <View style={styles.guardBadge}>
                          <Ionicons name="shield-checkmark" size={11} color="#059669" />
                          <Text style={styles.guardBadgeText}>Security</Text>
                        </View>
                      )}
                      {isCommittee && (
                        <View style={styles.committeeBadge}>
                          <Text style={styles.committeeBadgeText}>Committee</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.contactMetaRow}>
                      <Text
                        style={[
                          styles.contactLastMsg,
                          unreadCount > 0 && { color: colors.text, fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {lastMsgSnippet}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.contactRightCol}>
                    {lastMsg ? (
                      <Text style={[styles.lastMsgTime, unreadCount > 0 && { color: '#10b981', fontWeight: '800' }]}>
                        {formatMessageTime(lastMsg.createdAt)}
                      </Text>
                    ) : null}

                    <View style={styles.rightColActions}>
                      {unreadCount > 0 ? (
                        <View style={styles.unreadBadgePill}>
                          <Text style={styles.unreadBadgePillText}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </Text>
                        </View>
                      ) : null}

                      {item.phone && (
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => dialPhone(item.phone)}
                          accessibilityLabel="Call"
                        >
                          <Ionicons name="call-outline" size={15} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    safeContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backBtn: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      marginHorizontal: 16,
      marginVertical: 8,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 10,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    filterChipTextActive: {
      color: '#ffffff',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 10,
    },
    skeletonContainer: {
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    contactCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    contactCardUnread: {
      borderColor: '#10b98140',
      backgroundColor: isDark ? '#064e3b15' : '#ecfdf560',
    },
    avatarCircle: {
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
    contactDetails: {
      flex: 1,
      justifyContent: 'center',
    },
    contactNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 3,
    },
    contactName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    contactNameBold: {
      fontWeight: '900',
    },
    ownerBadge: {
      backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    ownerBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#059669',
    },
    guardBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    guardBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#059669',
    },
    committeeBadge: {
      backgroundColor: isDark ? '#4c1d95' : '#f5f3ff',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    committeeBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#7c3aed',
    },
    contactMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    contactLastMsg: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '500',
    },
    contactUnit: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '500',
    },
    contactRightCol: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 6,
    },
    lastMsgTime: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },
    rightColActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    unreadBadgePill: {
      backgroundColor: '#10b981',
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    unreadBadgePillText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
    },
    actionButtonsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconActionBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      justifyContent: 'center',
      alignItems: 'center',
    },
    chatActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
    },
    chatActionBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      gap: 8,
    },
    emptyStateTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    emptyStateSub: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: 32,
    },

    // --- Active 1-on-1 Chat Styles ---
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
      gap: 10,
    },
    avatarCircleSmall: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarTextSmall: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
    },
    chatHeaderInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    chatHeaderName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    chatHeaderSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    phoneHeaderBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#10b981',
      justifyContent: 'center',
      alignItems: 'center',
    },
    messagesList: {
      flex: 1,
      backgroundColor: isDark ? '#090d16' : '#f8fafc',
    },
    messagesScrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
    },
    encryptionNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: isDark ? '#1e293b80' : '#e2e8f080',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 16,
      alignSelf: 'center',
    },
    encryptionNoticeText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },
    emptyMessagesBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      gap: 8,
    },
    emptyMessagesTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    emptyMessagesSub: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: 30,
    },
    messageRow: {
      marginVertical: 4,
      flexDirection: 'row',
    },
    messageRowMine: {
      justifyContent: 'flex-end',
    },
    messageRowTheirs: {
      justifyContent: 'flex-start',
    },
    messageBubble: {
      maxWidth: '82%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 18,
    },
    messageBubbleMine: {
      backgroundColor: '#0284c7',
      borderBottomRightRadius: 4,
    },
    messageBubbleTheirs: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderBottomLeftRadius: 4,
      borderWidth: isDark ? 0 : 1,
      borderColor: colors.border,
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
    quotedBubbleWrapTheirs: {
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
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    messageTextMine: {
      color: '#ffffff',
    },
    messageTextTheirs: {
      color: colors.text,
    },
    imageWrap: {
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
      marginVertical: 4,
    },
    chatImage: {
      width: 220,
      height: 160,
      borderRadius: 12,
    },
    imageOverlayBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: '#00000080',
      padding: 4,
      borderRadius: 6,
    },
    docCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 12,
      gap: 10,
      marginVertical: 4,
    },
    docCardMine: {
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    docCardTheirs: {
      backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
    },
    docInfo: {
      flex: 1,
    },
    docName: {
      fontSize: 13,
      fontWeight: '600',
    },
    docNameMine: {
      color: '#ffffff',
    },
    docNameTheirs: {
      color: colors.text,
    },
    docSize: {
      fontSize: 11,
      marginTop: 2,
    },
    docSizeMine: {
      color: 'rgba(255,255,255,0.7)',
    },
    docSizeTheirs: {
      color: colors.textMuted,
    },
    timeAndStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      marginTop: 4,
    },
    messageTime: {
      fontSize: 10,
    },
    messageTimeMine: {
      color: 'rgba(255,255,255,0.75)',
    },
    messageTimeTheirs: {
      color: colors.textMuted,
    },

    // Replying-To Floating Bar
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 10,
    },
    replyBannerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    replyBannerSender: {
      fontSize: 12,
      fontWeight: '700',
    },
    replyBannerSnippet: {
      fontSize: 12,
      marginTop: 1,
    },
    replyBannerClose: {
      padding: 4,
    },

    // Composer Bar
    composerBar: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 10,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    attachBtn: {
      padding: 4,
    },
    textInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 14,
      color: colors.text,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#0284c7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    micBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#0284c7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    recordingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      gap: 10,
    },
    recordingPulse: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#fee2e2',
      justifyContent: 'center',
      alignItems: 'center',
    },
    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#ef4444',
    },
    recordingTime: {
      fontSize: 14,
      fontWeight: '700',
      color: '#ef4444',
    },
    recordingHint: {
      flex: 1,
      fontSize: 13,
      color: colors.textMuted,
    },
    cancelRecBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    cancelRecText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    sendRecBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#10b981',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Action Modal
    actionModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    actionModalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 32,
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
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 16,
    },
    actionModalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(150,150,150,0.15)',
      gap: 14,
    },
    actionIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionModalItemText: {
      fontSize: 15,
      fontWeight: '600',
    },

    // Modal Image
    modalBg: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCloseBtn: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 10,
    },
    modalFullImage: {
      width: '94%',
      height: '80%',
    },
  });
