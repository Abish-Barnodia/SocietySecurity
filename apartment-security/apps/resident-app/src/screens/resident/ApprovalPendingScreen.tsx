import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@apartment-security/shared-auth';
import api from '../../utils/api';

interface Props {
  flatNumber?: string;
  tower?: string;
  societyName?: string;
  submittedAt?: string;
  email?: string;
  onRefreshStatus?: () => void;
  onSwitchAccount?: () => void;
  onGoToLogin?: () => void;
}

export default function ApprovalPendingScreen({
  flatNumber = '',
  tower = '',
  societyName = 'Society Security',
  submittedAt,
  email,
  onRefreshStatus,
  onSwitchAccount,
  onGoToLogin,
}: Props) {
  const { userProfile, refreshProfile, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [faqExpanded1, setFaqExpanded1] = useState(true);
  const [faqExpanded2, setFaqExpanded2] = useState(false);
  const [viewMoreFaq, setViewMoreFaq] = useState(false);

  const formattedDate = submittedAt
    ? new Date(submittedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '26 Sep 2026, 07:51 PM';

  const displayFlat = userProfile?.flat || flatNumber;
  const displayTower = userProfile?.wing || tower;

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out or switch account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => {
          if (onGoToLogin) onGoToLogin();
          else if (onSwitchAccount) onSwitchAccount();
          else logout();
        }},
      ]
    );
  };

  const handleGoToLogin = () => {
    if (onGoToLogin) onGoToLogin();
    else if (onSwitchAccount) onSwitchAccount();
    else logout();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header Bar */}
      <View style={[
        styles.topBar,
        { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 12 }
      ]}>
        <TouchableOpacity style={styles.flatSelector}>
          <Text style={styles.flatSelectorText}>
            {displayTower} {displayFlat}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#1E293B" style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={styles.profileButton}>
          <Ionicons name="person-circle-outline" size={32} color="#1E293B" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Card */}
        <View style={styles.cardContainer}>
          {/* Top Orange / Coral Header Banner */}
          <View style={styles.bannerHeader}>
            <Text style={styles.bannerTitle}>Approval Pending</Text>
            <Text style={styles.bannerSubtitle}>
              Your account needs approval from your Society Office or Management Committee to ensure that only verified residents get access to Society Security.
            </Text>
          </View>

          {/* Stepper Timeline */}
          <View style={styles.timelineSection}>
            {/* Step 1: Application submitted */}
            <View style={styles.timelineStep}>
              <View style={styles.stepIconWrap}>
                <View style={[styles.stepCircle, styles.stepCircleDone]}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
                <View style={styles.stepLine} />
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepHeaderRow}>
                  <Text style={styles.stepTitle}>Application submitted to society</Text>
                  <Ionicons name="chevron-down" size={16} color="#64748B" />
                </View>
                <Text style={styles.stepDesc}>
                  We've sent your request to your society admin on {formattedDate}
                </Text>
              </View>
            </View>

            {/* Step 2: Reminding */}
            <View style={styles.timelineStep}>
              <View style={styles.stepIconWrap}>
                <View style={styles.stepCircleOutline}>
                  <Ionicons name="notifications-outline" size={14} color="#64748B" />
                </View>
                <View style={styles.stepLine} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>We're reminding</Text>
                <Text style={styles.stepDesc}>We send reminders every 24 Hours</Text>
              </View>
            </View>

            {/* Step 3: Verification */}
            <View style={styles.timelineStep}>
              <View style={styles.stepIconWrap}>
                <View style={[styles.stepCircleOutline, { borderColor: '#F59E0B' }]}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
                </View>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Verification by Society Admin</Text>
                <Text style={styles.stepDesc}>Most approvals happen within 72 hours.</Text>
              </View>
            </View>
          </View>

          {/* FAQ Divider */}
          <View style={styles.faqDividerRow}>
            <View style={styles.faqDividerLine} />
            <Text style={styles.faqDividerText}>FAQ</Text>
            <View style={styles.faqDividerLine} />
          </View>

          {/* FAQ Accordion Item 1 */}
          <View style={styles.faqItem}>
            <TouchableOpacity
              style={styles.faqHeader}
              onPress={() => setFaqExpanded1(!faqExpanded1)}
            >
              <Text style={styles.faqQuestion}>
                My approval is pending for more than 72 hours, What can i do?
              </Text>
              <Ionicons
                name={faqExpanded1 ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#64748B"
              />
            </TouchableOpacity>
            {faqExpanded1 && (
              <Text style={styles.faqAnswer}>
                For faster approvals, we suggest reaching out to your society office to see if there is any other pending action (such as document submission, payments etc)
              </Text>
            )}
          </View>

          {/* FAQ Accordion Item 2 */}
          <View style={styles.faqItem}>
            <TouchableOpacity
              style={styles.faqHeader}
              onPress={() => setFaqExpanded2(!faqExpanded2)}
            >
              <Text style={styles.faqQuestion}>
                No one is approving. Can Society Security help?
              </Text>
              <Ionicons
                name={faqExpanded2 ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#64748B"
              />
            </TouchableOpacity>
            {faqExpanded2 && (
              <Text style={styles.faqAnswer}>
                Society Security provides the management platform for your society. For security reasons, residency verification and gate access approvals can only be authorized by your Society Management Committee.
              </Text>
            )}
          </View>

          {/* View Less / More Toggle */}
          <TouchableOpacity
            style={styles.viewMoreButton}
            onPress={() => setViewMoreFaq(!viewMoreFaq)}
          >
            <Text style={styles.viewMoreText}>
              {viewMoreFaq ? 'View less' : 'View more'}
            </Text>
            <Ionicons
              name={viewMoreFaq ? 'chevron-down' : 'chevron-up'}
              size={16}
              color="#334155"
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>

        {/* Email Notification Information Box */}
        <View style={styles.emailNoticeBox}>
          <Ionicons name="mail-outline" size={22} color="#0284C7" style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.emailNoticeTitle}>Email Notification on Approval</Text>
            <Text style={styles.emailNoticeDesc}>
              Once verified by your society manager, you will receive an approval confirmation email. You can then log in with your credentials.
            </Text>
          </View>
        </View>

        {/* Move to Login Page Action Button */}
        <TouchableOpacity
          style={styles.moveToLoginBtn}
          onPress={handleGoToLogin}
          activeOpacity={0.85}
        >
          <Text style={styles.moveToLoginBtnText}>Move to Login Page</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  flatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flatSelectorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileButton: {
    padding: 2,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  bannerHeader: {
    backgroundColor: '#F97316',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#FFF7ED',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.95,
  },
  timelineSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  timelineStep: {
    flexDirection: 'row',
    minHeight: 64,
  },
  stepIconWrap: {
    alignItems: 'center',
    marginRight: 14,
    width: 24,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: '#0F766E',
  },
  stepCircleOutline: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#0F766E',
    marginVertical: 4,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 16,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  faqDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: 12,
  },
  faqDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  faqDividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginHorizontal: 12,
  },
  faqItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
    marginRight: 10,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 19,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  emailNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
    marginBottom: 16,
  },
  emailNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 4,
  },
  emailNoticeDesc: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  moveToLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  moveToLoginBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
