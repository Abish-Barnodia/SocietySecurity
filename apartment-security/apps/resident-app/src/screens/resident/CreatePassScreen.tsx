import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { useAuth } from '@apartment-security/shared-auth';
import { shareQrAsImage } from '../../utils/shareQrPass';
import { ThemedPassCard } from '../../components/ThemedPassCard';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import PhoneInput from '../../components/PhoneInput';
import { COUNTRIES } from '../../utils/countryCodes';

// Multi-step Flow State Types
type FlowStep =
  | 'ENTRY_HUB'
  | 'GUEST_TYPES'
  | 'DATE_TIME_CONFIG'
  | 'SELECT_GUESTS'
  | 'PREVIEW_INVITE'
  | 'HELP_CATEGORIES'
  | 'CAB_CONFIG'
  | 'DELIVERY_CONFIG';

type GuestInviteType = 'QUICK' | 'PARTY' | 'FREQUENT' | 'PRIVATE';

interface GuestItem {
  id: string;
  name: string;
  phone: string;
  vehicleNo?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAY_TO_API: Record<string, string> = {
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
  Sun: 'SUNDAY',
};

const VISITING_HELP_OPTIONS = [
  { id: 'HOME_REPAIR', title: 'Home repair', icon: 'hammer-outline' },
  { id: 'APPLIANCE_REPAIR', title: 'Appliance repair', icon: 'hardware-chip-outline' },
  { id: 'INTERNET_REPAIR', title: 'Internet repair', icon: 'wifi-outline' },
  { id: 'BEAUTICIAN', title: 'Beautician', icon: 'cut-outline' },
  { id: 'TUTOR', title: 'Tutor', icon: 'book-outline' },
  { id: 'OTHERS', title: 'Others', icon: 'ellipsis-horizontal-circle-outline' },
];

const CAB_COMPANIES_ONCE = ['Uber', 'Ola', 'Rapido', 'BluSmart', 'Other Cab'];
const CAB_COMPANIES_FREQUENT = ['Uber', 'Ola', 'Rapido', 'BluSmart', 'Office Cab', 'School Van', 'Carpool', 'Other Cab'];
const DELIVERY_COMPANIES = ['Blinkit', 'Swiggy', 'Zomato', 'Zepto', 'Amazon', 'Flipkart', 'Other'];

const THEMES = [
  {
    id: 'home',
    name: 'Home',
    icon: 'home-outline',
    bgGradient: '#FEF3C7',
    bannerColor: '#92400E',
    tagline: 'Welcome to our Home',
    accentColor: '#D97706',
    iconName: 'home' as const,
  },
  {
    id: 'party',
    name: 'Dinner / Party',
    icon: 'restaurant-outline',
    bgGradient: '#FFE4E6',
    bannerColor: '#9F1239',
    tagline: 'Dinner & Celebrations',
    accentColor: '#E11D48',
    iconName: 'wine' as const,
  },
  {
    id: 'balloons',
    name: 'Celebration',
    icon: 'balloon-outline',
    bgGradient: '#E0F2FE',
    bannerColor: '#075985',
    tagline: 'Joyous Celebration',
    accentColor: '#0284C7',
    iconName: 'sparkles' as const,
  },
  {
    id: 'formal',
    name: 'Formal / Meet',
    icon: 'briefcase-outline',
    bgGradient: '#F1F5F9',
    bannerColor: '#1E293B',
    tagline: 'Scheduled Meeting',
    accentColor: '#475569',
    iconName: 'briefcase' as const,
  },
  {
    id: 'games',
    name: 'Fun & Games',
    icon: 'game-controller-outline',
    bgGradient: '#F3E8FF',
    bannerColor: '#6B21A8',
    tagline: 'Game Night / Gathering',
    accentColor: '#9333EA',
    iconName: 'game-controller' as const,
  },
];

const MOCK_RECENT_CONTACTS: GuestItem[] = [
  { id: 'c1', name: 'Rahul Sharma', phone: '9876543210' },
  { id: 'c2', name: 'Priya Verma', phone: '9812345678' },
  { id: 'c3', name: 'Amit Patel', phone: '9765432109' },
  { id: 'c4', name: 'Sneha Roy', phone: '9988776655' },
];

export default function CreatePassScreen({ navigation }: { navigation: any }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();
  const { createPass } = useData();
  const { userProfile } = useAuth();

  const userName = userProfile?.name || 'Resident';

  const passCardRef = React.useRef<View>(null);
  const [activeCardData, setActiveCardData] = useState<{
    themeId: string;
    visitorName: string;
    residentName: string;
    unitName: string;
    propertyName: string;
    validTimeWindow: string;
    passCode: string;
    qrPayload: string;
    note?: string;
  }>({
    themeId: 'home',
    visitorName: 'Guest',
    residentName: userName,
    unitName: 'Tower A • Flat 402',
    propertyName: 'Greenfield Heights',
    validTimeWindow: 'Today',
    passCode: 'PASS-123456',
    qrPayload: 'pass-preview',
  });

  // Navigation / Step state
  const [currentStep, setCurrentStep] = useState<FlowStep>('ENTRY_HUB');
  const [stepHistory, setStepHistory] = useState<FlowStep[]>([]);

  // Guest Flow Config
  const [guestInviteType, setGuestInviteType] = useState<GuestInviteType>('QUICK');
  const [frequencyTab, setFrequencyTab] = useState<'ONCE' | 'FREQUENTLY'>('ONCE');
  const [isPrivate, setIsPrivate] = useState(false);

  // Date/Time Selection
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [durationHours, setDurationHours] = useState(8);
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [recurringExpiry, setRecurringExpiry] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  // Date picker UI state
  const [showPicker, setShowPicker] = useState<{
    field: 'date' | 'time' | 'recurringExpiry';
    mode: 'date' | 'time';
  } | null>(null);

  // Guest List Selection & Manual Entry
  const [guestSubTab, setGuestSubTab] = useState<'CONTACTS' | 'RECENT' | 'MANUAL'>('MANUAL');
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [selectedGuests, setSelectedGuests] = useState<GuestItem[]>([]);

  // Single Manual Guest Input
  const [manualName, setManualName] = useState('');
  const [manualPhoneCountry, setManualPhoneCountry] = useState(COUNTRIES[0]);
  const [manualPhoneDigits, setManualPhoneDigits] = useState('');
  const [manualVehicleNo, setManualVehicleNo] = useState('');

  // Card Customizer
  const [selectedThemeId, setSelectedThemeId] = useState('home');
  const [customGreeting, setCustomGreeting] = useState(`${userName} has invited you.`);
  const [isEditingGreeting, setIsEditingGreeting] = useState(false);
  const [inviteNote, setInviteNote] = useState('');
  const [shareWhatsApp, setShareWhatsApp] = useState(true);

  // Visiting Help Flow
  const [selectedHelpCategory, setSelectedHelpCategory] = useState('Home repair');
  const [otherHelpName, setOtherHelpName] = useState('');
  const [helpProviderName, setHelpProviderName] = useState('');
  const [helpProviderPhone, setHelpProviderPhone] = useState('');

  // Cab & Delivery Flow State
  const [cabFrequencyTab, setCabFrequencyTab] = useState<'ONCE' | 'FREQUENTLY'>('ONCE');
  const [selectedCompany, setSelectedCompany] = useState('Uber');
  const [otherCabName, setOtherCabName] = useState('');
  const [otherDeliveryName, setOtherDeliveryName] = useState('');
  const [vehicleRegistration, setVehicleRegistration] = useState('');
  const [leaveAtGate, setLeaveAtGate] = useState(false);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Navigation helpers
  const goToStep = (step: FlowStep) => {
    setStepHistory((prev) => [...prev, currentStep]);
    setCurrentStep(step);
  };

  const goBack = () => {
    if (stepHistory.length > 0) {
      const prevStep = stepHistory[stepHistory.length - 1];
      setStepHistory((prev) => prev.slice(0, prev.length - 1));
      setCurrentStep(prevStep);
    } else {
      navigation.goBack();
    }
  };

  // Date formatting helpers
  const formatTimeStr = (d: Date) => {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${strMinutes} ${ampm}`;
  };

  const formatDateStr = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
  };

  const getEntryWindowFormatted = () => {
    const end = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const datePart = `${selectedDate.getDate()} ${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    return `${datePart} | ${formatTimeStr(startTime)} - ${formatTimeStr(end)}`;
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Add Manual Guest to List
  const handleAddManualGuest = () => {
    if (!manualName.trim()) {
      Alert.alert('Missing Name', 'Please enter guest name');
      return;
    }

    const fullPhone = manualPhoneDigits ? `${manualPhoneCountry.dial}${manualPhoneDigits}` : '';
    const newGuest: GuestItem = {
      id: Date.now().toString(),
      name: manualName.trim(),
      phone: fullPhone,
      vehicleNo: manualVehicleNo.trim() || undefined,
    };

    setSelectedGuests((prev) => [...prev, newGuest]);
    setManualName('');
    setManualPhoneDigits('');
    setManualVehicleNo('');
  };

  const handleRemoveGuest = (id: string) => {
    setSelectedGuests((prev) => prev.filter((g) => g.id !== id));
  };

  const handleSelectContact = (contact: GuestItem) => {
    if (!selectedGuests.some((g) => g.phone === contact.phone && g.name === contact.name)) {
      setSelectedGuests((prev) => [...prev, contact]);
    }
  };

  // Final Pass Submission
  const handleCreatePass = async (typeOverride?: string, customName?: string, customPurpose?: string) => {
    const finalGuests = [...selectedGuests];
    if (finalGuests.length === 0 && manualName.trim()) {
      finalGuests.push({
        id: Date.now().toString(),
        name: manualName.trim(),
        phone: manualPhoneDigits ? `${manualPhoneCountry.dial}${manualPhoneDigits}` : '',
        vehicleNo: manualVehicleNo.trim() || undefined,
      });
    }

    const primaryName = customName || (finalGuests.length > 0 ? finalGuests[0].name : '');
    if (!primaryName) {
      Alert.alert('Missing Details', 'Please add at least one guest name');
      return;
    }

    const start = new Date(selectedDate);
    start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    const isRecurring = frequencyTab === 'FREQUENTLY' || guestInviteType === 'FREQUENT';
    const passType = typeOverride || (isRecurring ? 'RECURRING' : 'ONE_TIME');

    const purposeText =
      customPurpose ||
      (guestInviteType === 'PARTY'
        ? `Party / Group (${finalGuests.length} guests) - ${inviteNote || 'Gathering'}`
        : isPrivate
        ? `Private Visit - ${inviteNote || 'Guest'}`
        : inviteNote || 'Guest Visit');

    const newPass: Record<string, unknown> = {
      visitorName: finalGuests.length > 1 ? `${primaryName} +${finalGuests.length - 1} guests` : primaryName,
      type: passType,
      purpose: purposeText,
      visitorPhone: finalGuests.length > 0 ? finalGuests[0].phone : '',
      validFrom: isRecurring ? new Date().toISOString() : start.toISOString(),
      validUntil: isRecurring ? recurringExpiry.toISOString() : end.toISOString(),
    };

    if (isRecurring) {
      newPass.recurringRule = {
        allowedDays: selectedDays.map((d) => DAY_TO_API[d] || 'MONDAY'),
        windowStartTime: `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
        windowEndTime: `${(startTime.getHours() + durationHours).toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
      };
    }

    setIsSubmitting(true);
    try {
      const created = await createPass(newPass);
      if (shareWhatsApp && created.qrPayload) {
        const cardPayload = {
          themeId: selectedThemeId,
          visitorName: finalGuests.length > 1 ? `${primaryName} (+${finalGuests.length - 1} guests)` : primaryName,
          residentName: userName,
          unitName: 'Tower A • Flat 402',
          propertyName: 'Greenfield Heights',
          validTimeWindow: getEntryWindowFormatted(),
          passCode: created.id.substring(created.id.length - 6).toUpperCase(),
          qrPayload: created.qrPayload,
          note: inviteNote,
        };
        setActiveCardData(cardPayload);

        // Allow layout pass
        await new Promise((r) => setTimeout(r, 300));

        try {
          if (passCardRef.current) {
            const uri = await captureRef(passCardRef, {
              format: 'png',
              quality: 1.0,
            });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                dialogTitle: 'Share Themed Visitor Pass',
              });
            }
          } else {
            await shareQrAsImage(created.qrPayload, created.id.substring(created.id.length - 8), cardPayload);
          }
        } catch {
          await shareQrAsImage(created.qrPayload, created.id.substring(created.id.length - 8), cardPayload);
        }
      }
      Alert.alert('Success 🎉', 'Invite Pass created successfully!', [
        {
          text: 'View Passes',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to create pass. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTheme = THEMES.find((t) => t.id === selectedThemeId) || THEMES[0];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ============================================================ */}
      {/* 1. STEP: ALLOW FUTURE ENTRIES (MAIN HUB - MATCHING PAGE 1)    */}
      {/* ============================================================ */}
      {currentStep === 'ENTRY_HUB' && (
        <View style={[styles.mainHubContainer, { paddingTop: insets.top + 20 }]}>
          {/* Header */}
          <View style={styles.hubHeaderRow}>
            <Text style={styles.hubTitle}>Allow Future Entries</Text>
            <TouchableOpacity
              style={styles.hubCloseBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* 4 Monochrome Circular/Square QuickAction Buttons */}
          <View style={styles.hubIconsGrid}>
            {/* 1. Guest */}
            <TouchableOpacity
              style={styles.hubIconItem}
              onPress={() => goToStep('GUEST_TYPES')}
              activeOpacity={0.8}
            >
              <View style={styles.hubIconBox}>
                <Ionicons name="person-outline" size={26} color={colors.text} />
              </View>
              <Text style={styles.hubIconLabel}>Guest</Text>
            </TouchableOpacity>

            {/* 2. Cab */}
            <TouchableOpacity
              style={styles.hubIconItem}
              onPress={() => goToStep('CAB_CONFIG')}
              activeOpacity={0.8}
            >
              <View style={styles.hubIconBox}>
                <Ionicons name="car-outline" size={26} color={colors.text} />
              </View>
              <Text style={styles.hubIconLabel}>Cab</Text>
            </TouchableOpacity>

            {/* 3. Delivery */}
            <TouchableOpacity
              style={styles.hubIconItem}
              onPress={() => goToStep('DELIVERY_CONFIG')}
              activeOpacity={0.8}
            >
              <View style={styles.hubIconBox}>
                <Ionicons name="bicycle-outline" size={26} color={colors.text} />
              </View>
              <Text style={styles.hubIconLabel}>Delivery</Text>
            </TouchableOpacity>

            {/* 4. Visiting Help */}
            <TouchableOpacity
              style={styles.hubIconItem}
              onPress={() => goToStep('HELP_CATEGORIES')}
              activeOpacity={0.8}
            >
              <View style={styles.hubIconBox}>
                <Ionicons name="hammer-outline" size={26} color={colors.text} />
              </View>
              <Text style={styles.hubIconLabel}>Visiting Help</Text>
            </TouchableOpacity>
          </View>

          {/* Info Card */}
          <View style={styles.hubInfoCard}>
            <Ionicons name="shield-checkmark" size={22} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.hubInfoTitle}>Instant Gate Approval</Text>
              <Text style={styles.hubInfoText}>
                Pre-approved guests, cabs, and delivery agents will get fast-track QR verification at the gate.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ============================================================ */}
      {/* 2. STEP: GUEST INVITE TYPE (MATCHING PAGE 2)                 */}
      {/* ============================================================ */}
      {currentStep === 'GUEST_TYPES' && (
        <View style={[styles.stepContainer, { paddingTop: insets.top + 10 }]}>
          <View style={styles.stepTopBar}>
            <TouchableOpacity style={styles.topBackBtn} onPress={goBack}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.stepHeaderTitle}>Guest Invite</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.stepContentScroll}>
            <Text style={styles.stepSubtitle}>
              Create pre-approval of expected visitors to ensure hassle-free entry for them
            </Text>

            <View style={styles.guestTypesList}>
              {/* Option 1: Quick Invite */}
              <TouchableOpacity
                style={styles.guestTypeCard}
                onPress={() => {
                  setGuestInviteType('QUICK');
                  setFrequencyTab('ONCE');
                  setIsPrivate(false);
                  goToStep('DATE_TIME_CONFIG');
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.guestTypeCardTitle}>Quick Invite &gt;</Text>
                  <Text style={styles.guestTypeCardDesc}>
                    Ensure smooth entry by manually pre-approving guests. Best for small, personal gatherings.
                  </Text>
                </View>
                <View style={styles.guestTypeCardIconWrap}>
                  <Ionicons name="person-outline" size={26} color={colors.text} />
                </View>
              </TouchableOpacity>

              {/* Option 2: Party/Group Invite */}
              <TouchableOpacity
                style={styles.guestTypeCard}
                onPress={() => {
                  setGuestInviteType('PARTY');
                  setFrequencyTab('ONCE');
                  setIsPrivate(false);
                  goToStep('DATE_TIME_CONFIG');
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.guestTypeCardTitle}>Party/Group Invite &gt;</Text>
                  <Text style={styles.guestTypeCardDesc}>
                    Create a common guest invite link with a limit for large gatherings and easy tracking.
                  </Text>
                </View>
                <View style={styles.guestTypeCardIconWrap}>
                  <Ionicons name="people-outline" size={26} color={colors.text} />
                </View>
              </TouchableOpacity>

              {/* Option 3: Frequent Invite */}
              <TouchableOpacity
                style={styles.guestTypeCard}
                onPress={() => {
                  setGuestInviteType('FREQUENT');
                  setFrequencyTab('FREQUENTLY');
                  setIsPrivate(false);
                  goToStep('DATE_TIME_CONFIG');
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.guestTypeCardTitle}>Frequent Invite &gt;</Text>
                  <Text style={styles.guestTypeCardDesc}>
                    Invite long-term guests with a single passcode, without repeated approvals.
                  </Text>
                </View>
                <View style={styles.guestTypeCardIconWrap}>
                  <Ionicons name="sync-outline" size={26} color={colors.text} />
                </View>
              </TouchableOpacity>

              {/* Option 4: Private Invite */}
              <TouchableOpacity
                style={[styles.guestTypeCard, styles.privateInviteCard]}
                onPress={() => {
                  setGuestInviteType('PRIVATE');
                  setFrequencyTab('ONCE');
                  setIsPrivate(true);
                  goToStep('DATE_TIME_CONFIG');
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.guestTypeCardTitle, { color: '#6B21A8' }]}>Private Invite &gt;</Text>
                  <Text style={[styles.guestTypeCardDesc, { color: '#7E22CE' }]}>
                    This allows silent entries of your guests without disturbing others
                  </Text>
                </View>
                <View style={[styles.guestTypeCardIconWrap, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="lock-closed" size={24} color="#7E22CE" />
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* ============================================================ */}
      {/* 3. STEP: DATE & TIME SELECTION (MATCHING PAGE 3)             */}
      {/* ============================================================ */}
      {currentStep === 'DATE_TIME_CONFIG' && (
        <View style={[styles.stepContainer, { paddingTop: insets.top + 10 }]}>
          <View style={styles.stepTopBar}>
            <TouchableOpacity style={styles.topBackBtn} onPress={goBack}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.stepHeaderTitle}>Guest Invite</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Once vs Frequently Tabs */}
          <View style={styles.frequencyTabsRow}>
            <TouchableOpacity
              style={[styles.frequencyTabItem, frequencyTab === 'ONCE' && styles.frequencyTabItemActive]}
              onPress={() => setFrequencyTab('ONCE')}
            >
              <Text
                style={[styles.frequencyTabLabel, frequencyTab === 'ONCE' && styles.frequencyTabLabelActive]}
              >
                Once
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.frequencyTabItem, frequencyTab === 'FREQUENTLY' && styles.frequencyTabItemActive]}
              onPress={() => setFrequencyTab('FREQUENTLY')}
            >
              <Text
                style={[
                  styles.frequencyTabLabel,
                  frequencyTab === 'FREQUENTLY' && styles.frequencyTabLabelActive,
                ]}
              >
                Frequently
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.stepContentScroll}>
            {/* Make it private checkbox card */}
            <TouchableOpacity
              style={styles.privateToggleCard}
              onPress={() => setIsPrivate(!isPrivate)}
              activeOpacity={0.8}
            >
              <View style={styles.privateCheckboxRow}>
                <View style={[styles.checkboxBox, isPrivate && styles.checkboxBoxActive]}>
                  {isPrivate && <Ionicons name="checkmark" size={14} color="white" />}
                </View>
                <Text style={styles.privateCardTitle}>Make it private</Text>
              </View>
              <View style={styles.privateSubRow}>
                <Text style={styles.privateCardSubtext}>
                  This allows silent entries of your guests without disturbing others{' '}
                  <Text style={{ fontWeight: '700', textDecorationLine: 'underline' }}>Know more</Text>
                </Text>
                <View style={styles.privateLockBadge}>
                  <Ionicons name="lock-closed" size={16} color="#7E22CE" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Date Selection */}
            <Text style={styles.fieldSectionLabel}>Select Date</Text>
            <TouchableOpacity
              style={styles.interactiveInputBox}
              onPress={() => setShowPicker({ field: 'date', mode: 'date' })}
            >
              <Text style={styles.interactiveInputText}>
                {selectedDate.toDateString() === new Date().toDateString()
                  ? 'Today'
                  : formatDateStr(selectedDate)}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Time / Duration Row */}
            <View style={styles.timeDurationRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldSectionLabel}>Starting from</Text>
                <TouchableOpacity
                  style={styles.interactiveInputBox}
                  onPress={() => setShowPicker({ field: 'time', mode: 'time' })}
                >
                  <Text style={styles.interactiveInputText}>{formatTimeStr(startTime)}</Text>
                  <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.fieldSectionLabel}>Valid for</Text>
                <View style={styles.durationSelectorRow}>
                  {[4, 8, 12, 24].map((hrs) => (
                    <TouchableOpacity
                      key={hrs}
                      style={[
                        styles.durationPill,
                        durationHours === hrs && styles.durationPillActive,
                      ]}
                      onPress={() => setDurationHours(hrs)}
                    >
                      <Text
                        style={[
                          styles.durationPillText,
                          durationHours === hrs && styles.durationPillTextActive,
                        ]}
                      >
                        {hrs}h
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* If Frequently selected */}
            {frequencyTab === 'FREQUENTLY' && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.fieldSectionLabel}>Allowed Days</Text>
                <View style={styles.daysRow}>
                  {DAYS.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayButton, selectedDays.includes(day) && styles.dayButtonActive]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text
                        style={[styles.dayText, selectedDays.includes(day) && styles.dayTextActive]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldSectionLabel, { marginTop: 14 }]}>Pass Expires On</Text>
                <TouchableOpacity
                  style={styles.interactiveInputBox}
                  onPress={() => setShowPicker({ field: 'recurringExpiry', mode: 'date' })}
                >
                  <Text style={styles.interactiveInputText}>{formatDateStr(recurringExpiry)}</Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Yellow CTA Button */}
          <View style={[styles.stepBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={styles.primaryYellowBtn}
              onPress={() => goToStep('SELECT_GUESTS')}
            >
              <Text style={styles.primaryYellowBtnText}>Select Guest(s)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ============================================================ */}
      {/* 4. STEP: SELECT GUESTS (MATCHING PAGE 4)                     */}
      {/* ============================================================ */}
      {currentStep === 'SELECT_GUESTS' && (
        <View style={[styles.stepContainer, { paddingTop: insets.top + 10 }]}>
          <View style={styles.stepTopBar}>
            <TouchableOpacity style={styles.topBackBtn} onPress={goBack}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.stepHeaderTitle}>Select Guests</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Contacts / Recent / Add Manually Tabs */}
          <View style={styles.guestSubTabsRow}>
            <TouchableOpacity
              style={[styles.guestSubTabItem, guestSubTab === 'CONTACTS' && styles.guestSubTabItemActive]}
              onPress={() => setGuestSubTab('CONTACTS')}
            >
              <Text
                style={[
                  styles.guestSubTabLabel,
                  guestSubTab === 'CONTACTS' && styles.guestSubTabLabelActive,
                ]}
              >
                Contacts
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.guestSubTabItem, guestSubTab === 'RECENT' && styles.guestSubTabItemActive]}
              onPress={() => setGuestSubTab('RECENT')}
            >
              <Text
                style={[
                  styles.guestSubTabLabel,
                  guestSubTab === 'RECENT' && styles.guestSubTabLabelActive,
                ]}
              >
                Recent
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.guestSubTabItem, guestSubTab === 'MANUAL' && styles.guestSubTabItemActive]}
              onPress={() => setGuestSubTab('MANUAL')}
            >
              <Text
                style={[
                  styles.guestSubTabLabel,
                  guestSubTab === 'MANUAL' && styles.guestSubTabLabelActive,
                ]}
              >
                Add Manually
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.stepContentScroll} keyboardShouldPersistTaps="handled">
            {/* Contacts & Recent Search Bar */}
            {guestSubTab !== 'MANUAL' && (
              <View style={styles.searchBarBox}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.searchBarInput}
                  placeholder="Search from contacts"
                  placeholderTextColor={colors.textMuted}
                  value={contactSearchQuery}
                  onChangeText={setContactSearchQuery}
                />
              </View>
            )}

            {/* SubTab 1 & 2: Contacts & Recent List */}
            {guestSubTab !== 'MANUAL' && (
              <View style={{ marginTop: 10 }}>
                {MOCK_RECENT_CONTACTS.filter((c) =>
                  c.name.toLowerCase().includes(contactSearchQuery.toLowerCase())
                ).map((contact) => {
                  const isSelected = selectedGuests.some((g) => g.phone === contact.phone);
                  return (
                    <TouchableOpacity
                      key={contact.id}
                      style={[styles.contactListItem, isSelected && styles.contactListItemSelected]}
                      onPress={() => handleSelectContact(contact)}
                    >
                      <View style={styles.contactAvatarCircle}>
                        <Text style={styles.contactAvatarText}>{contact.name.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.contactItemName}>{contact.name}</Text>
                        <Text style={styles.contactItemPhone}>{contact.phone}</Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                        size={24}
                        color={isSelected ? '#10B981' : '#0284C7'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* SubTab 3: Add Manually Form */}
            {guestSubTab === 'MANUAL' && (
              <View style={styles.manualFormContainer}>
                <Text style={styles.fieldSectionLabel}>Guest Name *</Text>
                <TextInput
                  style={styles.formInputBox}
                  placeholder="Enter guest name"
                  placeholderTextColor={colors.textMuted}
                  value={manualName}
                  onChangeText={setManualName}
                />

                <Text style={styles.fieldSectionLabel}>Phone Number</Text>
                <PhoneInput
                  colors={colors}
                  country={manualPhoneCountry}
                  onChangeCountry={setManualPhoneCountry}
                  digits={manualPhoneDigits}
                  onChangeDigits={setPhoneDigitsManual}
                  placeholder="98765 43210"
                />

                <Text style={styles.fieldSectionLabel}>Vehicle Number (Optional)</Text>
                <TextInput
                  style={styles.formInputBox}
                  placeholder="e.g. DL 01 AB 1234"
                  placeholderTextColor={colors.textMuted}
                  value={manualVehicleNo}
                  onChangeText={setManualVehicleNo}
                  autoCapitalize="characters"
                />

                <TouchableOpacity
                  style={styles.addToListBtn}
                  onPress={handleAddManualGuest}
                >
                  <Ionicons name="add" size={20} color="#0284C7" />
                  <Text style={styles.addToListBtnText}>Add Guest to Invite</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Selected Guests Queue */}
            {selectedGuests.length > 0 && (
              <View style={styles.selectedGuestsQueueBox}>
                <Text style={styles.queueHeaderTitle}>
                  Added Guests ({selectedGuests.length})
                </Text>
                {selectedGuests.map((g) => (
                  <View key={g.id} style={styles.queueGuestRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.queueGuestName}>{g.name}</Text>
                      {g.phone ? <Text style={styles.queueGuestPhone}>{g.phone}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveGuest(g.id)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Yellow Next Button */}
          <View style={[styles.stepBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[
                styles.primaryYellowBtn,
                selectedGuests.length === 0 && !manualName.trim() && { opacity: 0.6 },
              ]}
              onPress={() => {
                if (selectedGuests.length === 0 && manualName.trim()) {
                  handleAddManualGuest();
                }
                if (selectedGuests.length === 0 && !manualName.trim()) {
                  Alert.alert('Missing Guest', 'Please enter or select at least one guest');
                  return;
                }
                goToStep('PREVIEW_INVITE');
              }}
            >
              <Text style={styles.primaryYellowBtnText}>Next &gt;</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ============================================================ */}
      {/* 5. STEP: PREVIEW INVITE & CARD CUSTOMIZER (MATCHING PAGES 5 & 6) */}
      {/* ============================================================ */}
      {currentStep === 'PREVIEW_INVITE' && (
        <View style={[styles.stepContainer, { paddingTop: insets.top + 10 }]}>
          <View style={styles.stepTopBar}>
            <TouchableOpacity style={styles.topBackBtn} onPress={goBack}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.stepHeaderTitle}>Invite Guests</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.stepContentScroll} keyboardShouldPersistTaps="handled">
            {/* Greeting Header with Edit */}
            <View style={styles.greetingHeaderRow}>
              {isEditingGreeting ? (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    style={[styles.formInputBox, { flex: 1, marginBottom: 0 }]}
                    value={customGreeting}
                    onChangeText={setCustomGreeting}
                    autoFocus
                  />
                  <TouchableOpacity onPress={() => setIsEditingGreeting(false)}>
                    <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.greetingHeadline}>{customGreeting}</Text>
                  <TouchableOpacity
                    style={styles.editGreetingBtn}
                    onPress={() => setIsEditingGreeting(true)}
                  >
                    <Ionicons name="pencil" size={14} color="#0284C7" />
                    <Text style={styles.editGreetingText}>Edit</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Themed Invitation Card Canvas */}
            <View style={[styles.themeCardCanvas, { backgroundColor: selectedTheme.bgGradient }]}>
              <View style={styles.cardIllustrationWrap}>
                <View style={[styles.cardTagBadge, { backgroundColor: selectedTheme.bannerColor }]}>
                  <Ionicons name={selectedTheme.iconName} size={14} color="white" />
                  <Text style={styles.cardTagText}>{selectedTheme.tagline}</Text>
                </View>

                {/* Illustrated Art Canvas */}
                <View style={styles.cardArtContainer}>
                  <Ionicons name={selectedTheme.iconName} size={54} color={selectedTheme.accentColor} />
                  <Text style={[styles.cardArtWelcomeText, { color: selectedTheme.bannerColor }]}>
                    WELCOME TO APARTMENT 402
                  </Text>
                  <Text style={[styles.cardArtSub, { color: selectedTheme.bannerColor }]}>
                    Pass Pre-Approved by {userName}
                  </Text>
                </View>
              </View>

              {/* Theme Selector Carousel Inside Card */}
              <View style={styles.themeSelectorBar}>
                <Text style={styles.themeSelectorLabel}>Select a theme</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themesRow}>
                  {THEMES.map((theme) => {
                    const isSelected = selectedThemeId === theme.id;
                    return (
                      <TouchableOpacity
                        key={theme.id}
                        style={[
                          styles.themeThumbnailPill,
                          isSelected && styles.themeThumbnailPillActive,
                        ]}
                        onPress={() => setSelectedThemeId(theme.id)}
                      >
                        <Ionicons
                          name={theme.icon as any}
                          size={18}
                          color={isSelected ? '#D97706' : '#64748B'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Allow single entry between summary */}
            <Text style={styles.previewSectionLabel}>Allow single entry between</Text>
            <View style={styles.entryWindowPillBox}>
              <Text style={styles.entryWindowPillText}>{getEntryWindowFormatted()}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </View>

            {/* Add a Note */}
            <Text style={styles.previewSectionLabel}>Add a Note</Text>
            <TextInput
              style={styles.noteInputBox}
              placeholder="Add a note (e.g. Call upon reaching gate, dinner at 8)"
              placeholderTextColor={colors.textMuted}
              value={inviteNote}
              onChangeText={setInviteNote}
              multiline
            />

            {/* WhatsApp Share Switch */}
            <View style={styles.whatsappSwitchRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                <Text style={styles.whatsappSwitchLabel}>Share QR Pass on WhatsApp</Text>
              </View>
              <Switch
                value={shareWhatsApp}
                onValueChange={setShareWhatsApp}
                trackColor={{ false: colors.border, true: '#25D366' }}
              />
            </View>

            {/* Manage Guest List */}
            <View style={styles.guestListHeaderRow}>
              <Text style={styles.previewSectionLabel}>Manage guest list</Text>
              <TouchableOpacity
                style={styles.addMoreGuestsBtn}
                onPress={() => goToStep('SELECT_GUESTS')}
              >
                <Ionicons name="add-circle-outline" size={16} color="#0284C7" />
                <Text style={styles.addMoreGuestsText}>Add Guests</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.manageGuestsList}>
              {selectedGuests.map((g) => (
                <View key={g.id} style={styles.manageGuestItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.manageGuestName}>{g.name}</Text>
                    {g.phone ? <Text style={styles.manageGuestPhone}>{g.phone}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={{ padding: 6 }}
                    onPress={() => handleRemoveGuest(g.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Yellow Create Invite Button */}
          <View style={[styles.stepBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.primaryYellowBtn, isSubmitting && { opacity: 0.6 }]}
              onPress={() => handleCreatePass()}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryYellowBtnText}>
                {isSubmitting ? 'Creating Invite…' : 'Create Invite'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ============================================================ */}
      {/* 6. STEP: VISITING HELP CATEGORIES (MATCHING PAGE 7)          */}
      {/* ============================================================ */}
      {currentStep === 'HELP_CATEGORIES' && (
        <View style={[styles.stepContainer, { paddingTop: insets.top + 10 }]}>
          <View style={styles.stepTopBar}>
            <TouchableOpacity style={styles.topBackBtn} onPress={goBack}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.stepHeaderTitle}>Visiting Help</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.stepContentScroll}>
            {/* Yellow Floating Wrench Icon */}
            <View style={styles.helpFloatingIconContainer}>
              <View style={styles.helpFloatingIconCircle}>
                <Ionicons name="construct" size={32} color="#1E293B" />
              </View>
              <Text style={styles.helpCategoryMainTitle}>VISITING HELP CATEGORY</Text>
            </View>

            {/* Categories List Card */}
            <View style={styles.helpCategoriesBox}>
              {VISITING_HELP_OPTIONS.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.helpCategoryRowItem,
                    selectedHelpCategory === item.title && { backgroundColor: isDark ? 'rgba(250, 204, 21, 0.1)' : '#FEF9C3' },
                    index === VISITING_HELP_OPTIONS.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => {
                    setSelectedHelpCategory(item.title);
                    if (item.title !== 'Others') {
                      goToStep('DATE_TIME_CONFIG');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.helpCategoryRowText, selectedHelpCategory === item.title && { fontWeight: '800', color: '#B45309' }]}>
                    {item.title}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            {/* If Others is selected in Visiting Help */}
            {selectedHelpCategory === 'Others' && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.fieldSectionLabel}>Specify Service / Help *</Text>
                <TextInput
                  style={styles.formInputBox}
                  placeholder="e.g. Pest control, Carpenter, Interior designer"
                  placeholderTextColor={colors.textMuted}
                  value={otherHelpName}
                  onChangeText={setOtherHelpName}
                />
                <TouchableOpacity
                  style={styles.primaryYellowBtn}
                  onPress={() => {
                    if (!otherHelpName.trim()) {
                      Alert.alert('Missing Name', 'Please specify the service name');
                      return;
                    }
                    goToStep('DATE_TIME_CONFIG');
                  }}
                >
                  <Text style={styles.primaryYellowBtnText}>Continue to Date & Time &gt;</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* ============================================================ */}
      {/* 7. STEP: CAB CONFIGURATION (WITH ONCE & FREQUENTLY TABS)     */}
      {/* ============================================================ */}
      {currentStep === 'CAB_CONFIG' && (
        <View style={[styles.stepContainer, { paddingTop: insets.top + 10 }]}>
          <View style={styles.stepTopBar}>
            <TouchableOpacity style={styles.topBackBtn} onPress={goBack}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.stepHeaderTitle}>Cab / Auto Pre-Approval</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Once vs Frequently Tabs */}
          <View style={styles.frequencyTabsRow}>
            <TouchableOpacity
              style={[styles.frequencyTabItem, cabFrequencyTab === 'ONCE' && styles.frequencyTabItemActive]}
              onPress={() => setCabFrequencyTab('ONCE')}
            >
              <Text style={[styles.frequencyTabLabel, cabFrequencyTab === 'ONCE' && styles.frequencyTabLabelActive]}>
                Once
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.frequencyTabItem, cabFrequencyTab === 'FREQUENTLY' && styles.frequencyTabItemActive]}
              onPress={() => setCabFrequencyTab('FREQUENTLY')}
            >
              <Text style={[styles.frequencyTabLabel, cabFrequencyTab === 'FREQUENTLY' && styles.frequencyTabLabelActive]}>
                Frequently
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.stepContentScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldSectionLabel}>Select Service</Text>
            <View style={styles.companyBadgesRow}>
              {(cabFrequencyTab === 'ONCE' ? CAB_COMPANIES_ONCE : CAB_COMPANIES_FREQUENT).map((company) => (
                <TouchableOpacity
                  key={company}
                  style={[
                    styles.companyBadgePill,
                    selectedCompany === company && styles.companyBadgePillActive,
                  ]}
                  onPress={() => setSelectedCompany(company)}
                >
                  <Text
                    style={[
                      styles.companyBadgeText,
                      selectedCompany === company && styles.companyBadgeTextActive,
                    ]}
                  >
                    {company}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Other Cab Input */}
            {selectedCompany === 'Other Cab' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.fieldSectionLabel}>Specify Company / Driver Name *</Text>
                <TextInput
                  style={styles.formInputBox}
                  placeholder="e.g. Local Taxi, Office Fleet, Private Chauffeur"
                  placeholderTextColor={colors.textMuted}
                  value={otherCabName}
                  onChangeText={setOtherCabName}
                />
              </View>
            )}

            <Text style={styles.fieldSectionLabel}>Vehicle Number (Optional)</Text>
            <TextInput
              style={styles.formInputBox}
              placeholder="e.g. KA 01 AB 1234"
              placeholderTextColor={colors.textMuted}
              value={vehicleRegistration}
              onChangeText={setVehicleRegistration}
              autoCapitalize="characters"
            />

            {/* If Once: Date, Start Time & Duration */}
            {cabFrequencyTab === 'ONCE' ? (
              <>
                <Text style={styles.fieldSectionLabel}>Select Date</Text>
                <TouchableOpacity
                  style={styles.interactiveInputBox}
                  onPress={() => setShowPicker({ field: 'date', mode: 'date' })}
                >
                  <Text style={styles.interactiveInputText}>
                    {selectedDate.toDateString() === new Date().toDateString()
                      ? 'Today'
                      : formatDateStr(selectedDate)}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.timeDurationRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.fieldSectionLabel}>Starting from</Text>
                    <TouchableOpacity
                      style={styles.interactiveInputBox}
                      onPress={() => setShowPicker({ field: 'time', mode: 'time' })}
                    >
                      <Text style={styles.interactiveInputText}>{formatTimeStr(startTime)}</Text>
                      <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.fieldSectionLabel}>Valid for</Text>
                    <View style={styles.durationSelectorRow}>
                      {[1, 2, 4, 8].map((hrs) => (
                        <TouchableOpacity
                          key={hrs}
                          style={[
                            styles.durationPill,
                            durationHours === hrs && styles.durationPillActive,
                          ]}
                          onPress={() => setDurationHours(hrs)}
                        >
                          <Text
                            style={[
                              styles.durationPillText,
                              durationHours === hrs && styles.durationPillTextActive,
                            ]}
                          >
                            {hrs}h
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </>
            ) : (
              /* If Frequently: Allowed Days, Pickup Window, and Expiry */
              <View style={{ marginTop: 6 }}>
                <Text style={styles.fieldSectionLabel}>Allowed Days</Text>
                <View style={styles.daysRow}>
                  {DAYS.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayButton, selectedDays.includes(day) && styles.dayButtonActive]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text
                        style={[styles.dayText, selectedDays.includes(day) && styles.dayTextActive]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldSectionLabel, { marginTop: 10 }]}>Pickup Window</Text>
                <TouchableOpacity
                  style={styles.interactiveInputBox}
                  onPress={() => setShowPicker({ field: 'time', mode: 'time' })}
                >
                  <Text style={styles.interactiveInputText}>
                    Starts at {formatTimeStr(startTime)} (Valid for {durationHours}h)
                  </Text>
                  <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <Text style={[styles.fieldSectionLabel, { marginTop: 10 }]}>Pass Expires On</Text>
                <TouchableOpacity
                  style={styles.interactiveInputBox}
                  onPress={() => setShowPicker({ field: 'recurringExpiry', mode: 'date' })}
                >
                  <Text style={styles.interactiveInputText}>{formatDateStr(recurringExpiry)}</Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={[styles.stepBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={styles.primaryYellowBtn}
              onPress={() => {
                const effectiveCompany = selectedCompany === 'Other Cab' ? (otherCabName || 'Cab / Auto') : (selectedCompany || 'Cab / Auto');
                handleCreatePass(
                  cabFrequencyTab === 'FREQUENTLY' ? 'RECURRING' : 'ONE_TIME',
                  effectiveCompany,
                  `Cab Entry - ${vehicleRegistration || effectiveCompany}`
                );
              }}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryYellowBtnText}>
                {isSubmitting ? 'Approving…' : 'Pre-Approve Cab Entry'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ============================================================ */}
      {/* 8. STEP: DELIVERY CONFIGURATION                             */}
      {/* ============================================================ */}
      {currentStep === 'DELIVERY_CONFIG' && (
        <View style={[styles.stepContainer, { paddingTop: insets.top + 10 }]}>
          <View style={styles.stepTopBar}>
            <TouchableOpacity style={styles.topBackBtn} onPress={goBack}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.stepHeaderTitle}>Delivery Pre-Approval</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.stepContentScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldSectionLabel}>Select Delivery Provider</Text>
            <View style={styles.companyBadgesRow}>
              {DELIVERY_COMPANIES.map((company) => (
                <TouchableOpacity
                  key={company}
                  style={[
                    styles.companyBadgePill,
                    selectedCompany === company && styles.companyBadgePillActive,
                  ]}
                  onPress={() => setSelectedCompany(company)}
                >
                  <Text
                    style={[
                      styles.companyBadgeText,
                      selectedCompany === company && styles.companyBadgeTextActive,
                    ]}
                  >
                    {company}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Other Delivery Input */}
            {selectedCompany === 'Other' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.fieldSectionLabel}>Specify Delivery / Courier Provider *</Text>
                <TextInput
                  style={styles.formInputBox}
                  placeholder="e.g. DTDC, Blue Dart, Local Courier, Groceries"
                  placeholderTextColor={colors.textMuted}
                  value={otherDeliveryName}
                  onChangeText={setOtherDeliveryName}
                />
              </View>
            )}

            <View style={styles.leaveAtGateCard}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.leaveAtGateTitle}>Leave at Gate / Door</Text>
                <Text style={styles.leaveAtGateSub}>
                  Guard will collect the parcel at the gate without ringing your unit.
                </Text>
              </View>
              <Switch
                value={leaveAtGate}
                onValueChange={setLeaveAtGate}
                trackColor={{ false: colors.border, true: '#10B981' }}
              />
            </View>

            {/* Manual Valid Time Window Configuration */}
            <Text style={styles.fieldSectionLabel}>Select Date</Text>
            <TouchableOpacity
              style={styles.interactiveInputBox}
              onPress={() => setShowPicker({ field: 'date', mode: 'date' })}
            >
              <Text style={styles.interactiveInputText}>
                {selectedDate.toDateString() === new Date().toDateString()
                  ? 'Today'
                  : formatDateStr(selectedDate)}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.timeDurationRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldSectionLabel}>Starting from</Text>
                <TouchableOpacity
                  style={styles.interactiveInputBox}
                  onPress={() => setShowPicker({ field: 'time', mode: 'time' })}
                >
                  <Text style={styles.interactiveInputText}>{formatTimeStr(startTime)}</Text>
                  <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.fieldSectionLabel}>Valid for</Text>
                <View style={styles.durationSelectorRow}>
                  {[1, 2, 4, 8, 24].map((hrs) => (
                    <TouchableOpacity
                      key={hrs}
                      style={[
                        styles.durationPill,
                        durationHours === hrs && styles.durationPillActive,
                      ]}
                      onPress={() => setDurationHours(hrs)}
                    >
                      <Text
                        style={[
                          styles.durationPillText,
                          durationHours === hrs && styles.durationPillTextActive,
                        ]}
                      >
                        {hrs}h
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.stepBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={styles.primaryYellowBtn}
              onPress={() => {
                const effectiveProvider = selectedCompany === 'Other' ? (otherDeliveryName || 'Delivery Executive') : (selectedCompany || 'Delivery Executive');
                handleCreatePass(
                  'DELIVERY',
                  effectiveProvider,
                  `Delivery - ${leaveAtGate ? 'Leave at Gate' : 'Door Delivery'}`
                );
              }}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryYellowBtnText}>
                {isSubmitting ? 'Approving…' : 'Pre-Approve Delivery'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* DateTime Picker Modal */}
      {showPicker && (
        <DateTimePicker
          value={
            showPicker.field === 'date'
              ? selectedDate
              : showPicker.field === 'time'
              ? startTime
              : recurringExpiry
          }
          mode={showPicker.mode}
          display="default"
          is24Hour={false}
          onChange={(e, val) => {
            setShowPicker(null);
            if (!val) return;
            if (showPicker.field === 'date') setSelectedDate(val);
            if (showPicker.field === 'time') setStartTime(val);
            if (showPicker.field === 'recurringExpiry') setRecurringExpiry(val);
          }}
        />
      )}

      {/* Offscreen Themed Pass Card for Instant Native Image Capture */}
      <View
        style={{
          position: 'absolute',
          top: -9999,
          left: -9999,
          opacity: 1,
        }}
        pointerEvents="none"
      >
        <ThemedPassCard
          ref={passCardRef}
          themeId={activeCardData.themeId}
          visitorName={activeCardData.visitorName}
          residentName={activeCardData.residentName}
          unitName={activeCardData.unitName}
          propertyName={activeCardData.propertyName}
          validTimeWindow={activeCardData.validTimeWindow}
          passCode={activeCardData.passCode}
          qrPayload={activeCardData.qrPayload}
          note={activeCardData.note}
        />
      </View>
    </KeyboardAvoidingView>
  );

  function setPhoneDigitsManual(digits: string) {
    setManualPhoneDigits(digits);
  }
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // Step 1: Main Hub Styles
    mainHubContainer: {
      flex: 1,
      paddingHorizontal: 20,
    },
    hubHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 28,
    },
    hubTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
    },
    hubCloseBtn: {
      padding: 6,
      borderRadius: 12,
      backgroundColor: colors.card,
    },
    hubIconsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 22,
      paddingVertical: 24,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    hubIconItem: {
      alignItems: 'center',
      gap: 10,
    },
    hubIconBox: {
      width: 58,
      height: 58,
      borderRadius: 16,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    hubIconLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    hubInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5',
      borderRadius: 16,
      padding: 16,
      marginTop: 24,
      gap: 12,
      borderWidth: 1,
      borderColor: isDark ? '#065F46' : '#A7F3D0',
    },
    hubInfoTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#34D399' : '#065F46',
      marginBottom: 2,
    },
    hubInfoText: {
      fontSize: 12,
      color: isDark ? '#A7F3D0' : '#047857',
      lineHeight: 16,
    },

    // Step Top Bar & Container
    stepContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    stepTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    topBackBtn: {
      padding: 6,
      borderRadius: 10,
    },
    stepHeaderTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    stepContentScroll: {
      padding: 16,
      paddingBottom: 40,
    },
    stepSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 20,
    },

    // Step 2: Guest Type Cards
    guestTypesList: {
      gap: 14,
    },
    guestTypeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    guestTypeCardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 4,
    },
    guestTypeCardDesc: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
    },
    guestTypeCardIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    privateInviteCard: {
      backgroundColor: isDark ? 'rgba(126, 34, 206, 0.15)' : '#FAF5FF',
      borderColor: '#E9D5FF',
    },

    // Step 3: Date Time Tabs & Options
    frequencyTabsRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    frequencyTabItem: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    frequencyTabItemActive: {
      borderBottomColor: '#1E293B',
    },
    frequencyTabLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textMuted,
    },
    frequencyTabLabelActive: {
      color: colors.text,
      fontWeight: '800',
    },
    privateToggleCard: {
      backgroundColor: isDark ? 'rgba(126, 34, 206, 0.15)' : '#FAF5FF',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: '#E9D5FF',
      marginBottom: 20,
    },
    privateCheckboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 6,
    },
    checkboxBox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: '#9333EA',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxBoxActive: {
      backgroundColor: '#9333EA',
    },
    privateCardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    privateSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 30,
    },
    privateCardSubtext: {
      flex: 1,
      fontSize: 12,
      color: '#7E22CE',
      lineHeight: 16,
    },
    privateLockBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: '#EDE9FE',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 10,
    },
    fieldSectionLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      marginTop: 6,
    },
    interactiveInputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
    },
    interactiveInputText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    timeDurationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    durationSelectorRow: {
      flexDirection: 'row',
      gap: 4,
    },
    durationPill: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    durationPillActive: {
      backgroundColor: '#FACC15',
      borderColor: '#EAB308',
    },
    durationPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    durationPillTextActive: {
      color: '#1E293B',
      fontWeight: '800',
    },
    daysRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 10,
    },
    dayButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayButtonActive: {
      backgroundColor: '#FACC15',
      borderColor: '#EAB308',
    },
    dayText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    dayTextActive: {
      color: '#1E293B',
      fontWeight: '800',
    },

    // Step Bottom Bar with Yellow CTA
    stepBottomBar: {
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    primaryYellowBtn: {
      backgroundColor: '#EAB308', // Solid warm yellow matching screenshot
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#CA8A04',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
    primaryYellowBtnText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#000000',
    },

    // Step 4: Select Guests Tabs & List
    guestSubTabsRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    guestSubTabItem: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    guestSubTabItemActive: {
      borderBottomColor: '#1E293B',
    },
    guestSubTabLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    guestSubTabLabelActive: {
      color: colors.text,
      fontWeight: '800',
    },
    searchBarBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 14,
      gap: 10,
    },
    searchBarInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      padding: 0,
    },
    contactListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contactListItemSelected: {
      borderColor: '#10B981',
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#F0FDF4',
    },
    contactAvatarCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: '#E0F2FE',
      justifyContent: 'center',
      alignItems: 'center',
    },
    contactAvatarText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#0284C7',
    },
    contactItemName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    contactItemPhone: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    manualFormContainer: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    formInputBox: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      marginBottom: 14,
    },
    addToListBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: '#F0F9FF',
      borderWidth: 1,
      borderColor: '#BAE6FD',
      gap: 6,
      marginTop: 4,
    },
    addToListBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#0284C7',
    },
    selectedGuestsQueueBox: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 10,
    },
    queueHeaderTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    queueGuestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    queueGuestName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    queueGuestPhone: {
      fontSize: 12,
      color: colors.textMuted,
    },

    // Step 5: Invite Guests Customizer & Preview (Pages 5 & 6)
    greetingHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      gap: 10,
    },
    greetingHeadline: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    editGreetingBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editGreetingText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#0284C7',
    },
    themeCardCanvas: {
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#FED7AA',
      marginBottom: 20,
    },
    cardIllustrationWrap: {
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 180,
    },
    cardTagBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      marginBottom: 14,
    },
    cardTagText: {
      color: 'white',
      fontWeight: '700',
      fontSize: 12,
    },
    cardArtContainer: {
      alignItems: 'center',
      gap: 6,
    },
    cardArtWelcomeText: {
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    cardArtSub: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      opacity: 0.8,
    },
    themeSelectorBar: {
      backgroundColor: 'rgba(255, 255, 255, 0.75)',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.05)',
    },
    themeSelectorLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#475569',
      marginBottom: 8,
    },
    themesRow: {
      flexDirection: 'row',
      gap: 10,
    },
    themeThumbnailPill: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    themeThumbnailPillActive: {
      borderColor: '#D97706',
      backgroundColor: '#FEF3C7',
      borderWidth: 2,
    },
    previewSectionLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      marginTop: 10,
    },
    entryWindowPillBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
    },
    entryWindowPillText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    noteInputBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      minHeight: 50,
      marginBottom: 14,
    },
    whatsappSwitchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
    },
    whatsappSwitchLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    guestListHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    addMoreGuestsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
    },
    addMoreGuestsText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#0284C7',
    },
    manageGuestsList: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 6,
      marginBottom: 20,
    },
    manageGuestItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    manageGuestName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    manageGuestPhone: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },

    // Step 6: Visiting Help Floating Category (Page 7)
    helpFloatingIconContainer: {
      alignItems: 'center',
      marginVertical: 20,
    },
    helpFloatingIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#FACC15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
      shadowColor: '#CA8A04',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    helpCategoryMainTitle: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1,
      color: colors.textMuted,
      textAlign: 'center',
    },
    helpCategoriesBox: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingVertical: 6,
    },
    helpCategoryRowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    helpCategoryRowText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },

    // Step 7 & 8: Cab & Delivery
    companyBadgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 18,
    },
    companyBadgePill: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    companyBadgePillActive: {
      backgroundColor: '#FACC15',
      borderColor: '#EAB308',
    },
    companyBadgeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    companyBadgeTextActive: {
      color: '#1E293B',
      fontWeight: '800',
    },
    leaveAtGateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 16,
    },
    leaveAtGateTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    leaveAtGateSub: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    },
  });
