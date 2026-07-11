import { useHousehold } from '../context/DomainContexts';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { useStyles } from '../theme/useStyles';
import { typography, spacing, roundness } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

export default function HouseholdScreen() {
  const { members, addMember, deleteMember } = useHousehold();
  const { userProfile, userEmail } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const { colors, isDarkMode } = useTheme();
  const styles = useStyles(getStyles);

  const name = userProfile?.name || 'Resident';
  const phone = userProfile?.phone || userEmail || '';
  const initial = name.charAt(0).toUpperCase();

  const primaryMember = {
    id: 'primary',
    name,
    phone,
    initials: initial,
    color: colors.primary,
    isPrimary: true
  };

  const allMembers = [primaryMember, ...members];

  const handleAdd = () => {
    if (!newName) return;
    const randomColors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];
    addMember({
      id: Date.now().toString(36),
      name: newName,
      phone: newPhone,
      initials: newName.charAt(0).toUpperCase(),
      color: randomColors[Math.floor(Math.random() * randomColors.length)],
      isPrimary: false
    });
    setShowModal(false);
    setNewName('');
    setNewPhone('');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color={isDarkMode ? '#60a5fa' : '#1e40af'} style={styles.infoIcon} />
          <Text style={styles.infoText}>
            Only the primary resident can add or remove household members. Max 6 per unit.
          </Text>
        </View>

        {allMembers.map((member) => (
          <View key={member.id} style={styles.card}>
            <View style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: member.color }]}>
                <Text style={styles.avatarText}>{member.initials}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberPhone}>{member.phone}</Text>
                {member.isPrimary && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                  </View>
                )}
              </View>
              {!member.isPrimary && (
                <TouchableOpacity style={styles.deleteButton} onPress={() => deleteMember(member.id)}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {allMembers.length < 6 && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={20} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.addButtonText}>Add household member</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Member</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+91"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleAdd}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  infoBox: {
    flexDirection: 'row' as const,
    backgroundColor: isDarkMode ? 'rgba(37, 99, 235, 0.2)' : '#eff6ff',
    padding: spacing.lg,
    borderRadius: roundness.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: isDarkMode ? '#1e3a8a' : '#bfdbfe',
  },
  infoIcon: {
    marginRight: spacing.sm,
  },
  infoText: {
    flex: 1,
    color: isDarkMode ? '#93c5fd' : '#1e40af',
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: roundness.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: isDarkMode ? 0 : 1,
    borderColor: isDarkMode ? 'transparent' : colors.border,
  },
  cardRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  memberInfo: {
    flex: 1,
    alignItems: 'flex-start' as const,
  },
  memberName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  memberPhone: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: 4,
  },
  primaryBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  primaryBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  deleteButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row' as const,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: roundness.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: isDarkMode ? '#452a0a' : colors.primaryLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modalContent: {
    width: '85%' as const,
    backgroundColor: colors.surface,
    borderRadius: roundness.xl,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: roundness.md,
    padding: spacing.lg,
    fontSize: typography.sizes.md,
    marginBottom: spacing.lg,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    marginTop: spacing.sm,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: roundness.md,
    marginRight: spacing.md,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: roundness.md,
  },
  saveText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
