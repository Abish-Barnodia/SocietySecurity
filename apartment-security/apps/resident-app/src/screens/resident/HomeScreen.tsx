import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Modal,
  Alert,
  TextInput,
  Share,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { useAuth } from '@apartment-security/shared-auth';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';

interface CommunityComment {
  id: string;
  author: string;
  authorUnit: string;
  text: string;
  time: string;
}

interface CommunityAttachment {
  uri: string;
  name: string;
  type: 'image' | 'pdf' | 'doc' | 'file';
  size?: number;
}

interface CommunityPostItem {
  id: string;
  type: 'notice' | 'post' | 'poll' | 'event';
  author: string;
  authorUnit: string;
  authorRole?: string;
  time: string;
  title: string;
  content: string;
  tag?: string;
  likes: number;
  isLiked: boolean;
  userReaction?: string;
  reactionsSummary?: { emoji: string; count: number }[];
  comments: CommunityComment[];
  attachment?: CommunityAttachment;
  pollData?: {
    question: string;
    options: Array<{ id: string; text: string; votes: number }>;
    totalVotes: number;
    myVote?: string;
  };
  eventData?: {
    date: string;
    time: string;
    location: string;
    rsvps: number;
    isRsvpd?: boolean;
  };
}

interface ServiceItemDef {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen?: string;
  action?: () => void;
  badge?: string;
  color?: string;
}

interface ServiceCategoryDef {
  id: string;
  title: string;
  headerAction?: {
    label: string;
    isAlert?: boolean;
    onPress: () => void;
  };
  items: ServiceItemDef[];
}

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { passes, alerts, entries, members, triggerDuressAlert } = useData();
  const { userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();
  const socket = useSocket();

  const [unreadDmCount, setUnreadDmCount] = useState(0);

  const fetchUnreadDmCount = useCallback(async () => {
    try {
      const res = await api.get('/community/dm/summary/conversations');
      if (res.data?.data?.totalUnreadCount !== undefined) {
        setUnreadDmCount(res.data.data.totalUnreadCount);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUnreadDmCount();
  }, [fetchUnreadDmCount]);

  useEffect(() => {
    if (!socket) return;
    const handleDmUpdate = () => {
      fetchUnreadDmCount();
    };
    socket.on('dm:message', handleDmUpdate);
    socket.on('dm:read', handleDmUpdate);
    socket.on('dm:delete', handleDmUpdate);
    return () => {
      socket.off('dm:message', handleDmUpdate);
      socket.off('dm:read', handleDmUpdate);
      socket.off('dm:delete', handleDmUpdate);
    };
  }, [socket, fetchUnreadDmCount]);

  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [moreServicesOpen, setMoreServicesOpen] = useState(false);
  const [servicesSearchQuery, setServicesSearchQuery] = useState('');
  const [sendingSOS, setSendingSOS] = useState(false);

  // Selected entry for viewing details
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  // Full-screen media / document viewer
  const [previewAttachment, setPreviewAttachment] = useState<CommunityAttachment | null>(null);

  // Community Post creation states
  const [createPostSheetOpen, setCreatePostSheetOpen] = useState(false);
  const [createPostModalOpen, setCreatePostModalOpen] = useState(false);
  const [createPollModalOpen, setCreatePollModalOpen] = useState(false);
  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);

  // Form states for creating items
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postTag, setPostTag] = useState('General');
  const [postAttachment, setPostAttachment] = useState<CommunityAttachment | null>(null);

  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOption1, setPollOption1] = useState('');
  const [pollOption2, setPollOption2] = useState('');
  const [pollOption3, setPollOption3] = useState('');

  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventAttachment, setEventAttachment] = useState<CommunityAttachment | null>(null);

  // Comment modal state
  const [activeCommentPost, setActiveCommentPost] = useState<CommunityPostItem | null>(null);
  const [newCommentInput, setNewCommentInput] = useState('');
  const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);

  // Initial Community Posts feed
  const [communityPosts, setCommunityPosts] = useState<CommunityPostItem[]>([
    {
      id: 'post-1',
      type: 'notice',
      author: 'Society Admin',
      authorUnit: 'Management Office',
      authorRole: 'Admin',
      time: '4 hrs ago',
      title: 'Play more. Live more.',
      content:
        'We bring you the latest sports and clubhouse amenities updates at our township. Highlights: FIFA-sized football turf, badminton courts, and indoor table tennis now open for booking!',
      tag: 'Management',
      likes: 24,
      isLiked: false,
      userReaction: undefined,
      reactionsSummary: [
        { emoji: '👍', count: 18 },
        { emoji: '🔥', count: 6 },
      ],
      comments: [
        {
          id: 'c1',
          author: 'Vikram Mehta',
          authorUnit: 'Tower B • Flat 302',
          text: 'Great initiative! Is the badminton court available early mornings?',
          time: '2 hrs ago',
        },
      ],
    },
    {
      id: 'post-2',
      type: 'poll',
      author: 'Rohan Sharma',
      authorUnit: 'Tower A • Flat 204',
      time: '1 day ago',
      title: 'Community Poll: Weekend Yoga Session Timing',
      content: 'Please vote on the preferred timing for our upcoming weekend community yoga workshop in the central garden.',
      tag: 'Poll',
      likes: 15,
      isLiked: false,
      reactionsSummary: [{ emoji: '👏', count: 15 }],
      pollData: {
        question: 'Preferred Yoga Workshop Time?',
        options: [
          { id: 'opt-1', text: '6:30 AM - 7:30 AM (Morning)', votes: 12 },
          { id: 'opt-2', text: '7:30 AM - 8:30 AM (Morning)', votes: 8 },
          { id: 'opt-3', text: '5:30 PM - 6:30 PM (Evening)', votes: 4 },
        ],
        totalVotes: 24,
        myVote: undefined,
      },
      comments: [],
    },
    {
      id: 'post-3',
      type: 'event',
      author: 'Cultural Committee',
      authorUnit: 'Society Club',
      time: '2 days ago',
      title: 'Diwali & Autumn Festival Gathering',
      content: 'Join us for music, delicious food stalls, lantern decorations, and cultural performances at the Main Clubhouse Amphitheatre.',
      tag: 'Event',
      likes: 38,
      isLiked: false,
      reactionsSummary: [
        { emoji: '🎉', count: 28 },
        { emoji: '❤️', count: 10 },
      ],
      eventData: {
        date: 'Saturday, 18 Oct',
        time: '6:00 PM onwards',
        location: 'Clubhouse Amphitheatre',
        rsvps: 45,
        isRsvpd: false,
      },
      comments: [],
    },
  ]);

  const activePassesCount = passes.filter((p) => p.status === 'Active').length;
  const unreadAlertsCount = alerts.filter((a) => a.unread).length;
  const entriesTodayCount = entries.filter((e) => e.date === 'TODAY').length;
  const householdSize = members.length;

  const navigateTo = (screen: string) => {
    navigation.navigate(screen);
  };

  // Fallback to defaults if no profile exists
  const name = userProfile?.name ? userProfile.name.split(' ')[0] : 'Resident';
  const myUnit =
    userProfile?.wing && userProfile?.flat
      ? `Tower ${userProfile.wing} • Flat ${userProfile.flat}`
      : 'Tower A • Flat 402';

  const handleSOS = () => {
    Alert.alert(
      'Send SOS alert?',
      'This will immediately notify the guard station and property management.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSendingSOS(true);
            try {
              await triggerDuressAlert();
              Alert.alert('SOS alarm sent', 'Guard station has been notified.');
            } catch {
              Alert.alert('Error', 'Failed to send the SOS alert. Please try again or call for help directly.');
            } finally {
              setSendingSOS(false);
            }
          },
        },
      ]
    );
  };

  // Complete List of Categorized Services for View More Page
  const serviceCategories: ServiceCategoryDef[] = [
    {
      id: 'community',
      title: 'Community',
      headerAction: {
        label: 'View all >',
        onPress: () => {
          setMoreServicesOpen(false);
          navigateTo('Community');
        },
      },
      items: [
        {
          id: 'c1',
          label: 'Residents',
          icon: 'people-outline',
          screen: 'Household',
        },
        {
          id: 'c2',
          label: 'Find Daily Help',
          icon: 'hammer-outline',
          screen: 'DomesticWorkers',
        },
        {
          id: 'c3',
          label: 'Amenities',
          icon: 'fitness-outline',
          screen: 'Amenities',
        },
        {
          id: 'c4',
          label: 'Events & Club',
          icon: 'calendar-outline',
          screen: 'Events',
        },
        {
          id: 'c5',
          label: 'Resident & Guard Chat',
          icon: 'chatbubbles-outline',
          screen: 'ResidentChat',
        },
        {
          id: 'c6',
          label: 'Community Feed',
          icon: 'newspaper-outline',
          screen: 'Community',
        },
      ],
    },
    {
      id: 'visitors',
      title: 'Visitors & Security',
      headerAction: {
        label: 'Raise Alert',
        isAlert: true,
        onPress: handleSOS,
      },
      items: [
        {
          id: 'v1',
          label: 'Invite Guest',
          icon: 'person-add-outline',
          screen: 'CreatePass',
        },
        {
          id: 'v2',
          label: 'Cab / Auto',
          icon: 'car-outline',
          screen: 'CreatePass',
        },
        {
          id: 'v3',
          label: 'Allow Delivery',
          icon: 'bicycle-outline',
          screen: 'CreatePass',
        },
        {
          id: 'v4',
          label: 'Visiting Help',
          icon: 'construct-outline',
          screen: 'DomesticWorkers',
        },
        {
          id: 'v5',
          label: 'Call Security',
          icon: 'call-outline',
          action: () => setEmergencyOpen(true),
        },
        {
          id: 'v6',
          label: 'My Passes',
          icon: 'qr-code-outline',
          screen: 'Passes',
        },
        {
          id: 'v7',
          label: 'Entry Logs',
          icon: 'time-outline',
          screen: 'Entries',
        },
        {
          id: 'v8',
          label: 'Security Alerts',
          icon: 'notifications-outline',
          screen: 'Alerts',
        },
      ],
    },
    {
      id: 'feed',
      title: 'Feed',
      headerAction: {
        label: 'View all posts >',
        onPress: () => {
          setMoreServicesOpen(false);
          navigateTo('Community');
        },
      },
      items: [
        {
          id: 'f1',
          label: 'Create Post',
          icon: 'create-outline',
          action: () => {
            setMoreServicesOpen(false);
            setCreatePostModalOpen(true);
          },
        },
        {
          id: 'f2',
          label: 'Create Poll',
          icon: 'stats-chart-outline',
          action: () => {
            setMoreServicesOpen(false);
            setCreatePollModalOpen(true);
          },
        },
        {
          id: 'f3',
          label: 'Host an Event',
          icon: 'ribbon-outline',
          action: () => {
            setMoreServicesOpen(false);
            setCreateEventModalOpen(true);
          },
        },
        {
          id: 'f4',
          label: 'My Posts',
          icon: 'reader-outline',
          screen: 'Community',
        },
      ],
    },
    {
      id: 'property',
      title: 'Property & Maintenance',
      items: [
        {
          id: 'p1',
          label: 'Maintenance Bills',
          icon: 'receipt-outline',
          screen: 'Maintenance',
          badge: 'New Bill',
        },
        {
          id: 'p2',
          label: 'Complaints / Help',
          icon: 'clipboard-outline',
          screen: 'Complaints',
        },
        {
          id: 'p3',
          label: 'Emergency Contacts',
          icon: 'alert-circle-outline',
          action: () => setEmergencyOpen(true),
        },
      ],
    },
  ];

  const handleExecuteServiceItem = (item: ServiceItemDef) => {
    setMoreServicesOpen(false);
    if (item.action) {
      item.action();
    } else if (item.screen) {
      navigateTo(item.screen);
    }
  };

  // Filtered services for search
  const allFlattenedServices = serviceCategories.flatMap((cat) => cat.items);
  const filteredSearchResults = servicesSearchQuery.trim()
    ? allFlattenedServices.filter((s) =>
        s.label.toLowerCase().includes(servicesSearchQuery.toLowerCase().trim())
      )
    : [];

  // File and Document Picker
  const pickDocument = async (target: 'post' | 'event') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'image/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const isDoc = file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx');
        const isImg = file.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);

        const attachment: CommunityAttachment = {
          uri: file.uri,
          name: file.name,
          type: isPdf ? 'pdf' : isDoc ? 'doc' : isImg ? 'image' : 'file',
          size: file.size,
        };

        if (target === 'post') {
          setPostAttachment(attachment);
        } else {
          setEventAttachment(attachment);
        }
      }
    } catch {
      Alert.alert('File Selection', 'Could not pick the selected document.');
    }
  };

  // Image Gallery Picker
  const pickImage = async (target: 'post' | 'event') => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please enable media permission to attach photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const img = result.assets[0];
        const attachment: CommunityAttachment = {
          uri: img.uri,
          name: img.fileName || 'Photo.jpg',
          type: 'image',
          size: img.fileSize,
        };

        if (target === 'post') {
          setPostAttachment(attachment);
        } else {
          setEventAttachment(attachment);
        }
      }
    } catch {
      Alert.alert('Photo Selection', 'Could not pick photo from gallery.');
    }
  };

  // Handle Like on Post
  const handleToggleLike = (postId: string) => {
    setCommunityPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextIsLiked = !p.isLiked;
          return {
            ...p,
            isLiked: nextIsLiked,
            likes: nextIsLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
          };
        }
        return p;
      })
    );
  };

  // Handle Emoji Reaction
  const handleSelectReaction = (postId: string, emoji: string) => {
    setCommunityPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isSame = p.userReaction === emoji;
          return {
            ...p,
            userReaction: isSame ? undefined : emoji,
          };
        }
        return p;
      })
    );
    setReactionPickerPostId(null);
  };

  // Handle Share Post
  const handleSharePost = async (post: CommunityPostItem) => {
    try {
      await Share.share({
        title: post.title,
        message: `📢 *${post.title}*\n${post.content}\n\nPosted by ${post.author} (${post.authorUnit}) on Society Security App`,
      });
    } catch {
      // ignore
    }
  };

  // Handle Voting in Poll
  const handleVotePoll = (postId: string, optionId: string) => {
    setCommunityPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId && p.pollData) {
          const alreadyVoted = p.pollData.myVote === optionId;
          const updatedOptions = p.pollData.options.map((opt) => {
            if (opt.id === optionId) {
              return { ...opt, votes: alreadyVoted ? Math.max(0, opt.votes - 1) : opt.votes + 1 };
            }
            if (p.pollData?.myVote === opt.id && !alreadyVoted) {
              return { ...opt, votes: Math.max(0, opt.votes - 1) };
            }
            return opt;
          });
          return {
            ...p,
            pollData: {
              ...p.pollData,
              options: updatedOptions,
              totalVotes: alreadyVoted
                ? Math.max(0, p.pollData.totalVotes - 1)
                : p.pollData.myVote
                ? p.pollData.totalVotes
                : p.pollData.totalVotes + 1,
              myVote: alreadyVoted ? undefined : optionId,
            },
          };
        }
        return p;
      })
    );
  };

  // Handle Event RSVP
  const handleToggleEventRsvp = (postId: string) => {
    setCommunityPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId && p.eventData) {
          const nextRsvpd = !p.eventData.isRsvpd;
          return {
            ...p,
            eventData: {
              ...p.eventData,
              isRsvpd: nextRsvpd,
              rsvps: nextRsvpd ? p.eventData.rsvps + 1 : Math.max(0, p.eventData.rsvps - 1),
            },
          };
        }
        return p;
      })
    );
  };

  // Submit New Comment
  const handleAddComment = () => {
    if (!activeCommentPost || !newCommentInput.trim()) return;
    const newComment: CommunityComment = {
      id: `c-${Date.now()}`,
      author: userProfile?.name || 'Resident',
      authorUnit: myUnit,
      text: newCommentInput.trim(),
      time: 'Just now',
    };

    setCommunityPosts((prev) =>
      prev.map((p) => {
        if (p.id === activeCommentPost.id) {
          const updatedComments = [...p.comments, newComment];
          return { ...p, comments: updatedComments };
        }
        return p;
      })
    );

    setActiveCommentPost((prev) => (prev ? { ...prev, comments: [...prev.comments, newComment] } : null));
    setNewCommentInput('');
  };

  // Create General Post
  const handlePublishPost = () => {
    if (!postTitle.trim() || !postContent.trim()) {
      Alert.alert('Required fields', 'Please enter both a title and post content.');
      return;
    }
    const newPost: CommunityPostItem = {
      id: `post-${Date.now()}`,
      type: 'post',
      author: userProfile?.name || 'Resident',
      authorUnit: myUnit,
      time: 'Just now',
      title: postTitle.trim(),
      content: postContent.trim(),
      tag: postTag || 'General',
      likes: 0,
      isLiked: false,
      attachment: postAttachment || undefined,
      comments: [],
    };
    setCommunityPosts([newPost, ...communityPosts]);
    setPostTitle('');
    setPostContent('');
    setPostAttachment(null);
    setCreatePostModalOpen(false);
    Alert.alert('Post published!', 'Your post is now visible to all society residents.');
  };

  // Create Poll
  const handlePublishPoll = () => {
    if (!pollQuestion.trim() || !pollOption1.trim() || !pollOption2.trim()) {
      Alert.alert('Required fields', 'Please enter the poll question and at least two options.');
      return;
    }
    const options = [
      { id: 'opt-1', text: pollOption1.trim(), votes: 0 },
      { id: 'opt-2', text: pollOption2.trim(), votes: 0 },
    ];
    if (pollOption3.trim()) {
      options.push({ id: 'opt-3', text: pollOption3.trim(), votes: 0 });
    }
    const newPoll: CommunityPostItem = {
      id: `poll-${Date.now()}`,
      type: 'poll',
      author: userProfile?.name || 'Resident',
      authorUnit: myUnit,
      time: 'Just now',
      title: `Poll: ${pollQuestion.trim()}`,
      content: 'Community poll created for resident voting and feedback.',
      tag: 'Poll',
      likes: 0,
      isLiked: false,
      pollData: {
        question: pollQuestion.trim(),
        options,
        totalVotes: 0,
      },
      comments: [],
    };
    setCommunityPosts([newPoll, ...communityPosts]);
    setPollQuestion('');
    setPollOption1('');
    setPollOption2('');
    setPollOption3('');
    setCreatePollModalOpen(false);
    Alert.alert('Poll created!', 'Residents can now vote on your community poll.');
  };

  // Create Event
  const handlePublishEvent = () => {
    if (!eventTitle.trim() || !eventDate.trim() || !eventLocation.trim()) {
      Alert.alert('Required fields', 'Please fill in the event title, date, and venue location.');
      return;
    }
    const newEvent: CommunityPostItem = {
      id: `event-${Date.now()}`,
      type: 'event',
      author: userProfile?.name || 'Resident',
      authorUnit: myUnit,
      time: 'Just now',
      title: eventTitle.trim(),
      content: eventDesc.trim() || 'Join us for this exciting community event!',
      tag: 'Event',
      likes: 0,
      isLiked: false,
      attachment: eventAttachment || undefined,
      eventData: {
        date: eventDate.trim(),
        time: eventTime.trim() || '6:00 PM',
        location: eventLocation.trim(),
        rsvps: 1,
        isRsvpd: true,
      },
      comments: [],
    };
    setCommunityPosts([newEvent, ...communityPosts]);
    setEventTitle('');
    setEventDate('');
    setEventTime('');
    setEventLocation('');
    setEventDesc('');
    setEventAttachment(null);
    setCreateEventModalOpen(false);
    Alert.alert('Event hosted!', 'Your event is now listed for community RSVPs.');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* App Header (Top Unit Info + Search/Alerts/SOS) */}
        <View style={styles.appHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.unitBadge}>
              <View style={styles.unitBadgeIcon}>
                <Ionicons name="business" size={13} color={colors.primary} />
              </View>
              <Text style={styles.unitBadgeText}>
                {userProfile?.wing && userProfile?.flat
                  ? `TOWER ${userProfile.wing} • FLAT ${userProfile.flat}`
                  : 'SOCIETY RESIDENCE'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.greetingText}>Welcome, {name}</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setMoreServicesOpen(true)}
              accessibilityLabel="Search services"
            >
              <Ionicons name="search" size={19} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => navigateTo('Alerts')}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={19} color={colors.text} />
              {unreadAlertsCount > 0 && <View style={styles.headerBadgeDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sosButton}
              onPress={handleSOS}
              disabled={sendingSOS}
              accessibilityLabel="Emergency SOS"
            >
              <Ionicons name="warning" size={16} color={colors.danger} />
              <Text style={styles.sosText}>SOS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row (All 4 metrics in one single horizontal row - Pure Real-Time Analytics) */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="walk-outline" size={15} color={colors.text} />
            </View>
            <Text style={styles.metricNumber}>{entriesTodayCount}</Text>
            <Text style={styles.metricLabel} numberOfLines={1}>Visitors</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="qr-code-outline" size={15} color={colors.text} />
            </View>
            <Text style={styles.metricNumber}>{activePassesCount}</Text>
            <Text style={styles.metricLabel} numberOfLines={1}>Passes</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="notifications-outline" size={15} color={colors.text} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.metricNumber}>{unreadAlertsCount}</Text>
              {unreadAlertsCount > 0 && <View style={styles.redDot} />}
            </View>
            <Text style={styles.metricLabel} numberOfLines={1}>Alerts</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="people-outline" size={15} color={colors.text} />
            </View>
            <Text style={styles.metricNumber}>{householdSize}</Text>
            <Text style={styles.metricLabel} numberOfLines={1}>Household</Text>
          </View>
        </View>

        {/* ===== QUICK ACTIONS (8 Square Icon Grid) ===== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsGrid}>
          {/* 1. Pre-Approve / Create Pass */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => navigateTo('CreatePass')}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionIconBox}>
              <Ionicons name="person-add-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Pre-Approve</Text>
          </TouchableOpacity>

          {/* 2. Payments */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => navigateTo('Maintenance')}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionBadgePill}>
              <Text style={styles.quickActionBadgeText}>New Bill</Text>
            </View>
            <View style={styles.quickActionIconBox}>
              <Ionicons name="receipt-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Payments</Text>
          </TouchableOpacity>

          {/* 3. Helpdesk / Complaints */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => navigateTo('Complaints')}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionIconBox}>
              <Ionicons name="construct-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Helpdesk</Text>
          </TouchableOpacity>

          {/* 4. Amenities */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => navigateTo('Amenities')}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionIconBox}>
              <Ionicons name="fitness-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Amenities</Text>
          </TouchableOpacity>

          {/* 5. Resident & Guard Chat */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => navigateTo('ResidentChat')}
            activeOpacity={0.75}
          >
            {unreadDmCount > 0 && (
              <View style={styles.quickActionBadgePillRed}>
                <Text style={styles.quickActionBadgeText}>{unreadDmCount > 99 ? '99+' : unreadDmCount}</Text>
              </View>
            )}
            <View style={styles.quickActionIconBox}>
              <Ionicons name="chatbubbles-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Chat</Text>
          </TouchableOpacity>

          {/* 6. Domestic Workers */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => navigateTo('DomesticWorkers')}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionIconBox}>
              <Ionicons name="hammer-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Workers</Text>
          </TouchableOpacity>

          {/* 7. Household */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => navigateTo('Household')}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionIconBox}>
              <Ionicons name="people-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>Household</Text>
          </TouchableOpacity>

          {/* 8. View More (+) */}
          <TouchableOpacity
            style={styles.quickActionTile}
            onPress={() => {
              setServicesSearchQuery('');
              setMoreServicesOpen(true);
            }}
            activeOpacity={0.75}
          >
            <View style={[styles.quickActionIconBox, styles.viewMoreTileHighlight]}>
              <Ionicons name="add" size={28} color={colors.text} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>
              View More
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===== TODAY'S ENTRY UPDATES (Tap avatar to view details) ===== */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="notifications-outline" size={17} color={colors.text} />
            <Text style={styles.sectionTitle}>Today's Entry Updates</Text>
          </View>
          <TouchableOpacity onPress={() => navigateTo('Entries')}>
            <Text style={styles.seeAllText}>View All &gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.entryUpdatesContainer}>
          {entries.length === 0 ? (
            <View style={styles.emptyEntryContainer}>
              <Ionicons name="shield-checkmark-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyEntryText}>No visitor entry updates today</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.entryAvatarsScroll}
            >
              {entries.map((item, index) => {
                const isExited = item.status === 'Exited';
                const avatarBg = ['#FEF3C7', '#E0F2FE', '#F3E8FF', '#DCFCE7', '#FEE2E2'][index % 5];
                const avatarTextColor = ['#B45309', '#0284C7', '#7E22CE', '#15803D', '#B91C1C'][index % 5];
                const initial = item.name ? item.name.charAt(0).toUpperCase() : 'V';

                return (
                  <TouchableOpacity
                    key={item.id || index}
                    style={styles.entryAvatarItem}
                    onPress={() => setSelectedEntry(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.avatarCircleWrapper}>
                      <View style={[styles.avatarCircle, { backgroundColor: avatarBg }]}>
                        <Text style={[styles.avatarInitials, { color: avatarTextColor }]}>{initial}</Text>
                      </View>
                      {/* Active green/amber status dot */}
                      <View
                        style={[
                          styles.avatarStatusDot,
                          { backgroundColor: isExited ? '#F59E0B' : '#22C55E' },
                        ]}
                      />
                    </View>
                    <Text style={styles.entryAvatarName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.entryAvatarSub} numberOfLines={1}>
                      {item.status || 'Entered'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ===== COMMUNITY POSTS & NEW POST BUTTON ===== */}
        <View style={[styles.sectionHeader, { marginTop: 14 }]}>
          <Text style={styles.sectionTitle}>Community Posts</Text>
          <TouchableOpacity
            style={styles.newPostButton}
            onPress={() => setCreatePostSheetOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color="#0284C7" style={{ marginRight: 4 }} />
            <Text style={styles.newPostButtonText}>New Post</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Feed of Community Posts */}
        {communityPosts.map((post) => {
          const isPoll = post.type === 'poll' && post.pollData;
          const isEvent = post.type === 'event' && post.eventData;
          const isNotice = post.type === 'notice';

          return (
            <View key={post.id} style={styles.postCard}>
              {/* Header */}
              <View style={styles.postCardHeader}>
                <View style={styles.postAuthorInfo}>
                  {isNotice ? (
                    <View style={styles.noticeIconBox}>
                      <Ionicons name="clipboard" size={18} color="#D97706" />
                      <View style={styles.noticeCountBadge}>
                        <Text style={styles.noticeCountText}>9</Text>
                      </View>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.avatarCircle,
                        {
                          width: 38,
                          height: 38,
                          backgroundColor: isEvent ? '#F3E8FF' : isPoll ? '#E0F2FE' : '#FEF3C7',
                        },
                      ]}
                    >
                      <Ionicons
                        name={isEvent ? 'calendar' : isPoll ? 'stats-chart' : 'person'}
                        size={18}
                        color={isEvent ? '#9333EA' : isPoll ? '#0284C7' : '#D97706'}
                      />
                    </View>
                  )}
                  <View>
                    <Text style={styles.postAuthorName}>{post.author}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <View style={styles.postTagBadge}>
                        <Text style={styles.postTagText}>{post.tag || 'Community'}</Text>
                      </View>
                      <Text style={styles.postTimestamp}>
                        {post.authorUnit} • {post.time}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity onPress={() => handleSharePost(post)}>
                  <Ionicons name="share-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <View style={styles.postContent}>
                <Text style={styles.postHeadline}>{post.title}</Text>
                <Text style={styles.postBody}>{post.content}</Text>

                {/* Attached File Preview (Tap to open full-screen viewer) */}
                {post.attachment && (
                  <View style={{ marginTop: 10 }}>
                    {post.attachment.type === 'image' ? (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setPreviewAttachment(post.attachment || null)}
                        style={styles.postAttachmentImageWrap}
                      >
                        <Image
                          source={{ uri: post.attachment.uri }}
                          style={styles.postAttachmentImage}
                          resizeMode="cover"
                        />
                        <View style={styles.expandBadge}>
                          <Ionicons name="expand-outline" size={14} color="white" />
                          <Text style={styles.expandBadgeText}>Tap to view full photo</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.postAttachmentDocBox}
                        onPress={() => setPreviewAttachment(post.attachment || null)}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.attachmentDocIconSmall,
                            {
                              backgroundColor:
                                post.attachment.type === 'pdf' ? '#FEE2E2' : '#E0F2FE',
                            },
                          ]}
                        >
                          <Ionicons
                            name={post.attachment.type === 'pdf' ? 'document-text' : 'document'}
                            size={18}
                            color={post.attachment.type === 'pdf' ? '#DC2626' : '#0284C7'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.postAttachmentDocName} numberOfLines={1}>
                            {post.attachment.name}
                          </Text>
                          <Text style={styles.postAttachmentDocSub}>
                            {post.attachment.type.toUpperCase()} Document • Tap to open & preview
                          </Text>
                        </View>
                        <Ionicons name="eye-outline" size={18} color="#0284C7" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Poll Options if Poll */}
                {isPoll && post.pollData && (
                  <View style={styles.pollContainer}>
                    <Text style={styles.pollQuestionText}>{post.pollData.question}</Text>
                    {post.pollData.options.map((opt) => {
                      const isSelected = post.pollData?.myVote === opt.id;
                      const percentage =
                        post.pollData && post.pollData.totalVotes > 0
                          ? Math.round((opt.votes / post.pollData.totalVotes) * 100)
                          : 0;

                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.pollOptionBox,
                            isSelected && { borderColor: '#0284C7', backgroundColor: '#F0F9FF' },
                          ]}
                          onPress={() => handleVotePoll(post.id, opt.id)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.pollProgressFill,
                              { width: `${percentage}%`, backgroundColor: isSelected ? '#BAE6FD' : '#E2E8F0' },
                            ]}
                          />
                          <View style={styles.pollOptionRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                              <View
                                style={[
                                  styles.pollRadio,
                                  isSelected && { borderColor: '#0284C7', backgroundColor: '#0284C7' },
                                ]}
                              >
                                {isSelected && <View style={styles.pollRadioDot} />}
                              </View>
                              <Text style={[styles.pollOptionLabel, isSelected && { fontWeight: '700', color: '#0369A1' }]}>
                                {opt.text}
                              </Text>
                            </View>
                            <Text style={styles.pollVoteCount}>
                              {percentage}% ({opt.votes})
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    <Text style={styles.pollTotalVotesText}>{post.pollData.totalVotes} total votes</Text>
                  </View>
                )}

                {/* Event Card if Event */}
                {isEvent && post.eventData && (
                  <View style={styles.eventBox}>
                    <View style={styles.eventDetailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#9333EA" />
                      <Text style={styles.eventDetailText}>
                        {post.eventData.date} • {post.eventData.time}
                      </Text>
                    </View>
                    <View style={styles.eventDetailRow}>
                      <Ionicons name="location-outline" size={16} color="#9333EA" />
                      <Text style={styles.eventDetailText}>{post.eventData.location}</Text>
                    </View>
                    <View style={styles.eventDetailRow}>
                      <Ionicons name="people-outline" size={16} color="#9333EA" />
                      <Text style={styles.eventDetailText}>{post.eventData.rsvps} residents attending</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.eventRsvpBtn,
                        post.eventData.isRsvpd && { backgroundColor: '#9333EA' },
                      ]}
                      onPress={() => handleToggleEventRsvp(post.id)}
                    >
                      <Ionicons
                        name={post.eventData.isRsvpd ? 'checkmark-circle' : 'add-circle-outline'}
                        size={16}
                        color={post.eventData.isRsvpd ? 'white' : '#9333EA'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.eventRsvpBtnText,
                          post.eventData.isRsvpd && { color: 'white' },
                        ]}
                      >
                        {post.eventData.isRsvpd ? 'Attending (RSVPed)' : 'RSVP to Event'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Active user reaction badge if any */}
                {post.userReaction && (
                  <View style={styles.activeReactionBadge}>
                    <Text style={{ fontSize: 13 }}>You reacted {post.userReaction}</Text>
                  </View>
                )}

                {/* Reactions & Interaction Action Row */}
                <View style={styles.reactionsRow}>
                  {/* Like Button */}
                  <TouchableOpacity
                    style={styles.reactionItem}
                    onPress={() => handleToggleLike(post.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={post.isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={18}
                      color={post.isLiked ? '#0284C7' : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.reactionText,
                        post.isLiked && { color: '#0284C7', fontWeight: '700' },
                      ]}
                    >
                      {post.likes}
                    </Text>
                  </TouchableOpacity>

                  {/* React Emoji Picker Trigger */}
                  <TouchableOpacity
                    style={styles.reactionItem}
                    onPress={() =>
                      setReactionPickerPostId(reactionPickerPostId === post.id ? null : post.id)
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons name="happy-outline" size={18} color={colors.textMuted} />
                    <Text style={styles.reactionText}>React</Text>
                  </TouchableOpacity>

                  {/* Message / Comments Button */}
                  <TouchableOpacity
                    style={styles.reactionItem}
                    onPress={() => setActiveCommentPost(post)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chatbox-outline" size={18} color={colors.textMuted} />
                    <Text style={styles.reactionText}>
                      {post.comments.length > 0 ? `${post.comments.length} Comments` : 'Message'}
                    </Text>
                  </TouchableOpacity>

                  {/* Share Button */}
                  <TouchableOpacity
                    style={styles.reactionItem}
                    onPress={() => handleSharePost(post)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="share-social-outline" size={18} color={colors.textMuted} />
                    <Text style={styles.reactionText}>Share</Text>
                  </TouchableOpacity>
                </View>

                {/* Popover Emoji Picker */}
                {reactionPickerPostId === post.id && (
                  <View style={styles.emojiPickerBox}>
                    {['👍', '❤️', '👏', '🎉', '🔥', '🙏'].map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.emojiButton}
                        onPress={() => handleSelectReaction(post.id, emoji)}
                      >
                        <Text style={{ fontSize: 20 }}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Emergency Assistance Quick Bar */}
        <TouchableOpacity
          style={[styles.actionBtnFull, { backgroundColor: colors.dangerLight, marginTop: 16 }]}
          onPress={() => setEmergencyOpen(true)}
          activeOpacity={0.8}
        >
          <View style={styles.actionIconWrap}>
            <Ionicons name="alert-circle" size={22} color={colors.danger} />
          </View>
          <Text style={[styles.actionBtnText, { color: colors.danger, flex: 0, marginLeft: 8 }]}>
            Emergency Services & SOS
          </Text>
        </TouchableOpacity>

        {/* Bottom spacer */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ===== 1. TOP SHEET: CREATE A COMMUNITY POST (3 OPTIONS) ===== */}
      <Modal
        visible={createPostSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreatePostSheetOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.createPostSheetContainer}>
            <View style={styles.createPostSheetHeader}>
              <Text style={styles.createPostSheetTitle}>Create a community post</Text>
              <TouchableOpacity
                style={styles.moreServicesCloseBtn}
                onPress={() => setCreatePostSheetOpen(false)}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.createPostOptionsRow}>
              {/* Option 1: Create Post */}
              <TouchableOpacity
                style={styles.createPostOptionItem}
                onPress={() => {
                  setCreatePostSheetOpen(false);
                  setCreatePostModalOpen(true);
                }}
              >
                <View style={styles.createPostOptionCircle}>
                  <Ionicons name="create-outline" size={28} color="#0284C7" />
                </View>
                <Text style={styles.createPostOptionLabel}>Create Post</Text>
              </TouchableOpacity>

              {/* Option 2: Create Poll */}
              <TouchableOpacity
                style={styles.createPostOptionItem}
                onPress={() => {
                  setCreatePostSheetOpen(false);
                  setCreatePollModalOpen(true);
                }}
              >
                <View style={[styles.createPostOptionCircle, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="stats-chart-outline" size={28} color="#16A34A" />
                </View>
                <Text style={styles.createPostOptionLabel}>Create Poll</Text>
              </TouchableOpacity>

              {/* Option 3: Host an Event */}
              <TouchableOpacity
                style={styles.createPostOptionItem}
                onPress={() => {
                  setCreatePostSheetOpen(false);
                  setCreateEventModalOpen(true);
                }}
              >
                <View style={[styles.createPostOptionCircle, { backgroundColor: '#FAF5FF' }]}>
                  <Ionicons name="calendar-outline" size={28} color="#9333EA" />
                </View>
                <Text style={styles.createPostOptionLabel}>Host an Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== 2. MODAL: CREATE GENERAL POST ===== */}
      <Modal
        visible={createPostModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreatePostModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.formModalContainer}>
            <View style={styles.formModalHeader}>
              <Text style={styles.formModalTitle}>Create Community Post</Text>
              <TouchableOpacity onPress={() => setCreatePostModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formFieldLabel}>Post Title / Headline *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. Lost Cat / Clubhouse Cleaning"
                placeholderTextColor={colors.textMuted}
                value={postTitle}
                onChangeText={setPostTitle}
              />

              <Text style={styles.formFieldLabel}>Category Tag</Text>
              <View style={styles.tagsRow}>
                {['General', 'Notice', 'Query', 'Help'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tagPill, postTag === t && styles.tagPillActive]}
                    onPress={() => setPostTag(t)}
                  >
                    <Text style={[styles.tagPillText, postTag === t && styles.tagPillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formFieldLabel}>Description / Message *</Text>
              <TextInput
                style={[styles.formTextInput, { height: 90, textAlignVertical: 'top' }]}
                placeholder="Share your message with all society residents..."
                placeholderTextColor={colors.textMuted}
                value={postContent}
                onChangeText={setPostContent}
                multiline
              />

              {/* Attach File / Photo Section */}
              <Text style={styles.formFieldLabel}>Attach File or Photo (Optional)</Text>
              {postAttachment ? (
                <View style={styles.attachmentPreviewBox}>
                  <View style={styles.attachmentPreviewLeft}>
                    {postAttachment.type === 'image' ? (
                      <Image source={{ uri: postAttachment.uri }} style={styles.attachmentThumbImg} />
                    ) : (
                      <View
                        style={[
                          styles.attachmentDocIcon,
                          {
                            backgroundColor:
                              postAttachment.type === 'pdf' ? '#FEE2E2' : '#E0F2FE',
                          },
                        ]}
                      >
                        <Ionicons
                          name={postAttachment.type === 'pdf' ? 'document-text' : 'document'}
                          size={22}
                          color={postAttachment.type === 'pdf' ? '#DC2626' : '#0284C7'}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.attachmentFileName} numberOfLines={1}>
                        {postAttachment.name}
                      </Text>
                      <Text style={styles.attachmentFileSize}>
                        {postAttachment.type.toUpperCase()} File
                        {postAttachment.size ? ` • ${(postAttachment.size / 1024).toFixed(1)} KB` : ''}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.attachmentRemoveBtn}
                    onPress={() => setPostAttachment(null)}
                  >
                    <Ionicons name="close-circle" size={22} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.attachmentButtonRow}>
                  <TouchableOpacity
                    style={styles.attachmentPickerBtn}
                    onPress={() => pickImage('post')}
                  >
                    <Ionicons name="image-outline" size={18} color="#0284C7" style={{ marginRight: 6 }} />
                    <Text style={styles.attachmentPickerBtnText}>Add Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.attachmentPickerBtn, { borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }]}
                    onPress={() => pickDocument('post')}
                  >
                    <Ionicons name="document-attach-outline" size={18} color="#9333EA" style={{ marginRight: 6 }} />
                    <Text style={[styles.attachmentPickerBtnText, { color: '#9333EA' }]}>Add PDF / Doc</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.formSubmitBtn} onPress={handlePublishPost}>
                <Ionicons name="send" size={16} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.formSubmitBtnText}>Publish to Community</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== 3. MODAL: CREATE POLL ===== */}
      <Modal
        visible={createPollModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreatePollModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.formModalContainer}>
            <View style={styles.formModalHeader}>
              <Text style={styles.formModalTitle}>Create a Poll</Text>
              <TouchableOpacity onPress={() => setCreatePollModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formFieldLabel}>Poll Question *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. Preferred time for AGM meeting?"
                placeholderTextColor={colors.textMuted}
                value={pollQuestion}
                onChangeText={setPollQuestion}
              />

              <Text style={styles.formFieldLabel}>Option 1 *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. Saturday 10:00 AM"
                placeholderTextColor={colors.textMuted}
                value={pollOption1}
                onChangeText={setPollOption1}
              />

              <Text style={styles.formFieldLabel}>Option 2 *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. Sunday 5:00 PM"
                placeholderTextColor={colors.textMuted}
                value={pollOption2}
                onChangeText={setPollOption2}
              />

              <Text style={styles.formFieldLabel}>Option 3 (Optional)</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. Online via Google Meet"
                placeholderTextColor={colors.textMuted}
                value={pollOption3}
                onChangeText={setPollOption3}
              />

              <TouchableOpacity
                style={[styles.formSubmitBtn, { backgroundColor: '#16A34A' }]}
                onPress={handlePublishPoll}
              >
                <Ionicons name="stats-chart" size={16} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.formSubmitBtnText}>Launch Community Poll</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== 4. MODAL: HOST AN EVENT ===== */}
      <Modal
        visible={createEventModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateEventModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.formModalContainer}>
            <View style={styles.formModalHeader}>
              <Text style={styles.formModalTitle}>Host an Event</Text>
              <TouchableOpacity onPress={() => setCreateEventModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formFieldLabel}>Event Title *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. Weekend Cricket Tournament / Ganesh Utsav"
                placeholderTextColor={colors.textMuted}
                value={eventTitle}
                onChangeText={setEventTitle}
              />

              <Text style={styles.formFieldLabel}>Date *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. Sunday, 24 October"
                placeholderTextColor={colors.textMuted}
                value={eventDate}
                onChangeText={setEventDate}
              />

              <Text style={styles.formFieldLabel}>Time</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. 5:00 PM - 8:00 PM"
                placeholderTextColor={colors.textMuted}
                value={eventTime}
                onChangeText={setEventTime}
              />

              <Text style={styles.formFieldLabel}>Venue / Location *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. Main Clubhouse / Central Lawn"
                placeholderTextColor={colors.textMuted}
                value={eventLocation}
                onChangeText={setEventLocation}
              />

              <Text style={styles.formFieldLabel}>Description</Text>
              <TextInput
                style={[styles.formTextInput, { height: 75, textAlignVertical: 'top' }]}
                placeholder="Tell residents what to expect..."
                placeholderTextColor={colors.textMuted}
                value={eventDesc}
                onChangeText={setEventDesc}
                multiline
              />

              {/* Event Attachment */}
              <Text style={styles.formFieldLabel}>Event Flyer / Banner / Doc (Optional)</Text>
              {eventAttachment ? (
                <View style={styles.attachmentPreviewBox}>
                  <View style={styles.attachmentPreviewLeft}>
                    {eventAttachment.type === 'image' ? (
                      <Image source={{ uri: eventAttachment.uri }} style={styles.attachmentThumbImg} />
                    ) : (
                      <View
                        style={[
                          styles.attachmentDocIcon,
                          {
                            backgroundColor:
                              eventAttachment.type === 'pdf' ? '#FEE2E2' : '#E0F2FE',
                          },
                        ]}
                      >
                        <Ionicons
                          name={eventAttachment.type === 'pdf' ? 'document-text' : 'document'}
                          size={22}
                          color={eventAttachment.type === 'pdf' ? '#DC2626' : '#0284C7'}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.attachmentFileName} numberOfLines={1}>
                        {eventAttachment.name}
                      </Text>
                      <Text style={styles.attachmentFileSize}>
                        {eventAttachment.type.toUpperCase()} File
                        {eventAttachment.size ? ` • ${(eventAttachment.size / 1024).toFixed(1)} KB` : ''}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.attachmentRemoveBtn}
                    onPress={() => setEventAttachment(null)}
                  >
                    <Ionicons name="close-circle" size={22} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.attachmentButtonRow}>
                  <TouchableOpacity
                    style={styles.attachmentPickerBtn}
                    onPress={() => pickImage('event')}
                  >
                    <Ionicons name="image-outline" size={18} color="#0284C7" style={{ marginRight: 6 }} />
                    <Text style={styles.attachmentPickerBtnText}>Add Flyer Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.attachmentPickerBtn, { borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }]}
                    onPress={() => pickDocument('event')}
                  >
                    <Ionicons name="document-attach-outline" size={18} color="#9333EA" style={{ marginRight: 6 }} />
                    <Text style={[styles.attachmentPickerBtnText, { color: '#9333EA' }]}>Add Pamphlet PDF</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.formSubmitBtn, { backgroundColor: '#9333EA' }]}
                onPress={handlePublishEvent}
              >
                <Ionicons name="calendar" size={16} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.formSubmitBtnText}>Publish Event</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== 5. MODAL: ENTRY / VISITOR DETAILS ===== */}
      <Modal
        visible={!!selectedEntry}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEntry(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedEntry && (
            <View style={styles.entryDetailsModal}>
              <View style={styles.entryDetailsHeader}>
                <Text style={styles.entryDetailsTitle}>Visitor Entry Details</Text>
                <TouchableOpacity onPress={() => setSelectedEntry(null)}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.entryDetailsBody}>
                {/* Avatar with Status */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View
                    style={[
                      styles.avatarCircle,
                      { width: 68, height: 68, borderRadius: 34, backgroundColor: '#E0F2FE' },
                    ]}
                  >
                    <Text style={{ fontSize: 26, fontWeight: '800', color: '#0284C7' }}>
                      {selectedEntry.name ? selectedEntry.name.charAt(0).toUpperCase() : 'V'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 8 }}>
                    {selectedEntry.name}
                  </Text>
                  <View
                    style={[
                      styles.entryStatusPill,
                      {
                        backgroundColor:
                          selectedEntry.status === 'Exited' ? '#FEF3C7' : '#DCFCE7',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.avatarStatusDot,
                        {
                          position: 'relative',
                          marginRight: 6,
                          backgroundColor:
                            selectedEntry.status === 'Exited' ? '#F59E0B' : '#22C55E',
                        },
                      ]}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: selectedEntry.status === 'Exited' ? '#B45309' : '#15803D',
                      }}
                    >
                      {selectedEntry.status || 'Inside Society'}
                    </Text>
                  </View>
                </View>

                {/* Details Breakdown */}
                <View style={styles.entryInfoBox}>
                  <View style={styles.entryInfoRow}>
                    <Text style={styles.entryInfoLabel}>Gate:</Text>
                    <Text style={styles.entryInfoVal}>{selectedEntry.gate || 'Main East Gate'}</Text>
                  </View>
                  <View style={styles.entryInfoRow}>
                    <Text style={styles.entryInfoLabel}>Entry Time:</Text>
                    <Text style={styles.entryInfoVal}>{selectedEntry.time || 'Today'}</Text>
                  </View>
                  <View style={styles.entryInfoRow}>
                    <Text style={styles.entryInfoLabel}>Visiting Unit:</Text>
                    <Text style={styles.entryInfoVal}>{myUnit}</Text>
                  </View>
                  <View style={styles.entryInfoRow}>
                    <Text style={styles.entryInfoLabel}>Purpose:</Text>
                    <Text style={styles.entryInfoVal}>
                      {selectedEntry.purpose || selectedEntry.type || 'Guest Visit'}
                    </Text>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.entryActionBtn, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}
                    onPress={() => {
                      setSelectedEntry(null);
                      navigateTo('Entries');
                    }}
                  >
                    <Ionicons name="list" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#0284C7', fontWeight: '700', fontSize: 13 }}>All Entries</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.entryActionBtn,
                      { backgroundColor: isDark ? '#38bdf8' : '#0f172a', borderColor: isDark ? '#38bdf8' : '#0f172a' },
                    ]}
                    onPress={() => setSelectedEntry(null)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={isDark ? '#0f172a' : '#ffffff'} style={{ marginRight: 6 }} />
                    <Text style={{ color: isDark ? '#0f172a' : '#ffffff', fontWeight: '700', fontSize: 13 }}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ===== 6. FULL-SCREEN ATTACHMENT VIEWER MODAL ===== */}
      <Modal
        visible={!!previewAttachment}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewAttachment(null)}
      >
        <View style={styles.mediaViewerOverlay}>
          {previewAttachment && (
            <View style={styles.mediaViewerContainer}>
              {/* Header Bar */}
              <View style={styles.mediaViewerHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.mediaViewerTitle} numberOfLines={1}>
                    {previewAttachment.name}
                  </Text>
                  <Text style={styles.mediaViewerSubtitle}>
                    {previewAttachment.type.toUpperCase()} Attachment
                    {previewAttachment.size ? ` • ${(previewAttachment.size / 1024).toFixed(1)} KB` : ''}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity
                    style={styles.mediaViewerIconBtn}
                    onPress={async () => {
                      try {
                        if (await Sharing.isAvailableAsync()) {
                          await Sharing.shareAsync(previewAttachment.uri);
                        } else {
                          Share.share({ url: previewAttachment.uri, title: previewAttachment.name });
                        }
                      } catch {
                        Alert.alert('Share', 'Could not share this file.');
                      }
                    }}
                  >
                    <Ionicons name="share-outline" size={20} color="white" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.mediaViewerIconBtn}
                    onPress={() => setPreviewAttachment(null)}
                  >
                    <Ionicons name="close" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Main Content */}
              {previewAttachment.type === 'image' ? (
                <View style={styles.mediaViewerImageContainer}>
                  <Image
                    source={{ uri: previewAttachment.uri }}
                    style={styles.mediaViewerFullImage}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <View style={styles.mediaViewerDocContainer}>
                  <View
                    style={[
                      styles.mediaViewerDocLargeIcon,
                      {
                        backgroundColor:
                          previewAttachment.type === 'pdf' ? '#FEE2E2' : '#E0F2FE',
                      },
                    ]}
                  >
                    <Ionicons
                      name={previewAttachment.type === 'pdf' ? 'document-text' : 'document'}
                      size={54}
                      color={previewAttachment.type === 'pdf' ? '#DC2626' : '#0284C7'}
                    />
                  </View>

                  <Text style={styles.mediaViewerDocBigTitle}>
                    {previewAttachment.name}
                  </Text>
                  <Text style={styles.mediaViewerDocDesc}>
                    {previewAttachment.type === 'pdf' ? 'PDF Document' : 'Document File'} • Ready to open or share
                  </Text>

                  <TouchableOpacity
                    style={styles.mediaViewerOpenBtn}
                    onPress={async () => {
                      try {
                        if (await Sharing.isAvailableAsync()) {
                          await Sharing.shareAsync(previewAttachment.uri);
                        } else {
                          Linking.openURL(previewAttachment.uri);
                        }
                      } catch {
                        Alert.alert('File', 'Could not open the file.');
                      }
                    }}
                  >
                    <Ionicons name="open-outline" size={18} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.mediaViewerOpenBtnText}>Open / Export File</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* ===== 7. MODAL: POST COMMENTS & MESSAGING ===== */}
      <Modal
        visible={!!activeCommentPost}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveCommentPost(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          {activeCommentPost && (
            <View style={styles.commentModalContainer}>
              <View style={styles.formModalHeader}>
                <View>
                  <Text style={styles.formModalTitle}>Comments & Discussion</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                    {activeCommentPost.title}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveCommentPost(null)}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 280, paddingHorizontal: 16 }}>
                {activeCommentPost.comments.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13 }}>
                      No comments yet. Be the first to start the conversation!
                    </Text>
                  </View>
                ) : (
                  activeCommentPost.comments.map((comment) => (
                    <View key={comment.id} style={styles.commentItemBox}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>
                          {comment.author}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>{comment.time}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                        {comment.authorUnit}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>{comment.text}</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Comment Input */}
              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentTextInput}
                  placeholder="Write a comment..."
                  placeholderTextColor={colors.textMuted}
                  value={newCommentInput}
                  onChangeText={setNewCommentInput}
                />
                <TouchableOpacity
                  style={[
                    styles.sendCommentBtn,
                    !newCommentInput.trim() && { opacity: 0.5 },
                  ]}
                  onPress={handleAddComment}
                  disabled={!newCommentInput.trim()}
                >
                  <Ionicons name="send" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== 8. FULL-SCREEN CATEGORIZED VIEW MORE & SEARCH PAGE ===== */}
      <Modal
        visible={moreServicesOpen}
        animationType="slide"
        onRequestClose={() => setMoreServicesOpen(false)}
      >
        <View style={[styles.viewMoreScreenContainer, { paddingTop: insets.top + 8 }]}>
          {/* Header with Back Arrow + Search Input */}
          <View style={styles.viewMoreHeaderBar}>
            <TouchableOpacity
              style={styles.viewMoreBackBtn}
              onPress={() => setMoreServicesOpen(false)}
              accessibilityLabel="Back to Home"
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.viewMoreSearchBar}>
              <Ionicons name="search-outline" size={20} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.viewMoreSearchInput}
                placeholder="What are you looking for?"
                placeholderTextColor={colors.textMuted}
                value={servicesSearchQuery}
                onChangeText={setServicesSearchQuery}
                autoFocus={false}
              />
              {servicesSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setServicesSearchQuery('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.viewMoreScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* If searching: show flat filtered search results */}
            {servicesSearchQuery.trim().length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.searchResultsTitle}>
                  Search Results ({filteredSearchResults.length})
                </Text>

                {filteredSearchResults.length === 0 ? (
                  <View style={styles.noSearchFoundBox}>
                    <Ionicons name="search" size={36} color={colors.textMuted} />
                    <Text style={styles.noSearchFoundText}>
                      No services found for "{servicesSearchQuery}"
                    </Text>
                  </View>
                ) : (
                  <View style={styles.viewMoreGrid}>
                    {filteredSearchResults.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.viewMoreTile}
                        onPress={() => handleExecuteServiceItem(item)}
                        activeOpacity={0.75}
                      >
                        {item.badge && (
                          <View style={styles.quickActionBadgePill}>
                            <Text style={styles.quickActionBadgeText}>{item.badge}</Text>
                          </View>
                        )}
                        <View style={styles.viewMoreIconBox}>
                          <Ionicons name={item.icon} size={26} color={colors.text} />
                        </View>
                        <Text style={styles.viewMoreTileLabel} numberOfLines={2}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              /* If not searching: show all full categories (as in photo) */
              serviceCategories.map((cat) => (
                <View key={cat.id} style={styles.viewMoreCategorySection}>
                  <View style={styles.viewMoreCategoryHeader}>
                    <Text style={styles.viewMoreCategoryTitle}>{cat.title}</Text>
                    {cat.headerAction && (
                      <TouchableOpacity
                        style={[
                          styles.categoryHeaderActionBtn,
                          cat.headerAction.isAlert && styles.categoryHeaderAlertBtn,
                        ]}
                        onPress={cat.headerAction.onPress}
                      >
                        {cat.headerAction.isAlert && (
                          <Ionicons name="warning-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                        )}
                        <Text
                          style={[
                            styles.categoryHeaderActionText,
                            cat.headerAction.isAlert && styles.categoryHeaderAlertText,
                          ]}
                        >
                          {cat.headerAction.label}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.viewMoreGrid}>
                    {cat.items.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.viewMoreTile}
                        onPress={() => handleExecuteServiceItem(item)}
                        activeOpacity={0.75}
                      >
                        {item.badge && (
                          <View style={styles.quickActionBadgePill}>
                            <Text style={styles.quickActionBadgeText}>{item.badge}</Text>
                          </View>
                        )}
                        <View style={styles.viewMoreIconBox}>
                          <Ionicons name={item.icon} size={26} color={colors.text} />
                        </View>
                        <Text style={styles.viewMoreTileLabel} numberOfLines={2}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ===== 9. EMERGENCY CONTACTS MODAL ===== */}
      <Modal visible={emergencyOpen} transparent animationType="fade" onRequestClose={() => setEmergencyOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.emergencyModal}>
            <Text style={styles.emergencyTitle}>Emergency Contacts</Text>
            <TouchableOpacity style={styles.emergencyOption} onPress={() => { setEmergencyOpen(false); Linking.openURL('tel:100'); }}>
              <Ionicons name="shield" size={24} color="#1D4ED8" style={{ marginRight: 16 }} />
              <Text style={styles.emergencyOptionText}>Police</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emergencyOption} onPress={() => { setEmergencyOpen(false); Linking.openURL('tel:102'); }}>
              <Ionicons name="medkit" size={24} color="#16A34A" style={{ marginRight: 16 }} />
              <Text style={styles.emergencyOptionText}>Ambulance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emergencyOption} onPress={() => { setEmergencyOpen(false); Linking.openURL('tel:101'); }}>
              <Ionicons name="flame" size={24} color="#EA580C" style={{ marginRight: 16 }} />
              <Text style={styles.emergencyOptionText}>Fire Brigade</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.emergencyOption, { borderBottomWidth: 0 }]} onPress={() => { setEmergencyOpen(false); handleSOS(); }}>
              <Text style={styles.emergencyOptionEmoji}>🛡️</Text>
              <Text style={styles.emergencyOptionText}>Security Guard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setEmergencyOpen(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
  },
  unitBadgeIcon: {
    marginRight: 4,
  },
  unitBadgeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerBadgeDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  sosButton: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  sosText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: isDark ? '#334155' : '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
    marginLeft: 3,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  seeAllText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    rowGap: 14,
  },
  quickActionTile: {
    width: '23%',
    alignItems: 'center',
    position: 'relative',
  },
  quickActionIconBox: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  viewMoreTileHighlight: {
    backgroundColor: isDark ? '#334155' : '#f1f5f9',
    borderColor: colors.border,
  },
  quickActionBadgePill: {
    position: 'absolute',
    top: -6,
    zIndex: 2,
    backgroundColor: '#0284C7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  quickActionBadgePillRed: {
    position: 'absolute',
    top: -6,
    right: 6,
    zIndex: 10,
    backgroundColor: '#ef4444',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  quickActionBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  entryUpdatesContainer: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  entryAvatarsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  entryAvatarItem: {
    alignItems: 'center',
    width: 64,
  },
  avatarCircleWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '800',
  },
  avatarStatusDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  entryAvatarName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  entryAvatarSub: {
    fontSize: 9.5,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 1,
  },
  emptyEntryContainer: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyEntryText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  newPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newPostButtonText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  postCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  postAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  noticeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  noticeCountBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#DC2626',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticeCountText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
  },
  postAuthorName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  postTagBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  postTagText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  },
  postTimestamp: {
    fontSize: 11,
    color: colors.textMuted,
  },
  postContent: {
    marginTop: 2,
  },
  postHeadline: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  postBody: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  postAttachmentImageWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 6,
  },
  postAttachmentImage: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  expandBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  expandBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  postAttachmentDocBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
  },
  attachmentDocIconSmall: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  postAttachmentDocName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  postAttachmentDocSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  pollContainer: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pollQuestionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  pollOptionBox: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  pollProgressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  pollOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 12,
  },
  pollRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pollRadioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
  },
  pollOptionLabel: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  pollVoteCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  pollTotalVotesText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'right',
  },
  eventBox: {
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  eventDetailText: {
    fontSize: 13,
    color: '#6B21A8',
    fontWeight: '600',
  },
  eventRsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#C084FC',
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  eventRsvpBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9333EA',
  },
  activeReactionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 8,
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 12,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  reactionText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  emojiPickerBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emojiButton: {
    padding: 6,
  },
  attachmentPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  attachmentPreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attachmentThumbImg: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  attachmentDocIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentFileName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  attachmentFileSize: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  attachmentRemoveBtn: {
    padding: 4,
  },
  attachmentButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  attachmentPickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingVertical: 10,
  },
  attachmentPickerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  actionIconWrap: {
    marginRight: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  actionBtnFull: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  createPostSheetContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  createPostSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  createPostSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  createPostOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
  },
  createPostOptionItem: {
    alignItems: 'center',
    width: 90,
  },
  createPostOptionCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  createPostOptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  formModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  formModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  formFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    marginTop: 10,
  },
  formTextInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tagPillTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  formSubmitBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  formSubmitBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  entryDetailsModal: {
    margin: 20,
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
  },
  entryDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  entryDetailsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  entryDetailsBody: {
    alignItems: 'center',
  },
  entryStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  entryInfoBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  entryInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryInfoLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  entryInfoVal: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '700',
  },
  entryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  commentModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '75%',
  },
  commentItemBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  sendCommentBtn: {
    backgroundColor: '#0284C7',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 30,
  },
  mediaViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  mediaViewerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  mediaViewerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  mediaViewerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  mediaViewerFullImage: {
    width: '100%',
    height: '100%',
  },
  mediaViewerDocContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  mediaViewerDocLargeIcon: {
    width: 100,
    height: 100,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  mediaViewerDocBigTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  mediaViewerDocDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 30,
  },
  mediaViewerOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    width: '85%',
  },
  mediaViewerOpenBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  viewMoreScreenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  moreServicesCloseBtn: {
    padding: 6,
    borderRadius: 10,
  },
  viewMoreHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  viewMoreBackBtn: {
    padding: 6,
    borderRadius: 10,
  },
  viewMoreSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewMoreSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  viewMoreScrollContent: {
    padding: 16,
    paddingTop: 14,
  },
  viewMoreCategorySection: {
    marginBottom: 22,
  },
  viewMoreCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  viewMoreCategoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  categoryHeaderActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryHeaderActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  categoryHeaderAlertBtn: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  categoryHeaderAlertText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
  },
  viewMoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  viewMoreTile: {
    width: '22%',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  viewMoreIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  viewMoreTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 14,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
  },
  noSearchFoundBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  noSearchFoundText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  emergencyModal: {
    margin: 20,
    marginBottom: 40,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emergencyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.danger,
    marginBottom: 20,
  },
  emergencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emergencyOptionEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  emergencyOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  closeBtn: {
    marginTop: 20,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeBtnText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
});
