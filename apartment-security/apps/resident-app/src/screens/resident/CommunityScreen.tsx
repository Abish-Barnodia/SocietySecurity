import React, { useMemo, useRef, useState, useEffect } from 'react';
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
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  Image,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../../context/ThemeContext';
import { useCommunity, ChatMessage, CommunityMember } from '../../context/CommunityContext';
import { useEvents } from '../../context/EventsContext';
import { useMaintenance } from '../../context/MaintenanceContext';
import { useDomesticWorkers } from '../../context/DomesticWorkersContext';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import api from '../../utils/api';
import MessageBubble from '../../components/community/MessageBubble';
import MessageActionsSheet from '../../components/community/MessageActionsSheet';
import AttachmentSheet, { AttachmentAction } from '../../components/community/AttachmentSheet';
import CreatePollModal from '../../components/community/CreatePollModal';
import MediaPreviewModal, { PreviewAsset } from '../../components/community/MediaPreviewModal';
import MentionAutocomplete from '../../components/community/MentionAutocomplete';
import ThemedAlertModal from '../../components/ThemedAlertModal';
import VoiceMessagePlayer from '../../components/community/VoiceMessagePlayer';

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

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export interface DirectMessageItem {
  id: string;
  senderId: string;
  text?: string;
  timestamp: string;
  isMine: boolean;
  mediaType?: 'IMAGE' | 'AUDIO' | 'FILE';
  mediaUri?: string;
  fileName?: string;
  fileSize?: number;
  durationSec?: number;
}

export interface HubPerson {
  id: string;
  name: string;
  role: string;
  category?: string;
  phone?: string;
  email?: string;
  unitOrLocation?: string;
  photoUrl?: string;
  initials: string;
  color: string;
  isPrimary?: boolean;
  type: 'RESIDENT' | 'GUARD' | 'WORKER' | 'COMMITTEE' | 'SERVICE';
}

const AVATAR_COLORS = ['#4A6B82', '#5B8C67', '#8D6E63', '#0284c7', '#7E57C2', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6'];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export default function CommunityScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { userProfile, userId } = useAuth();

  // Contexts with real live backend data
  const { events, fetchEvents } = useEvents();
  const { invoices, fetchInvoices } = useMaintenance();
  const { workers, fetchWorkers } = useDomesticWorkers();
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
    fetchMembers,
    sendTextMessage,
    sendMediaMessage,
    toggleReaction,
    deleteMessage,
    searchMessages,
    clearSearch,
    emitTyping,
  } = useCommunity();

  // Backend Hub data (Guards, Committee, Services)
  const [hubLoading, setHubLoading] = useState(false);
  const [guardsList, setGuardsList] = useState<any[]>([]);
  const [committeeList, setCommitteeList] = useState<any[]>([]);
  const [propertyInfo, setPropertyInfo] = useState<any>(null);

  // Modal States
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [directoryModalOpen, setDirectoryModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<HubPerson | null>(null);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [userReviewText, setUserReviewText] = useState('');
  const [searchGlobalText, setSearchGlobalText] = useState('');
  const [directoryFilterTab, setDirectoryFilterTab] = useState<'ALL' | 'OWNERS' | 'TENANTS' | 'SAME_BLOCK'>('ALL');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);

  // 1-on-1 Personal Direct Chat State
  const [directChatTarget, setDirectChatTarget] = useState<HubPerson | null>(null);
  const [directChatHistory, setDirectChatHistory] = useState<Record<string, DirectMessageItem[]>>({});
  const [directChatInput, setDirectChatInput] = useState('');
  const [directAttachmentOpen, setDirectAttachmentOpen] = useState(false);
  const [directPreviewImage, setDirectPreviewImage] = useState<string | null>(null);
  const directScrollRef = useRef<ScrollView>(null);
  const directVoice = useVoiceRecorder();

  // Fetch Hub Data from backend
  const loadHubData = async () => {
    setHubLoading(true);
    try {
      const res = await api.get('/community/hub');
      if (res.data?.data) {
        setGuardsList(res.data.data.guards || []);
        setCommitteeList(res.data.data.committee || []);
        setPropertyInfo(res.data.data.property || null);
      }
    } catch (e) {
      console.log('Error fetching hub data:', e);
    } finally {
      setHubLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchEvents();
    fetchInvoices();
    fetchWorkers();
    loadHubData();
  }, []);

  const { isRecording, elapsedSec, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [previewAssets, setPreviewAssets] = useState<PreviewAsset[]>([]);
  const [previewSending, setPreviewSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lastTypingEmitRef = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Map real members to HubPerson list
  const realResidentsList = useMemo<HubPerson[]>(() => {
    return members.map((m, idx) => ({
      id: m.id || m.userId,
      name: m.name,
      role: m.residentType || (m.isPrimary ? 'Owner' : 'Resident'),
      unitOrLocation: m.unit || '—',
      phone: m.phone || undefined,
      email: m.email || undefined,
      initials: getInitials(m.name),
      color: AVATAR_COLORS[idx % AVATAR_COLORS.length]!,
      isPrimary: m.isPrimary,
      type: 'RESIDENT',
    }));
  }, [members]);

  // Current resident location info
  const myFlat = userProfile?.flat || '';
  const myWing = userProfile?.wing || '';
  const currentUnitDisplay = `${myWing ? `${myWing} ` : ''}${myFlat || 'Resident'}`;
  const societyName = propertyInfo?.name || userProfile?.propertyName || 'Society Hub';

  // Floor Neighbours from real members list
  const floorNeighbours = useMemo<HubPerson[]>(() => {
    if (!myFlat) return realResidentsList.slice(0, 4);
    // extract floor digits (e.g. 102 -> floor 1, 402 -> floor 4)
    const myFloorNum = myFlat.length >= 3 ? myFlat.slice(0, myFlat.length - 2) : '';
    const sameFloor = realResidentsList.filter((r) => {
      if (r.id === userId || r.name === userProfile?.name) return false;
      if (!r.unitOrLocation || r.unitOrLocation === '—') return false;
      if (myWing && !r.unitOrLocation.toUpperCase().includes(myWing.toUpperCase())) return false;
      if (myFloorNum && !r.unitOrLocation.includes(myFloorNum)) return false;
      return true;
    });
    return sameFloor.length > 0 ? sameFloor : realResidentsList.filter((r) => r.name !== userProfile?.name).slice(0, 3);
  }, [realResidentsList, myFlat, myWing, userProfile]);

  // Real Pending Invoices / Dues calculation
  const pendingInvoices = useMemo(() => {
    return invoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE');
  }, [invoices]);

  const totalDuesAmount = useMemo(() => {
    return pendingInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  }, [pendingInvoices]);

  // Filtered residents in directory
  const filteredResidents = useMemo(() => {
    return realResidentsList.filter((r) => {
      const matchesQuery =
        !searchGlobalText.trim() ||
        r.name.toLowerCase().includes(searchGlobalText.toLowerCase()) ||
        (r.unitOrLocation && r.unitOrLocation.toLowerCase().includes(searchGlobalText.toLowerCase()));

      if (!matchesQuery) return false;
      if (directoryFilterTab === 'OWNERS') return r.role.toLowerCase().includes('owner');
      if (directoryFilterTab === 'TENANTS') return r.role.toLowerCase().includes('tenant');
      if (directoryFilterTab === 'SAME_BLOCK') {
        if (!myWing) return true;
        return r.unitOrLocation?.toUpperCase().includes(myWing.toUpperCase());
      }
      return true;
    });
  }, [realResidentsList, searchGlobalText, directoryFilterTab, myWing]);

  // Verified Local Services & Workers from DB
  const serviceStaffList = useMemo<HubPerson[]>(() => {
    const list: HubPerson[] = [];

    // Society Supervisor / Desk
    if (propertyInfo?.emergencyContact || propertyInfo?.contactPhone) {
      list.push({
        id: 'office-desk',
        name: 'Society Security & Office',
        role: 'Society Administrator',
        category: 'Society Maintenance',
        phone: propertyInfo.contactPhone || propertyInfo.emergencyContact,
        email: propertyInfo.contactEmail,
        initials: 'SO',
        color: '#4E878C',
        type: 'SERVICE',
      });
    }

    // Workers categorized by type (Plumber, Electrician, Maid, etc.)
    workers.forEach((w, idx) => {
      list.push({
        id: w.id,
        name: w.name,
        role: w.type.replace('_', ' '),
        category: w.type,
        phone: w.phone,
        photoUrl: w.photoUrl,
        initials: getInitials(w.name),
        color: AVATAR_COLORS[(idx + 2) % AVATAR_COLORS.length]!,
        type: 'WORKER',
      });
    });

    return list;
  }, [workers, propertyInfo]);

  // Guards mapped to HubPerson
  const realGuards = useMemo<HubPerson[]>(() => {
    return guardsList.map((g, idx) => ({
      id: g.id,
      name: g.name,
      role: `Guard • ${g.gate || 'MAIN GATE'}`,
      category: 'Security',
      phone: g.phone || undefined,
      unitOrLocation: g.gate || 'Main Gate',
      initials: getInitials(g.name),
      color: AVATAR_COLORS[(idx + 4) % AVATAR_COLORS.length]!,
      type: 'GUARD',
    }));
  }, [guardsList]);

  // Committee mapped to HubPerson
  const realCommittee = useMemo<HubPerson[]>(() => {
    return committeeList.map((c, idx) => ({
      id: c.id,
      name: c.name,
      role: c.role || 'Committee Member',
      category: 'Management Committee',
      phone: c.phone || undefined,
      email: c.email || undefined,
      initials: getInitials(c.name),
      color: AVATAR_COLORS[(idx + 6) % AVATAR_COLORS.length]!,
      type: 'COMMITTEE',
    }));
  }, [committeeList]);

  // Emergency contacts from property & standard emergency
  const emergencyContacts = useMemo(() => {
    const list = [
      { id: 'em-amb', name: 'Ambulance', number: '102', role: 'Medical Emergency' },
      { id: 'em-pol', name: 'Police Helpline', number: '112', role: 'Emergency Response' },
      { id: 'em-fire', name: 'Fire Control', number: '101', role: 'Fire Emergency' },
    ];
    if (propertyInfo?.emergencyContact) {
      list.unshift({
        id: 'em-society',
        name: `${societyName} Control Desk`,
        number: propertyInfo.emergencyContact,
        role: 'Property Emergency',
      });
    }
    return list;
  }, [propertyInfo, societyName]);

  // Chat message list
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
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message ?? 'Failed to send message. Please try again.');
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
        } catch (error: any) {
          setErrorMessage(error?.response?.data?.message ?? 'Failed to send voice message. Please try again.');
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

  const dialPhone = (num?: string) => {
    if (!num) {
      Alert.alert('Contact Unavailable', 'No phone number provided for this person.');
      return;
    }
    Linking.openURL(`tel:${num}`).catch(() => Alert.alert('Dialer Error', `Unable to call ${num}`));
  };

  // 1-on-1 Direct Message Actions
  const openDirectChat = (person: HubPerson) => {
    setSelectedPerson(null);
    setDirectoryModalOpen(false);
    navigation.navigate('ResidentChat', {
      initialPartnerId: person.id,
      initialPartnerName: person.name,
      initialPartnerUnit: person.unitOrLocation,
    });
  };

  const sendDirectMessage = () => {
    if (!directChatInput.trim() || !directChatTarget) return;
    const newMsg: DirectMessageItem = {
      id: `dm-${Date.now()}`,
      senderId: userId || 'me',
      text: directChatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
    };

    setDirectChatHistory((prev) => ({
      ...prev,
      [directChatTarget.id]: [...(prev[directChatTarget.id] || []), newMsg],
    }));

    setDirectChatInput('');
  };

  const sendDirectMedia = (
    mediaType: 'IMAGE' | 'AUDIO' | 'FILE',
    mediaUri: string,
    fileName?: string,
    fileSize?: number,
    durationSec?: number
  ) => {
    if (!directChatTarget) return;
    const newMsg: DirectMessageItem = {
      id: `dm-${Date.now()}`,
      senderId: userId || 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
      mediaType,
      mediaUri,
      fileName,
      fileSize,
      durationSec,
    };

    setDirectChatHistory((prev) => ({
      ...prev,
      [directChatTarget.id]: [...(prev[directChatTarget.id] || []), newMsg],
    }));
  };

  const handleDirectMicPress = async () => {
    if (directVoice.isRecording) {
      const result = await directVoice.stopRecording();
      if (result) {
        sendDirectMedia('AUDIO', result.uri, undefined, undefined, result.durationSec);
      }
    } else {
      try {
        await directVoice.startRecording();
      } catch {
        Alert.alert('Permission required', 'Microphone permission is required to record a voice message.');
      }
    }
  };

  const handleDirectAttachment = async (action: 'camera' | 'gallery' | 'document') => {
    setDirectAttachmentOpen(false);
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
          sendDirectMedia('IMAGE', res.assets[0].uri);
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
          sendDirectMedia('IMAGE', res.assets[0].uri);
        }
      } else if (action === 'document') {
        const res = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          const asset = res.assets[0];
          sendDirectMedia('FILE', asset.uri, asset.name, asset.size ?? undefined);
        }
      }
    } catch (e: any) {
      Alert.alert('Attachment Error', e?.message || 'Unable to attach selected item.');
    }
  };

  const handleRaiseAlarm = () => {
    Alert.alert(
      '🚨 Raise Emergency Alarm',
      'Are you sure you want to broadcast an emergency alarm to security guards and on-duty supervisors?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trigger Alarm',
          style: 'destructive',
          onPress: () => Alert.alert('Alarm Broadcasted', 'Security guards have been alerted to your unit.'),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* TOP APP BAR */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.unitSelector} onPress={() => navigation.navigate('Household')}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.unitText}>{currentUnitDisplay}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.text} style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => setDirectoryModalOpen(true)}>
            <Ionicons name="search-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setChatModalOpen(true)}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.text} />
            {messages.length > 0 && <View style={styles.chatBadge} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileAvatarBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileAvatarLetter}>
              {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'A'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN COMMUNITY FEED / DIRECTORY HUB */}
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* SOCIETY HEADER & RATING */}
        <View style={styles.societyHeroCard}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center' }}
              onPress={() => setDirectoryModalOpen(true)}
            >
              <Text style={styles.societyTitle}>{societyName}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name="star" size={14} color="#f59e0b" style={{ marginRight: 2 }} />
              ))}
              <Text style={styles.reviewCountText}>Verified Society Hub</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.rateNowBtn} onPress={() => setRateModalOpen(true)}>
            <Text style={styles.rateNowText}>Rate Now</Text>
          </TouchableOpacity>
        </View>

        {/* ANNOUNCEMENTS SECTION (Real live events & society broadcasts) */}
        <View style={styles.sectionHeaderRow}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => navigation.navigate('Events')}
          >
            <Text style={styles.sectionHeading}>Announcements & Events</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {events.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.announcementCard}
                onPress={() => setSelectedAnnouncement(event)}
                activeOpacity={0.8}
              >
                <Text style={styles.announcementTitle} numberOfLines={1}>{event.title}</Text>
                <Text style={styles.announcementDate}>
                  {new Date(event.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Text style={styles.announcementBody} numberOfLines={3}>
                  {event.description}
                </Text>
                <Text style={styles.readMoreLink}>View Details</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.announcementCardWide}>
              <Ionicons name="megaphone-outline" size={24} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.announcementTitle}>Official Society Noticeboard</Text>
                <Text style={styles.announcementDate}>All administrative circulars & maintenance schedules will appear here.</Text>
              </View>
            </View>
          </View>
        )}

        {/* NOTIFICATIONS BANNER (Real Dues from MaintenanceContext) */}
        {totalDuesAmount > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
            <Text style={[styles.sectionHeading, { marginBottom: 8 }]}>Notifications</Text>
            <TouchableOpacity
              style={styles.duesPendingCard}
              onPress={() => navigation.navigate('Maintenance')}
              activeOpacity={0.8}
            >
              <View style={styles.duesIconBox}>
                <Ionicons name="receipt-outline" size={20} color="#dc2626" />
              </View>
              <Text style={styles.duesText}>
                ₹{totalDuesAmount.toFixed(2)} Society Dues pending ({pendingInvoices.length} bill{pendingInvoices.length > 1 ? 's' : ''})
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* CONNECT WITH NEIGHBOURS (Real members sharing block/floor) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>Connect with Neighbours</Text>
          <Text style={styles.sectionSub}>
            {myWing ? `Residents of Block: ${myWing}` : 'Verified Neighbours'}
          </Text>

          {floorNeighbours.length > 0 ? (
            <View style={styles.neighbourGrid}>
              {floorNeighbours.map((neighbour) => (
                <TouchableOpacity
                  key={neighbour.id}
                  style={styles.neighbourBoxCard}
                  onPress={() => setSelectedPerson(neighbour)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.contactAvatar, { backgroundColor: neighbour.color }]}>
                    <Text style={styles.contactAvatarText}>{neighbour.initials}</Text>
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={styles.contactName} numberOfLines={1}>{neighbour.name}</Text>
                    <Text style={styles.contactPhone}>{neighbour.unitOrLocation} • {neighbour.role}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.callCircleBtn}
                    onPress={() => openDirectChat(neighbour)}
                  >
                    <Ionicons name="chatbubble-ellipses" size={15} color="#0284c7" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.emptyNeighbourCard}
              onPress={() => setDirectoryModalOpen(true)}
            >
              <Ionicons name="people" size={24} color={colors.primary} />
              <Text style={styles.emptyNeighbourText}>Explore Resident Directory ({realResidentsList.length} Residents)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* RESIDENT DIRECTORY BANNER */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <TouchableOpacity
            style={styles.residentDirectoryBanner}
            onPress={() => setDirectoryModalOpen(true)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.residentDirectoryTitle}>Resident Directory</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.text} style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.residentDirectorySub}>View verified residents, call or send personal direct messages</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {realResidentsList.slice(0, 3).map((r, i) => (
                <View key={r.id} style={[styles.miniAvatar, { backgroundColor: r.color, marginLeft: i > 0 ? -8 : 0 }]}>
                  <Text style={styles.miniAvatarText}>{r.initials}</Text>
                </View>
              ))}
              <Text style={styles.directoryCountText}>+{realResidentsList.length}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* MANAGEMENT COMMITTEE (Real backend committee members) */}
        {realCommittee.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeading}>Management Committee</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 14, paddingTop: 10 }}
            >
              {realCommittee.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.committeeCol}
                  onPress={() => setSelectedPerson(member)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.committeeAvatar, { backgroundColor: member.color }]}>
                    <Text style={styles.committeeAvatarText}>{member.initials}</Text>
                  </View>
                  <Text style={styles.committeeName} numberOfLines={1}>{member.name}</Text>
                  <Text style={styles.committeeRole} numberOfLines={1}>{member.role}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* LOCAL DIRECTORY & SERVICE PROFESSIONALS (Real DB workers & staff) */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
            onPress={() => navigation.navigate('DomesticWorkers')}
          >
            <Text style={styles.sectionHeading}>Local Directory & Services</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text} style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          {serviceStaffList.length > 0 ? (
            <View style={styles.directoryListCard}>
              {serviceStaffList.map((contact, idx) => (
                <View key={contact.id}>
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => setSelectedPerson(contact)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.contactAvatar, { backgroundColor: contact.color }]}>
                      <Text style={styles.contactAvatarText}>{contact.initials}</Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactPhone}>{contact.role} {contact.phone ? `• ${contact.phone}` : ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {contact.phone && (
                        <TouchableOpacity
                          style={styles.callCircleBtn}
                          onPress={() => dialPhone(contact.phone)}
                        >
                          <Ionicons name="call" size={15} color="#16a34a" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.callCircleBtn, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}
                        onPress={() => openDirectChat(contact)}
                      >
                        <Ionicons name="chatbubble-ellipses" size={15} color="#0284c7" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                  {idx < serviceStaffList.length - 1 && <View style={styles.contactDivider} />}
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.emptyNeighbourCard}
              onPress={() => navigation.navigate('WorkerForm')}
            >
              <Ionicons name="construct-outline" size={24} color={colors.primary} />
              <Text style={styles.emptyNeighbourText}>Register Plumber, Electrician or Daily Staff</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* SECURITY GUARDS (Real property guards) */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
            onPress={() => navigation.navigate('SecuritySettings')}
          >
            <Text style={styles.sectionHeading}>Security Desk & Guards</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text} style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 14 }}
          >
            {/* Raise Alarm */}
            <TouchableOpacity style={styles.securityActionCol} onPress={handleRaiseAlarm}>
              <View style={[styles.securityCircleIcon, { backgroundColor: '#dc2626' }]}>
                <Ionicons name="warning" size={28} color="#fff" />
              </View>
              <Text style={styles.securityActionLabel}>Raise{'\n'}Alarm</Text>
            </TouchableOpacity>

            {/* Direct Guards from DB */}
            {realGuards.map((guard) => (
              <TouchableOpacity
                key={guard.id}
                style={styles.securityActionCol}
                onPress={() => setSelectedPerson(guard)}
              >
                <View style={[styles.guardAvatarCircle, { backgroundColor: guard.color }]}>
                  <Text style={styles.guardAvatarInitial}>{guard.initials}</Text>
                  {guard.phone && (
                    <TouchableOpacity
                      style={styles.guardCallMiniBtn}
                      onPress={() => dialPhone(guard.phone)}
                    >
                      <Ionicons name="call" size={10} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.guardName} numberOfLines={1}>{guard.name}</Text>
                <Text style={styles.guardGateSub}>{guard.unitOrLocation}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* EMERGENCY CONTACTS */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionHeading, { marginBottom: 10 }]}>Emergency Contacts</Text>
          <View style={styles.emergencyGrid}>
            {emergencyContacts.map((em) => (
              <TouchableOpacity
                key={em.id}
                style={styles.emergencyCard}
                onPress={() => dialPhone(em.number)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.emergencyName} numberOfLines={1}>{em.name}</Text>
                  <Text style={styles.emergencyNumber}>{em.number}</Text>
                </View>
                <View style={styles.emergencyCallBtn}>
                  <Ionicons name="call" size={16} color="#16a34a" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* SOCIETY PAYMENTS */}
        <View style={[styles.sectionContainer, { marginBottom: 24 }]}>
          <Text style={styles.sectionHeading}>Society Payments</Text>
          <TouchableOpacity
            style={styles.paymentBannerCard}
            onPress={() => navigation.navigate('Maintenance')}
            activeOpacity={0.8}
          >
            <View style={styles.paymentBannerLeft}>
              <Ionicons name="card" size={24} color="#0284c7" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.paymentBannerTitle}>Maintenance & Invoices</Text>
                <Text style={styles.paymentBannerSub}>
                  {pendingInvoices.length > 0
                    ? `${pendingInvoices.length} invoice(s) pending payment`
                    : 'All society dues cleared'}
                </Text>
              </View>
            </View>
            <View style={styles.payNowBadge}>
              <Text style={styles.payNowBadgeText}>View Bills</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* FLOATING GROUP CHAT BUTTON */}
      <TouchableOpacity
        style={styles.floatingChatFab}
        onPress={() => setChatModalOpen(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubbles" size={22} color={isDark ? '#0f172a' : '#ffffff'} />
        <Text style={styles.floatingChatFabText}>Community Chat</Text>
      </TouchableOpacity>

      {/* ================= MODAL: 1-ON-1 PERSONAL DIRECT CHAT ================= */}
      <Modal
        visible={!!directChatTarget}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (directVoice.isRecording) directVoice.cancelRecording();
          setDirectChatTarget(null);
        }}
      >
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            {/* Header */}
            <View style={styles.chatModalHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (directVoice.isRecording) directVoice.cancelRecording();
                  setDirectChatTarget(null);
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-back" size={26} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.directChatHeaderInfo}>
                <View style={[styles.miniAvatar, { backgroundColor: directChatTarget?.color || colors.primary, marginRight: 8 }]}>
                  <Text style={styles.miniAvatarText}>{directChatTarget?.initials}</Text>
                </View>
                <View>
                  <Text style={styles.directChatHeaderName}>{directChatTarget?.name}</Text>
                  <Text style={styles.directChatHeaderRole}>
                    {directChatTarget?.unitOrLocation ? `${directChatTarget.unitOrLocation} • ` : ''}{directChatTarget?.role}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => dialPhone(directChatTarget?.phone)}
                style={styles.callCircleBtn}
              >
                <Ionicons name="call" size={16} color="#16a34a" />
              </TouchableOpacity>
            </View>

            {/* Direct Messages List */}
            <ScrollView
              ref={directScrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => directScrollRef.current?.scrollToEnd({ animated: true })}
            >
              <View style={styles.directChatNoticeBox}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
                <Text style={styles.directChatNoticeText}>
                  Direct 1-on-1 private messaging with {directChatTarget?.name}.
                </Text>
              </View>

              {(directChatTarget ? directChatHistory[directChatTarget.id] || [] : []).map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.directMessageBubble,
                    msg.isMine ? styles.directMessageMine : styles.directMessageOther,
                  ]}
                >
                  {/* Photo Attachment */}
                  {msg.mediaType === 'IMAGE' && !!msg.mediaUri && (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setDirectPreviewImage(msg.mediaUri || null)}
                      style={{ marginBottom: 6 }}
                    >
                      <Image
                        source={{ uri: msg.mediaUri }}
                        style={styles.directMediaThumb}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  )}

                  {/* Voice Note Audio */}
                  {msg.mediaType === 'AUDIO' && !!msg.mediaUri && (
                    <View style={{ marginVertical: 4 }}>
                      <VoiceMessagePlayer
                        uri={msg.mediaUri}
                        fallbackDurationSec={msg.durationSec}
                        tint={msg.isMine ? '#ffffff' : colors.primary}
                      />
                    </View>
                  )}

                  {/* File / Document Attachment */}
                  {msg.mediaType === 'FILE' && !!msg.mediaUri && (
                    <TouchableOpacity
                      style={[styles.directFileCard, msg.isMine && styles.directFileCardMine]}
                      activeOpacity={0.8}
                      onPress={() => msg.mediaUri && Linking.openURL(msg.mediaUri)}
                    >
                      <Ionicons
                        name="document-text"
                        size={24}
                        color={msg.isMine ? '#ffffff' : colors.primary}
                        style={{ marginRight: 8 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.directFileName, msg.isMine && { color: '#ffffff' }]} numberOfLines={1}>
                          {msg.fileName || 'Attachment Document'}
                        </Text>
                        {!!msg.fileSize && (
                          <Text style={[styles.directFileSize, msg.isMine && { color: 'rgba(255,255,255,0.8)' }]}>
                            {formatFileSize(msg.fileSize)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Text Message */}
                  {!!msg.text && (
                    <Text style={[styles.directMessageText, msg.isMine && { color: '#fff' }]}>
                      {msg.text}
                    </Text>
                  )}

                  <Text style={[styles.directMessageTime, msg.isMine && { color: 'rgba(255,255,255,0.7)' }]}>
                    {msg.timestamp}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {/* Composer */}
            {directVoice.isRecording ? (
              <View style={styles.composerRow}>
                <TouchableOpacity onPress={directVoice.cancelRecording} style={styles.iconButton}>
                  <Ionicons name="trash" size={22} color={colors.danger} />
                </TouchableOpacity>
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording… {formatRecordingTime(directVoice.elapsedSec)}</Text>
                </View>
                <TouchableOpacity onPress={handleDirectMicPress} style={styles.sendButton}>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.composerRow}>
                <TouchableOpacity
                  onPress={() => setDirectAttachmentOpen(true)}
                  style={styles.iconButton}
                >
                  <Ionicons name="add-circle" size={28} color={colors.primary} />
                </TouchableOpacity>

                <TextInput
                  style={styles.textInput}
                  placeholder={`Message ${directChatTarget?.name}...`}
                  placeholderTextColor={colors.textMuted}
                  value={directChatInput}
                  onChangeText={setDirectChatInput}
                  multiline
                />

                {directChatInput.trim() ? (
                  <TouchableOpacity
                    onPress={sendDirectMessage}
                    style={styles.sendButton}
                  >
                    <Ionicons name="send" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleDirectMicPress}
                    style={styles.sendButton}
                  >
                    <Ionicons name="mic" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ================= MODAL: FULL PROFILE DETAIL SHEET ================= */}
      <Modal
        visible={!!selectedPerson}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPerson(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalCardTitle}>Contact & Profile Details</Text>
              <TouchableOpacity onPress={() => setSelectedPerson(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedPerson && (
              <View style={{ alignItems: 'center', marginVertical: 14 }}>
                <View style={[styles.contactAvatarLarge, { backgroundColor: selectedPerson.color }]}>
                  <Text style={styles.contactAvatarLargeText}>{selectedPerson.initials}</Text>
                </View>
                <Text style={styles.residentProfileName}>{selectedPerson.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  {selectedPerson.unitOrLocation && (
                    <View style={styles.flatPillBadgeLarge}>
                      <Ionicons name="location-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={styles.flatPillLargeText}>{selectedPerson.unitOrLocation}</Text>
                    </View>
                  )}
                  <Text style={styles.residentProfileRole}>• {selectedPerson.role}</Text>
                </View>
              </View>
            )}

            <View style={styles.profileDetailsBox}>
              <View style={styles.profileDetailLine}>
                <Ionicons name="call-outline" size={18} color={colors.textMuted} />
                <Text style={styles.profileDetailLineText}>
                  {selectedPerson?.phone || 'Phone not listed'}
                </Text>
              </View>
              {selectedPerson?.email ? (
                <View style={[styles.profileDetailLine, { marginTop: 10 }]}>
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.profileDetailLineText}>{selectedPerson.email}</Text>
                </View>
              ) : null}
              <View style={[styles.profileDetailLine, { marginTop: 10 }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#16a34a" />
                <Text style={styles.profileDetailLineText}>Verified Society Member</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { flex: 1, backgroundColor: '#16a34a' }]}
                onPress={() => dialPhone(selectedPerson?.phone)}
              >
                <Ionicons name="call" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.modalPrimaryBtnText}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { flex: 1, backgroundColor: '#0284c7' }]}
                onPress={() => selectedPerson && openDirectChat(selectedPerson)}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.modalPrimaryBtnText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: RESIDENT DIRECTORY ================= */}
      <Modal
        visible={directoryModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setDirectoryModalOpen(false)}
      >
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: isDark ? '#1e293b' : '#ffffff' }}>
          <View style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#f5f3ef' }}>
            {/* Header */}
            <View style={styles.chatModalHeader}>
            <TouchableOpacity onPress={() => setDirectoryModalOpen(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.chatModalHeaderCenter}>
              <Text style={styles.chatModalTitle}>Resident Directory</Text>
              <Text style={styles.chatModalSub}>{filteredResidents.length} Verified Neighbours • {societyName}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setDirectoryModalOpen(false);
                setChatModalOpen(true);
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chatbubbles-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search resident name, flat (e.g. 101)..."
              placeholderTextColor={colors.textMuted}
              value={searchGlobalText}
              onChangeText={setSearchGlobalText}
              autoCapitalize="none"
            />
            {searchGlobalText ? (
              <TouchableOpacity onPress={() => setSearchGlobalText('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Chips */}
          <View style={styles.filterChipContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              <TouchableOpacity
                style={[styles.filterChip, directoryFilterTab === 'ALL' && styles.filterChipActive]}
                onPress={() => setDirectoryFilterTab('ALL')}
              >
                <Text style={[styles.filterChipText, directoryFilterTab === 'ALL' && styles.filterChipTextActive]}>
                  All ({realResidentsList.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, directoryFilterTab === 'OWNERS' && styles.filterChipActive]}
                onPress={() => setDirectoryFilterTab('OWNERS')}
              >
                <Text style={[styles.filterChipText, directoryFilterTab === 'OWNERS' && styles.filterChipTextActive]}>Owners</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, directoryFilterTab === 'TENANTS' && styles.filterChipActive]}
                onPress={() => setDirectoryFilterTab('TENANTS')}
              >
                <Text style={[styles.filterChipText, directoryFilterTab === 'TENANTS' && styles.filterChipTextActive]}>Tenants</Text>
              </TouchableOpacity>

              {myWing && (
                <TouchableOpacity
                  style={[styles.filterChip, directoryFilterTab === 'SAME_BLOCK' && styles.filterChipActive]}
                  onPress={() => setDirectoryFilterTab('SAME_BLOCK')}
                >
                  <Text style={[styles.filterChipText, directoryFilterTab === 'SAME_BLOCK' && styles.filterChipTextActive]}>
                    Tower {myWing}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Resident List */}
          <FlatList
            data={filteredResidents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { marginTop: 12 }]}>No residents found matching "{searchGlobalText}"</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.residentItemCard}
                onPress={() => setSelectedPerson(item)}
                activeOpacity={0.8}
              >
                <View style={[styles.contactAvatar, { backgroundColor: item.color }]}>
                  <Text style={styles.contactAvatarText}>{item.initials}</Text>
                </View>

                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    {item.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <View style={styles.flatPillBadge}>
                      <Ionicons name="home-outline" size={11} color={colors.primary} style={{ marginRight: 3 }} />
                      <Text style={styles.flatPillText}>{item.unitOrLocation}</Text>
                    </View>
                    <Text style={styles.residentRoleSub}>{item.role}</Text>
                  </View>
                </View>

                {/* 1-on-1 Actions */}
                <View style={styles.residentActionsRow}>
                  {item.phone && (
                    <TouchableOpacity
                      style={styles.callCircleBtn}
                      onPress={() => dialPhone(item.phone)}
                    >
                      <Ionicons name="call" size={16} color="#16a34a" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.callCircleBtn, { backgroundColor: 'rgba(2, 132, 199, 0.15)', marginLeft: 8 }]}
                    onPress={() => openDirectChat(item)}
                  >
                    <Ionicons name="chatbubble-ellipses" size={16} color="#0284c7" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />
          </View>
        </SafeAreaView>
      </Modal>

      {/* ================= MODAL: LIVE COMMUNITY GROUP CHAT ================= */}
      <Modal
        visible={chatModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setChatModalOpen(false)}
      >
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: isDark ? '#1e293b' : '#ffffff' }}>
          <KeyboardAvoidingView
            style={[styles.keyboardAvoid, { backgroundColor: isDark ? '#0f172a' : '#f5f3ef' }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            {/* Modal Header */}
            <View style={styles.chatModalHeader}>
              <TouchableOpacity onPress={() => setChatModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.chatModalHeaderCenter}>
                <Text style={styles.chatModalTitle}>Society Live Chat</Text>
                <Text style={styles.chatModalSub}>{societyName} • {realResidentsList.length} Residents</Text>
              </View>
              <TouchableOpacity onPress={() => setSearchOpen((s) => !s)} style={{ padding: 4 }}>
                <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {searchOpen && (
              <View style={styles.searchBar}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                    clearSearch();
                  }}
                >
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
                  ListEmptyComponent={searchQuery ? <Text style={styles.emptyText}>No messages found</Text> : null}
                />
              )
            ) : loadingInitial ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <FlatList
                data={listData}
                keyExtractor={(item) => (item.kind === 'date' ? item.key : item.message.id)}
                renderItem={({ item }) => {
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
                }}
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
                  <Ionicons name="checkmark" size={20} color="#fff" />
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
                    <Ionicons name="send" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handleMicPress} style={styles.sendButton}>
                    <Ionicons name="mic" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ================= MODAL: ANNOUNCEMENT DETAIL ================= */}
      <Modal
        visible={!!selectedAnnouncement}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAnnouncement(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalCardTitle}>{selectedAnnouncement?.title}</Text>
                <Text style={styles.modalCardDate}>
                  {selectedAnnouncement?.startDate
                    ? new Date(selectedAnnouncement.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                    : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedAnnouncement(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 280, marginVertical: 12 }}>
              <Text style={styles.modalCardBody}>{selectedAnnouncement?.description}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setSelectedAnnouncement(null)}
            >
              <Text style={styles.modalPrimaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: RATE SOCIETY ================= */}
      <Modal
        visible={rateModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRateModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalCardTitle}>Rate {societyName}</Text>
              <TouchableOpacity onPress={() => setRateModalOpen(false)}>
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalCardDate, { marginVertical: 8 }]}>
              Share your feedback to help improve society amenities and security operations.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 16 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setUserRating(star)} style={{ padding: 6 }}>
                  <Ionicons
                    name={star <= userRating ? 'star' : 'star-outline'}
                    size={32}
                    color="#f59e0b"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewTextInput}
              placeholder="Write your review or suggestions..."
              placeholderTextColor={colors.textMuted}
              value={userReviewText}
              onChangeText={setUserReviewText}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.modalPrimaryBtn, { marginTop: 16 }]}
              onPress={() => {
                setRateModalOpen(false);
                Alert.alert('Review Submitted', 'Thank you for reviewing your society!');
              }}
            >
              <Text style={styles.modalPrimaryBtnText}>Submit Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Direct 1-on-1 Attachment Sheet */}
      <AttachmentSheet
        visible={directAttachmentOpen}
        onClose={() => setDirectAttachmentOpen(false)}
        onSelect={(action) => {
          if (action === 'poll') {
            Alert.alert('1-on-1 Chat', 'Polls can be created in the Community Live Chat.');
          } else {
            handleDirectAttachment(action);
          }
        }}
      />

      {/* Direct 1-on-1 Fullscreen Photo Preview Modal */}
      <Modal
        visible={!!directPreviewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setDirectPreviewImage(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center', alignItems: 'center' }}>
          <SafeAreaView style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
            <TouchableOpacity
              onPress={() => setDirectPreviewImage(null)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.2)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="close" size={26} color="#ffffff" />
            </TouchableOpacity>
          </SafeAreaView>
          {directPreviewImage && (
            <Image
              source={{ uri: directPreviewImage }}
              style={{ width: '92%', height: '75%', borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Chat Sheets & Modals */}
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
      <AttachmentSheet visible={attachmentOpen} onClose={() => setAttachmentOpen(false)} onSelect={() => {}} />
      <CreatePollModal visible={pollModalOpen} onClose={() => setPollModalOpen(false)} replyToId={replyTo?.id} />
      <MediaPreviewModal
        visible={previewAssets.length > 0}
        assets={previewAssets}
        sending={previewSending}
        onClose={() => setPreviewAssets([])}
        onSend={() => {}}
      />
      <ThemedAlertModal visible={!!errorMessage} title="Error" message={errorMessage ?? ''} onClose={() => setErrorMessage(null)} />
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0f172a' : '#f5f3ef' },
    keyboardAvoid: { flex: 1 },

    // TOP HEADER
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 14,
      backgroundColor: isDark ? '#0f172a' : '#f5f3ef',
    },
    unitSelector: {
      flexDirection: 'column',
    },
    unitText: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    headerRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerActionBtn: {
      padding: 6,
      position: 'relative',
    },
    chatBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#ef4444',
    },
    profileAvatarBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#4A6B82',
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileAvatarLetter: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },

    scrollBody: {
      flex: 1,
    },

    // SOCIETY HERO
    societyHeroCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 10,
    },
    societyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    reviewCountText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
      marginLeft: 6,
    },
    rateNowBtn: {
      backgroundColor: isDark ? '#334155' : '#ffffff',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rateNowText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },

    // ANNOUNCEMENTS
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginTop: 10,
      marginBottom: 8,
    },
    sectionHeading: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    sectionSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
      marginBottom: 10,
    },
    sectionContainer: {
      paddingHorizontal: 16,
      marginTop: 18,
    },
    announcementCard: {
      width: 250,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    announcementCardWide: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    announcementTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    announcementDate: {
      fontSize: 11,
      color: colors.textMuted,
      marginVertical: 4,
    },
    announcementBody: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
    },
    readMoreLink: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      marginTop: 6,
    },

    // DUES CARD
    duesPendingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    duesIconBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    duesText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },

    // NEIGHBOURS LAYOUT
    neighbourGrid: {
      gap: 10,
    },
    neighbourBoxCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyNeighbourCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    emptyNeighbourText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },

    miniAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: '#fff',
    },
    miniAvatarText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#fff',
    },

    // RESIDENT DIRECTORY BANNER
    residentDirectoryBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    residentDirectoryTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    residentDirectorySub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    directoryCountText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      marginLeft: 6,
    },

    // MANAGEMENT COMMITTEE
    committeeCol: {
      alignItems: 'center',
      width: 80,
    },
    committeeAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    committeeAvatarText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#fff',
    },
    committeeName: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    committeeRole: {
      fontSize: 10,
      color: colors.textMuted,
      textAlign: 'center',
    },

    // LOCAL DIRECTORY
    directoryListCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
    },
    contactDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    contactAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    contactAvatarText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#fff',
    },
    contactName: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    contactPhone: {
      fontSize: 12,
      color: colors.textMuted,
    },
    callCircleBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // SECURITY ROW
    securityActionCol: {
      alignItems: 'center',
      width: 76,
    },
    securityCircleIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    securityActionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 14,
    },
    guardAvatarCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      marginBottom: 6,
    },
    guardAvatarInitial: {
      fontSize: 16,
      fontWeight: '800',
      color: '#fff',
    },
    guardCallMiniBtn: {
      position: 'absolute',
      bottom: 0,
      right: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#16a34a',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: '#fff',
    },
    guardName: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    guardGateSub: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
    },

    // EMERGENCY GRID
    emergencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    emergencyCard: {
      width: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emergencyName: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    emergencyNumber: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    emergencyCallBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 4,
    },

    // PAYMENT BANNER
    paymentBannerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
    },
    paymentBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    paymentBannerTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    paymentBannerSub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    payNowBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    payNowBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#fff',
    },

    // FLOATING CHAT BUTTON
    floatingChatFab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#ffffff' : '#0f172a',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
      gap: 8,
    },
    floatingChatFabText: {
      color: isDark ? '#0f172a' : '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },

    // CHAT MODAL STYLES
    chatModalContainer: {
      flex: 1,
      backgroundColor: isDark ? '#0f172a' : '#f5f3ef',
    },
    chatModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
    },
    chatModalHeaderCenter: {
      alignItems: 'center',
      flex: 1,
    },
    chatModalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    chatModalSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
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
    emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: 20 },
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

    // RESIDENT DIRECTORY STYLES
    filterChipContainer: {
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
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
      color: '#fff',
      fontWeight: '800',
    },
    residentItemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    primaryBadge: {
      backgroundColor: 'rgba(2, 132, 199, 0.12)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
      marginLeft: 6,
    },
    primaryBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#0284c7',
    },
    flatPillBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#334155' : '#e0e7ff',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginRight: 6,
    },
    flatPillText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
    residentRoleSub: {
      fontSize: 11,
      color: colors.textMuted,
    },
    residentActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    flatPillBadgeLarge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#334155' : '#e0e7ff',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginRight: 8,
    },
    flatPillLargeText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },
    residentProfileName: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    residentProfileRole: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '600',
    },
    profileDetailsBox: {
      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 6,
    },
    profileDetailLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileDetailLineText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 10,
    },

    // 1-ON-1 DIRECT CHAT STYLES
    directChatHeaderInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginHorizontal: 10,
    },
    directChatHeaderName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    directChatHeaderRole: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    directChatNoticeBox: {
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
    directChatNoticeText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    directMessageBubble: {
      maxWidth: '78%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      marginBottom: 8,
    },
    directMessageMine: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderBottomRightRadius: 2,
    },
    directMessageOther: {
      alignSelf: 'flex-start',
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      borderBottomLeftRadius: 2,
    },
    directMessageText: {
      fontSize: 14,
      color: colors.text,
    },
    directMessageTime: {
      fontSize: 10,
      color: colors.textMuted,
      alignSelf: 'flex-end',
      marginTop: 4,
    },
    directMediaThumb: {
      width: 200,
      height: 180,
      borderRadius: 12,
    },
    directFileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.06)',
      marginBottom: 4,
      minWidth: 180,
      maxWidth: 220,
    },
    directFileCardMine: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    directFileName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    directFileSize: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },

    // GENERIC MODAL STYLES
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalCardTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    modalCardDate: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    modalCardBody: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    modalPrimaryBtn: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalPrimaryBtnText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 14,
    },
    contactAvatarLarge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    contactAvatarLargeText: {
      fontSize: 24,
      fontWeight: '800',
      color: '#fff',
    },
    reviewTextInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      textAlignVertical: 'top',
    },
  });
