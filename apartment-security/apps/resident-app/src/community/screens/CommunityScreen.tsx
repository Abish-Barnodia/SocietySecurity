import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api, { API_URL } from '../../utils/api';
import * as SecureStore from 'expo-secure-store';
import io, { Socket } from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'react-native';
import { Audio } from 'expo-av';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  unitNumber?: string | null;
  status?: 'sending' | 'sent';
  type?: 'TEXT' | 'POLL' | 'ALERT';
  metadata?: any;
  replyToId?: string | null;
  isPinned?: boolean;
  isEdited?: boolean;
}

export default function CommunityScreen() {
  const { colors, isDarkMode } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedActionMessage, setSelectedActionMessage] = useState<Message | null>(null);
  const [selectedProfileMessage, setSelectedProfileMessage] = useState<Message | null>(null);
  const { userId: currentUserId, userRole } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages();
    setupSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await api.get('/community/messages');
      if (response.data.status === 'success') {
        setMessages(response.data.data.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupSocket = async () => {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) return;

    // Connect to Socket.io namespace
    // Extract base URL from API_URL (remove /api/v1)
    const baseUrl = API_URL.replace('/api/v1', '');
    
    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Community socket connected');
    });

    socket.on('new_community_message', (message: Message) => {
      setMessages(prev => {
        // Prevent duplicate if we already optimistically added it
        if (!prev.find(m => m.id === message.id)) {
          return [{ ...message, status: 'sent' }, ...prev];
        }
        return prev;
      });
    });

    socket.on('delete_community_message', (deletedId: string) => {
      setMessages(prev => prev.filter(m => m.id !== deletedId));
    });

    socket.on('poll_voted', ({ messageId, metadata }: { messageId: string, metadata: any }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, metadata } : m));
    });

    socket.on('message_updated', ({ messageId, updates }: { messageId: string, updates: any }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updates } : m));
    });

    socketRef.current = socket;
  };

  const handlePickMedia = async (mediaType: 'image' | 'document' | 'audio') => {
    let uri = '';
    let name = '';
    let mimeType = '';

    setShowAttachModal(false);

    if (mediaType === 'image') {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.5,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      uri = result.assets[0].uri;
      name = result.assets[0].fileName || 'media.jpg';
      mimeType = result.assets[0].mimeType || 'image/jpeg';
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      uri = result.assets[0].uri;
      name = result.assets[0].name;
      mimeType = result.assets[0].mimeType || 'application/octet-stream';
    }

    const formData = new FormData();
    formData.append('media', {
      uri,
      name,
      type: mimeType,
    } as any);

    if (replyingTo) {
      formData.append('replyToId', replyingTo.id);
      setReplyingTo(null);
    }

    try {
      // Optimistic logic is hard for media upload, so we just show loading or wait
      await api.post('/community/messages/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // The socket will broadcast the new message back to us
    } catch (error) {
      console.error('Error uploading media:', error);
      Alert.alert('Error', 'Failed to upload media');
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(recording);
      } else {
        Alert.alert('Permission to access microphone is required!');
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopAndSendRecording = async () => {
    if (!recording) return;
    setRecording(null);
    setShowRecordModal(false);
    
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    
    const uri = recording.getURI();
    if (uri) {
      const formData = new FormData();
      formData.append('media', {
        uri,
        name: `voice-note-${Date.now()}.m4a`,
        type: 'audio/m4a',
      } as any);

      if (replyingTo) {
        formData.append('replyToId', replyingTo.id);
        setReplyingTo(null);
      }

      try {
        await api.post('/community/messages/media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (error) {
        console.error('Error uploading voice note:', error);
        Alert.alert('Error', 'Failed to upload voice note');
      }
    }
  };

  const handleSend = async () => {
    if (!content.trim() || !currentUserId) return;

    const messageContent = content.trim();
    setContent('');

    if (editingMessage) {
      const editId = editingMessage.id;
      setEditingMessage(null);
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === editId ? { ...m, content: messageContent, isEdited: true } : m));
      try {
        await api.patch(`/community/messages/${editId}`, { content: messageContent });
      } catch (error) {
        console.error('Error editing:', error);
        Alert.alert('Error', 'Failed to edit message');
        fetchMessages();
      }
      return;
    }

    const currentReplyToId = replyingTo?.id || null;
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      content: messageContent,
      createdAt: new Date().toISOString(),
      senderId: currentUserId,
      senderName: '',
      status: 'sending',
      replyToId: currentReplyToId
    };

    setMessages(prev => [optimisticMessage, ...prev]);

    try {
      const res = await api.post('/community/messages', { content: messageContent, replyToId: currentReplyToId });
      setMessages(prev => prev.map(m => m.id === tempId ? { ...res.data.data, status: 'sent' } : m));
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleCreatePoll = async () => {
    const validOptions = pollOptions.filter(o => o.trim().length > 0);
    if (!pollQuestion.trim() || validOptions.length < 2 || !currentUserId) return;

    const formattedOptions = validOptions.map((opt, idx) => ({
      id: `opt-${idx}`,
      text: opt,
      votes: [],
    }));

    const messageContent = pollQuestion.trim();
    setShowPollModal(false);
    setPollQuestion('');
    setPollOptions(['', '']);

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      content: messageContent,
      createdAt: new Date().toISOString(),
      senderId: currentUserId,
      senderName: '',
      status: 'sending',
      type: 'POLL',
      metadata: { options: formattedOptions }
    };

    setMessages(prev => [optimisticMessage, ...prev]);

    try {
      const res = await api.post('/community/messages', { 
        content: messageContent,
        type: 'POLL',
        metadata: { options: formattedOptions }
      });
      setMessages(prev => prev.map(m => m.id === tempId ? { ...res.data.data, status: 'sent' } : m));
    } catch (error) {
      console.error('Error sending poll:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Error', 'Failed to send poll');
    }
  };

  const handleVote = async (messageId: string, optionId: string) => {
    // Optimistic UI update for vote
    setMessages(prev => prev.map(m => {
      if (m.id === messageId && m.type === 'POLL' && m.metadata?.options) {
        const newOptions = m.metadata.options.map((opt: any) => ({
          ...opt,
          votes: opt.votes.filter((id: string) => id !== currentUserId) // remove previous
        })).map((opt: any) => {
          if (opt.id === optionId) {
            return { ...opt, votes: [...opt.votes, currentUserId] };
          }
          return opt;
        });
        return { ...m, metadata: { ...m.metadata, options: newOptions } };
      }
      return m;
    }));

    try {
      await api.post(`/community/messages/${messageId}/vote`, { optionId });
    } catch (error) {
      console.error('Error voting:', error);
      fetchMessages(); // revert on failure
    }
  };

  const handlePin = async (item: Message) => {
    try {
      setMessages(prev => prev.map(m => m.id === item.id ? { ...m, isPinned: !item.isPinned } : m));
      await api.post(`/community/messages/${item.id}/pin`, { isPinned: !item.isPinned });
    } catch (e) {
      fetchMessages();
    }
  };

  const handleDelete = async (item: Message) => {
    try {
      setMessages(prev => prev.filter(m => m.id !== item.id));
      await api.delete(`/community/messages/${item.id}`);
    } catch (error) {
      fetchMessages();
    }
  };

  const handleReact = async (messageId: string, reaction: string) => {
    // Optimistic
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const metadata = { ...m.metadata };
        const reactions = { ...(metadata.reactions || {}) };
        if (!reactions[reaction]) reactions[reaction] = [];
        const idx = reactions[reaction].indexOf(currentUserId);
        if (idx > -1) {
          reactions[reaction] = reactions[reaction].filter((id: string) => id !== currentUserId);
          if (reactions[reaction].length === 0) delete reactions[reaction];
        } else {
          reactions[reaction] = [...reactions[reaction], currentUserId];
        }
        metadata.reactions = reactions;
        return { ...m, metadata };
      }
      return m;
    }));

    try {
      await api.post(`/community/messages/${messageId}/react`, { reaction });
    } catch (error) {
      fetchMessages();
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUserId;

    return (
      <View style={[
        styles.messageBubbleWrapper,
        isMe ? styles.messageMeWrapper : styles.messageOtherWrapper
      ]}>
        {!isMe && (
          <Text style={[styles.senderName, { color: colors.textMuted }]}>
            {item.senderRole === 'COMMITTEE' ? '👑 ' : item.senderRole === 'GUARD' ? '🛡️ ' : item.senderRole === 'MANAGER' ? '🛠️ ' : '🏠 '}
            {item.senderName} {item.unitNumber ? `(${item.unitNumber})` : ''}
          </Text>
        )}
        <TouchableOpacity 
          onLongPress={() => setSelectedActionMessage(item)}
          onPress={() => {
            if (!isMe) setSelectedProfileMessage(item);
          }}
          activeOpacity={0.8}
          style={[
            styles.messageBubble,
            item.type === 'ALERT' ? { backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2', borderColor: '#ef4444', borderWidth: 1 } : 
            isMe ? { backgroundColor: colors.primary } : { backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }
          ]}>
          {item.replyToId && (() => {
            const replyMsg = messages.find(m => m.id === item.replyToId);
            if (!replyMsg) return null;
            return (
              <View style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: 6, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: isMe ? '#fff' : colors.primary }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: isMe ? '#fff' : colors.text }}>{replyMsg.senderName}</Text>
                <Text style={{ fontSize: 12, color: isMe ? '#eee' : colors.textMuted }} numberOfLines={1}>{replyMsg.content}</Text>
              </View>
            );
          })()}
          {item.metadata?.mediaType === 'IMAGE' && item.metadata?.mediaUrl && (
            <Image 
              source={{ uri: API_URL.replace('/api/v1', '') + item.metadata.mediaUrl }} 
              style={{ width: 200, height: 200, borderRadius: 8, marginBottom: 4 }}
              resizeMode="cover"
            />
          )}

          {item.metadata?.mediaType === 'DOCUMENT' && item.metadata?.fileName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', padding: 8, borderRadius: 8, marginBottom: 4 }}>
              <Ionicons name="document-text" size={24} color={isMe ? '#fff' : colors.primary} />
              <Text style={{ marginLeft: 8, color: isMe ? '#fff' : colors.text, flex: 1 }} numberOfLines={1}>{item.metadata.fileName}</Text>
            </View>
          )}

          {item.metadata?.mediaType === 'VOICE' && item.metadata?.mediaUrl && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', padding: 8, borderRadius: 8, marginBottom: 4 }}>
              <Ionicons name="play-circle" size={32} color={isMe ? '#fff' : colors.primary} />
              <View style={{ height: 4, flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', marginHorizontal: 8, borderRadius: 2 }} />
              <Text style={{ fontSize: 12, color: isMe ? '#eee' : colors.textMuted }}>Voice Note</Text>
            </View>
          )}

          <Text style={[
            styles.messageText,
            item.type === 'ALERT' ? { color: isDarkMode ? '#fecaca' : '#991b1b', fontWeight: 'bold' } :
            isMe ? { color: '#ffffff' } : { color: colors.text }
          ]}>
            {item.type === 'ALERT' ? '🚨 ANNOUNCEMENT\n\n' : ''}{item.content}
          </Text>
          
          {item.type === 'POLL' && item.metadata?.options && (
            <View style={styles.pollContainer}>
              {item.metadata.options.map((opt: any) => {
                const totalVotes = item.metadata!.options.reduce((acc: number, o: any) => acc + (o.votes?.length || 0), 0);
                const percentage = totalVotes > 0 ? ((opt.votes?.length || 0) / totalVotes) * 100 : 0;
                const iVoted = (opt.votes || []).includes(currentUserId);
                
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => handleVote(item.id, opt.id)}
                    style={[styles.pollOption, iVoted && { borderColor: colors.primary, borderWidth: 1 }]}
                  >
                    <View style={[styles.pollFill, { width: `${percentage}%`, backgroundColor: iVoted ? colors.primary + '30' : (isDarkMode ? '#4b5563' : '#e5e7eb') }]} />
                    <Text style={{ position: 'relative', zIndex: 1, padding: 10, color: colors.text, fontWeight: iVoted ? 'bold' : 'normal' }}>
                      {opt.text} ({opt.votes?.length || 0})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {item.metadata?.reactions && Object.keys(item.metadata.reactions).length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 }}>
              {Object.entries(item.metadata.reactions).map(([emoji, users]: any) => (
                <TouchableOpacity key={emoji} onPress={() => handleReact(item.id, emoji)} style={{ backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}>{emoji} {users.length}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.timestampContainer}>
            <Text style={[
              styles.timestamp,
              isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: colors.textMuted }
            ]}>
              {item.isPinned ? '📌 ' : ''}{item.isEdited ? '(edited) ' : ''}{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && (
              <Ionicons 
                name={item.status === 'sending' ? 'time-outline' : 'checkmark-done'} 
                size={14} 
                color="rgba(255,255,255,0.7)" 
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface, justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="people" size={24} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Community</Text>
        </View>
        <TouchableOpacity onPress={() => setIsSearchVisible(!isSearchVisible)}>
          <Ionicons name="search" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView 
          style={styles.flex1} 
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {isSearchVisible && (
            <View style={{ padding: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TextInput 
                style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6', color: colors.text, padding: 8, borderRadius: 8 }}
                placeholder="Search messages..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
          )}
          <FlatList
            ref={flatListRef}
            data={messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
          />

          {(replyingTo || editingMessage) && (
            <View style={{ padding: 12, backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12 }}>
                  {editingMessage ? 'Editing Message' : `Replying to ${replyingTo?.senderName}`}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                  {editingMessage ? editingMessage.content : replyingTo?.content}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setEditingMessage(null); setContent(''); }}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: (replyingTo || editingMessage) ? 0 : 1 }]}>
            <TouchableOpacity 
              style={[styles.attachButton, { backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }]} 
              onPress={() => setShowAttachModal(true)}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendButton, { backgroundColor: colors.primary, opacity: content.trim() ? 1 : 0.5 }]} 
              onPress={handleSend}
              disabled={!content.trim()}
            >
              <Ionicons name="send" size={18} color="#ffffff" style={styles.sendIcon} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Attach Menu Modal */}
      <Modal visible={showAttachModal} animationType="slide" transparent={true}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAttachModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Attach</Text>
              <TouchableOpacity onPress={() => setShowAttachModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingVertical: 20 }}>
              <TouchableOpacity style={styles.attachOption} onPress={() => { setShowAttachModal(false); setShowPollModal(true); }}>
                <View style={[styles.attachIconBg, { backgroundColor: '#3b82f6' }]}><Ionicons name="stats-chart" size={28} color="#fff" /></View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>Poll</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.attachOption} onPress={() => handlePickMedia('image')}>
                <View style={[styles.attachIconBg, { backgroundColor: '#eab308' }]}><Ionicons name="image" size={28} color="#fff" /></View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>Gallery</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.attachOption} onPress={() => handlePickMedia('document')}>
                <View style={[styles.attachIconBg, { backgroundColor: '#8b5cf6' }]}><Ionicons name="document" size={28} color="#fff" /></View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>Document</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.attachOption} onPress={() => { setShowAttachModal(false); setShowRecordModal(true); startRecording(); }}>
                <View style={[styles.attachIconBg, { backgroundColor: '#f97316' }]}><Ionicons name="mic" size={28} color="#fff" /></View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>Audio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Record Audio Modal */}
      <Modal visible={showRecordModal} animationType="slide" transparent={true}>
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, padding: 24, alignItems: 'center' }]}>
            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 24 }]}>Recording Voice Note...</Text>
            
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(249, 115, 22, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
              <Ionicons name="mic" size={40} color="#f97316" />
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
              <TouchableOpacity 
                style={[styles.modalSubmitBtn, { backgroundColor: '#ef4444', flex: 1, marginRight: 8 }]}
                onPress={async () => {
                  if (recording) {
                    await recording.stopAndUnloadAsync();
                    setRecording(null);
                  }
                  setShowRecordModal(false);
                }}
              >
                <Text style={styles.modalSubmitText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalSubmitBtn, { backgroundColor: '#10b981', flex: 1, marginLeft: 8 }]}
                onPress={stopAndSendRecording}
              >
                <Text style={styles.modalSubmitText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Poll Creation Modal */}
      <Modal visible={showPollModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Poll</Text>
              <TouchableOpacity onPress={() => setShowPollModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }]}
              placeholder="Ask a question..."
              placeholderTextColor={colors.textMuted}
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />
            
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: isDarkMode ? '#374151' : '#f3f4f6', marginTop: 12 }]}
              placeholder="Option 1"
              placeholderTextColor={colors.textMuted}
              value={pollOptions[0]}
              onChangeText={text => setPollOptions([text, pollOptions[1]])}
            />
            
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: isDarkMode ? '#374151' : '#f3f4f6', marginTop: 8 }]}
              placeholder="Option 2"
              placeholderTextColor={colors.textMuted}
              value={pollOptions[1]}
              onChangeText={text => setPollOptions([pollOptions[0], text])}
            />

            <TouchableOpacity 
              style={[styles.modalSubmitBtn, { backgroundColor: colors.primary, opacity: pollQuestion && pollOptions[0] && pollOptions[1] ? 1 : 0.5 }]}
              onPress={handleCreatePoll}
              disabled={!pollQuestion || !pollOptions[0] || !pollOptions[1]}
            >
              <Text style={styles.modalSubmitText}>Create Poll</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Message Action Modal */}
      <Modal visible={!!selectedActionMessage} animationType="fade" transparent={true}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedActionMessage(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Message Actions</Text>
              <TouchableOpacity onPress={() => setSelectedActionMessage(null)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            {selectedActionMessage && (
              <View>
                {/* Reactions */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 }}>
                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                    <TouchableOpacity 
                      key={emoji}
                      onPress={() => {
                        handleReact(selectedActionMessage.id, emoji);
                        setSelectedActionMessage(null);
                      }}
                      style={{ padding: 10, backgroundColor: isDarkMode ? '#374151' : '#f3f4f6', borderRadius: 24 }}
                    >
                      <Text style={{ fontSize: 24 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
                
                {/* Action List */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: 10 }}>
                  <TouchableOpacity style={styles.actionListItem} onPress={() => { setReplyingTo(selectedActionMessage); setSelectedActionMessage(null); }}>
                    <View style={[styles.attachIconBg, { backgroundColor: '#3b82f6', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="arrow-undo" size={24} color="#fff" /></View>
                    <Text style={[styles.actionListText, { color: colors.text }]}>Reply</Text>
                  </TouchableOpacity>

                  {(userRole === 'MANAGER' || userRole === 'COMMITTEE') && (
                    <TouchableOpacity style={styles.actionListItem} onPress={() => { handlePin(selectedActionMessage); setSelectedActionMessage(null); }}>
                      <View style={[styles.attachIconBg, { backgroundColor: '#eab308', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name={selectedActionMessage.isPinned ? "pin-outline" : "pin"} size={24} color="#fff" /></View>
                      <Text style={[styles.actionListText, { color: colors.text }]}>{selectedActionMessage.isPinned ? 'Unpin' : 'Pin'}</Text>
                    </TouchableOpacity>
                  )}
                  
                  {selectedActionMessage.senderId === currentUserId && (
                    <TouchableOpacity style={styles.actionListItem} onPress={() => { setEditingMessage(selectedActionMessage); setContent(selectedActionMessage.content); setSelectedActionMessage(null); }}>
                      <View style={[styles.attachIconBg, { backgroundColor: '#8b5cf6', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="pencil" size={24} color="#fff" /></View>
                      <Text style={[styles.actionListText, { color: colors.text }]}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  
                  {(selectedActionMessage.senderId === currentUserId || userRole === 'MANAGER') && (
                    <TouchableOpacity style={styles.actionListItem} onPress={() => { handleDelete(selectedActionMessage); setSelectedActionMessage(null); }}>
                      <View style={[styles.attachIconBg, { backgroundColor: '#ef4444', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="trash" size={24} color="#fff" /></View>
                      <Text style={[styles.actionListText, { color: '#ef4444' }]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sender Profile Modal */}
      <Modal visible={!!selectedProfileMessage} animationType="fade" transparent={true}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedProfileMessage(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: 30, alignItems: 'center' }]}>
            {selectedProfileMessage && (
              <>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginVertical: 16 }}>
                  <Text style={{ fontSize: 40 }}>
                    {selectedProfileMessage.senderRole === 'COMMITTEE' ? '👑' : selectedProfileMessage.senderRole === 'GUARD' ? '🛡️' : selectedProfileMessage.senderRole === 'MANAGER' ? '🛠️' : '👤'}
                  </Text>
                </View>
                
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>
                  {selectedProfileMessage.senderName}
                </Text>
                
                {selectedProfileMessage.unitNumber && (
                  <Text style={{ fontSize: 16, color: colors.textMuted, marginBottom: 4 }}>
                    Unit {selectedProfileMessage.unitNumber}
                  </Text>
                )}
                
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600', marginBottom: 24 }}>
                  {selectedProfileMessage.senderRole}
                </Text>
                
                <TouchableOpacity 
                  style={[styles.modalSubmitBtn, { backgroundColor: colors.primary, width: '100%' }]}
                  onPress={() => setSelectedProfileMessage(null)}
                >
                  <Text style={styles.modalSubmitText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  attachOption: {
    alignItems: 'center',
    width: '25%',
    marginBottom: 16,
  },
  attachIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  attachOptionText: {
    fontSize: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageBubbleWrapper: {
    marginBottom: 16,
    maxWidth: '85%',
  },
  messageMeWrapper: {
    alignSelf: 'flex-end',
  },
  messageOtherWrapper: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    marginBottom: 4,
    marginLeft: 4,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
  },
  actionListItem: {
    alignItems: 'center',
    width: '25%',
    marginVertical: 10,
  },
  actionListText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
    fontSize: 16,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    marginLeft: 4, // slight offset for send icon
  },
  pollContainer: {
    marginTop: 10,
  },
  pollOption: {
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pollFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalInput: {
    height: 45,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  modalSubmitBtn: {
    marginTop: 20,
    height: 45,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
