import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';

export default function HouseholdScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { members, fetchMembers, addMember, deleteMember } = useData();
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (members.length === 0) setLoading(true);
      fetchMembers().finally(() => setLoading(false));
    }, [fetchMembers, members.length])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setSaving(true);
    try {
      await addMember(newName.trim(), newPhone.trim());
      setShowModal(false);
      setNewName('');
      setNewPhone('');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to add household member.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Remove Member', `Are you sure you want to remove "${name}" from your household?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteMember(id).catch(() => Alert.alert('Error', 'Failed to remove member.')),
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Family & Household</Text>
        <Text style={styles.subTitle}>{members.length} members registered • Max 6 per unit</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {/* INFO NOTICE */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.text} />
          <Text style={styles.infoText}>
            Primary resident can manage family access and gate approval permissions.
          </Text>
        </View>

        {/* MEMBERS LIST */}
        {members.map((member) => (
          <View key={member.id} style={styles.card}>
            <View style={styles.cardRow}>
              {/* Quick Actions Style Avatar Box */}
              <View style={styles.quickActionIconBox}>
                <Ionicons name="person-outline" size={22} color={colors.text} />
              </View>

              <View style={styles.memberInfo}>
                <View style={styles.nameBadgeRow}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {member.isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                    </View>
                  )}
                </View>
                <View style={styles.phoneRow}>
                  <Ionicons name="call-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.memberPhone}>{member.phone || 'No phone'}</Text>
                </View>
              </View>

              {!member.isPrimary && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(member.id, member.name)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {members.length < 6 && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)} activeOpacity={0.85}>
            <Ionicons name="person-add" size={18} color="#0f172a" style={{ marginRight: 6 }} />
            <Text style={styles.addButtonText}>Add Household Member</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ADD MEMBER MODAL */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Family Member</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Priya Sharma"
              value={newName}
              onChangeText={setNewName}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. +91 98765 43210"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleAdd}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.saveText}>Save Member</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f172a' : '#f5f3ef',
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
    },
    subTitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 40,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 14,
      padding: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    infoText: {
      fontSize: 12,
      color: colors.textMuted,
      flex: 1,
      lineHeight: 17,
      fontWeight: '500',
    },
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    quickActionIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: isDark ? '#334155' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    memberInfo: {
      flex: 1,
    },
    nameBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    memberName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    primaryBadge: {
      backgroundColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      borderWidth: 1,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    primaryBadgeText: {
      color: '#16a34a',
      fontSize: 9,
      fontWeight: '800',
    },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    memberPhone: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    deleteButton: {
      padding: 8,
      backgroundColor: isDark ? '#450a0a' : '#fef2f2',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#7f1d1d' : '#fecaca',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#facc15',
      paddingVertical: 13,
      borderRadius: 14,
      marginTop: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    addButtonText: {
      color: '#0f172a',
      fontSize: 14,
      fontWeight: '800',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 36,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    input: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      fontSize: 14,
      marginBottom: 14,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    cancelText: {
      color: colors.textMuted,
      fontWeight: '700',
      fontSize: 13,
    },
    saveButton: {
      flex: 1,
      backgroundColor: '#facc15',
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: {
      color: '#0f172a',
      fontWeight: '800',
      fontSize: 13,
    },
  });
