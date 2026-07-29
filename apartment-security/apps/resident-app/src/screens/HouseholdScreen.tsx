import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';

export default function HouseholdScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { members, fetchMembers, addMember, deleteMember } = useData();
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMembers().finally(() => setLoading(false));
    }, [fetchMembers])
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
    Alert.alert('Remove member', `Remove ${name} from your household?`, [
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
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Only the primary resident can add or remove household members. Max 6 per unit.
          </Text>
        </View>

        {members.map((member) => (
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
                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(member.id, member.name)}>
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {members.length < 6 && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
            <Text style={styles.addButtonText}>+ Add household member</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{flex: 1}} activeOpacity={1} onPress={() => setShowModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Member</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={newName}
              onChangeText={setNewName}
              placeholderTextColor="#9ca3af"
            />
            
            <Text style={styles.label}>Phone Number</Text>
            <TextInput 
              style={styles.input} 
              placeholder="+91"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
              placeholderTextColor="#9ca3af"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.card} /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  infoText: {
    flex: 1,
    color: '#1e40af',
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: colors.card,
    fontSize: 20,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  memberPhone: {
    fontSize: 14,
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
    color: colors.card,
    fontSize: 10,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
  },
  deleteIcon: {
    fontSize: 20,
    color: colors.textMuted,
  },
  addButton: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 12,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  saveText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
});
