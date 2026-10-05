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

type TabType = 'members' | 'vehicles' | 'pets';

export default function HouseholdScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const {
    members,
    fetchMembers,
    addMember,
    deleteMember,
    vehicles,
    fetchVehicles,
    addVehicle,
    deleteVehicle,
    pets,
    fetchPets,
    addPet,
    deletePet,
  } = useData();

  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Member Modal State
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');

  // Vehicle Modal State
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleRegNo, setVehicleRegNo] = useState('');
  const [vehicleType, setVehicleType] = useState('CAR');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');

  // Pet Modal State
  const [showPetModal, setShowPetModal] = useState(false);
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState('DOG');
  const [petBreed, setPetBreed] = useState('');
  const [petAge, setPetAge] = useState('');
  const [petNotes, setPetNotes] = useState('');

  const loadAll = useCallback(async () => {
    await Promise.allSettled([fetchMembers(), fetchVehicles(), fetchPets()]);
  }, [fetchMembers, fetchVehicles, fetchPets]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAll().finally(() => setLoading(false));
    }, [loadAll])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // Add Member
  const handleAddMember = async () => {
    if (!memberName.trim() || !memberPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter both name and phone number.');
      return;
    }
    setSaving(true);
    try {
      await addMember(memberName.trim(), memberPhone.trim());
      setShowMemberModal(false);
      setMemberName('');
      setMemberPhone('');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to add household member.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = (id: string, name: string) => {
    Alert.alert('Remove Member', `Are you sure you want to remove "${name}" from your household?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteMember(id).catch(() => Alert.alert('Error', 'Failed to remove member.')),
      },
    ]);
  };

  // Add Vehicle
  const handleAddVehicle = async () => {
    if (!vehicleRegNo.trim()) {
      Alert.alert('Required', 'Please enter the vehicle registration / plate number.');
      return;
    }
    setSaving(true);
    try {
      await addVehicle({
        registrationNo: vehicleRegNo.trim().toUpperCase(),
        type: vehicleType,
        make: vehicleMake.trim() || undefined,
        model: vehicleModel.trim() || undefined,
        color: vehicleColor.trim() || undefined,
      });
      setShowVehicleModal(false);
      setVehicleRegNo('');
      setVehicleType('CAR');
      setVehicleMake('');
      setVehicleModel('');
      setVehicleColor('');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to register vehicle.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVehicle = (id: string, regNo: string) => {
    Alert.alert('Remove Vehicle', `Are you sure you want to remove vehicle "${regNo}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteVehicle(id).catch(() => Alert.alert('Error', 'Failed to remove vehicle.')),
      },
    ]);
  };

  // Add Pet
  const handleAddPet = async () => {
    if (!petName.trim()) {
      Alert.alert('Required', 'Please enter the pet name.');
      return;
    }
    setSaving(true);
    try {
      await addPet({
        name: petName.trim(),
        type: petType,
        breed: petBreed.trim() || undefined,
        age: petAge.trim() || undefined,
        notes: petNotes.trim() || undefined,
      });
      setShowPetModal(false);
      setPetName('');
      setPetType('DOG');
      setPetBreed('');
      setPetAge('');
      setPetNotes('');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message ?? 'Failed to register pet.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePet = (id: string, name: string) => {
    Alert.alert('Remove Pet', `Are you sure you want to remove pet "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deletePet(id).catch(() => Alert.alert('Error', 'Failed to remove pet.')),
      },
    ]);
  };

  const getVehicleIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'BIKE':
        return 'bicycle-outline';
      case 'EV':
        return 'flash-outline';
      default:
        return 'car-sport-outline';
    }
  };

  const getVehicleTypeLabel = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'BIKE':
        return 'Two-Wheeler';
      case 'EV':
        return 'Electric Vehicle';
      default:
        return 'Car / 4-Wheeler';
    }
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
        <Text style={styles.subTitle}>
          {activeTab === 'members'
            ? `${members.length} members registered • Max 6 per unit`
            : activeTab === 'vehicles'
            ? `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} registered • Authorized parking`
            : `${pets.length} pet${pets.length === 1 ? '' : 's'} registered • Society pet records`}
        </Text>
      </View>

      {/* SEGMENTED TAB SELECTOR */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'members' && styles.tabButtonActive]}
          onPress={() => setActiveTab('members')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === 'members' ? '#0f172a' : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
            Members ({members.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'vehicles' && styles.tabButtonActive]}
          onPress={() => setActiveTab('vehicles')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="car-outline"
            size={16}
            color={activeTab === 'vehicles' ? '#0f172a' : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === 'vehicles' && styles.tabTextActive]}>
            Vehicles ({vehicles.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pets' && styles.tabButtonActive]}
          onPress={() => setActiveTab('pets')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="paw-outline"
            size={16}
            color={activeTab === 'pets' ? '#0f172a' : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabText, activeTab === 'pets' && styles.tabTextActive]}>
            Pets ({pets.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {/* ================= MEMBERS TAB ================= */}
        {activeTab === 'members' && (
          <>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.text} />
              <Text style={styles.infoText}>
                Primary resident can manage family access and gate approval permissions.
              </Text>
            </View>

            {members.map((member) => (
              <View key={member.id} style={styles.card}>
                <View style={styles.cardRow}>
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
                      onPress={() => handleDeleteMember(member.id, member.name)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            {members.length < 6 && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowMemberModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add" size={18} color="#0f172a" style={{ marginRight: 6 }} />
                <Text style={styles.addButtonText}>Add Household Member</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ================= VEHICLES TAB ================= */}
        {activeTab === 'vehicles' && (
          <>
            <View style={styles.infoBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.text} />
              <Text style={styles.infoText}>
                Registered vehicles get automatic RFID / security gate clearance & parking permit verification.
              </Text>
            </View>

            {vehicles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="car-sport-outline" size={44} color={colors.textMuted} style={{ opacity: 0.6 }} />
                <Text style={styles.emptyTitle}>No Vehicles Registered</Text>
                <Text style={styles.emptySubTitle}>Add your cars, two-wheelers, or electric vehicles for hassle-free entry.</Text>
              </View>
            ) : (
              vehicles.map((v) => (
                <View key={v.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={[styles.quickActionIconBox, { backgroundColor: isDark ? '#1e293b' : '#eff6ff' }]}>
                      <Ionicons name={getVehicleIcon(v.type) as any} size={22} color={colors.primary} />
                    </View>

                    <View style={styles.memberInfo}>
                      <View style={styles.nameBadgeRow}>
                        <Text style={styles.plateNumber}>{v.registrationNo}</Text>
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>{getVehicleTypeLabel(v.type)}</Text>
                        </View>
                      </View>
                      <View style={styles.phoneRow}>
                        <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.memberPhone}>
                          {[v.make, v.model, v.color ? `Color: ${v.color}` : null].filter(Boolean).join(' • ') || 'Authorized Vehicle'}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteVehicle(v.id, v.registrationNo)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowVehicleModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={20} color="#0f172a" style={{ marginRight: 6 }} />
              <Text style={styles.addButtonText}>Add Vehicle</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ================= PETS TAB ================= */}
        {activeTab === 'pets' && (
          <>
            <View style={styles.infoBox}>
              <Ionicons name="paw-outline" size={18} color={colors.text} />
              <Text style={styles.infoText}>
                Register household pets to keep society records up to date and aid in identification.
              </Text>
            </View>

            {pets.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="paw-outline" size={44} color={colors.textMuted} style={{ opacity: 0.6 }} />
                <Text style={styles.emptyTitle}>No Pets Registered</Text>
                <Text style={styles.emptySubTitle}>Add your household pets (dogs, cats, birds, etc.) to the unit record.</Text>
              </View>
            ) : (
              pets.map((p) => (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={[styles.quickActionIconBox, { backgroundColor: isDark ? '#1e293b' : '#fef3c7' }]}>
                      <Ionicons name="paw" size={22} color="#d97706" />
                    </View>

                    <View style={styles.memberInfo}>
                      <View style={styles.nameBadgeRow}>
                        <Text style={styles.memberName}>{p.name}</Text>
                        <View style={[styles.typeBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                          <Text style={[styles.typeBadgeText, { color: '#b45309' }]}>{p.type || 'Pet'}</Text>
                        </View>
                      </View>
                      <View style={styles.phoneRow}>
                        <Ionicons name="heart-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.memberPhone}>
                          {[p.breed ? `Breed: ${p.breed}` : null, p.age ? `Age: ${p.age}` : null, p.notes ? `Note: ${p.notes}` : null].filter(Boolean).join(' • ') || 'Household Pet'}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeletePet(p.id, p.name)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowPetModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={20} color="#0f172a" style={{ marginRight: 6 }} />
              <Text style={styles.addButtonText}>Add Pet</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ================= ADD MEMBER MODAL ================= */}
      <Modal visible={showMemberModal} transparent animationType="slide" onRequestClose={() => setShowMemberModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowMemberModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Family Member</Text>
              <TouchableOpacity onPress={() => setShowMemberModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Priya Sharma"
              value={memberName}
              onChangeText={setMemberName}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. +91 98765 43210"
              keyboardType="phone-pad"
              value={memberPhone}
              onChangeText={setMemberPhone}
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowMemberModal(false)} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleAddMember}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveText}>Save Member</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= ADD VEHICLE MODAL ================= */}
      <Modal visible={showVehicleModal} transparent animationType="slide" onRequestClose={() => setShowVehicleModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowVehicleModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Vehicle</Text>
              <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Registration / Plate Number *</Text>
            <TextInput
              style={[styles.input, { textTransform: 'uppercase', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700' }]}
              placeholder="e.g. MH 12 AB 1234"
              value={vehicleRegNo}
              onChangeText={setVehicleRegNo}
              autoCapitalize="characters"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Vehicle Type</Text>
            <View style={styles.typeSelectorRow}>
              {[
                { key: 'CAR', label: 'Car / 4W', icon: 'car-sport-outline' },
                { key: 'BIKE', label: '2-Wheeler', icon: 'bicycle-outline' },
                { key: 'EV', label: 'EV', icon: 'flash-outline' },
              ].map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeOption, vehicleType === t.key && styles.typeOptionActive]}
                  onPress={() => setVehicleType(t.key)}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={16}
                    color={vehicleType === t.key ? '#0f172a' : colors.textMuted}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.typeOptionText, vehicleType === t.key && styles.typeOptionTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Make / Brand</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Honda"
                  value={vehicleMake}
                  onChangeText={setVehicleMake}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Model</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. City"
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <Text style={styles.label}>Color</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Pearl White"
              value={vehicleColor}
              onChangeText={setVehicleColor}
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowVehicleModal(false)} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleAddVehicle}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveText}>Save Vehicle</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= ADD PET MODAL ================= */}
      <Modal visible={showPetModal} transparent animationType="slide" onRequestClose={() => setShowPetModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPetModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Household Pet</Text>
              <TouchableOpacity onPress={() => setShowPetModal(false)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Pet Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Bruno"
              value={petName}
              onChangeText={setPetName}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Pet Type</Text>
            <View style={styles.typeSelectorRow}>
              {['DOG', 'CAT', 'BIRD', 'OTHER'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeOption, petType === type && styles.typeOptionActive]}
                  onPress={() => setPetType(type)}
                >
                  <Text style={[styles.typeOptionText, petType === type && styles.typeOptionTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Breed</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Golden Retriever"
                  value={petBreed}
                  onChangeText={setPetBreed}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Age / Details</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2 Years"
                  value={petAge}
                  onChangeText={setPetAge}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <Text style={styles.label}>Notes / Vaccination info</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Fully vaccinated, friendly"
              value={petNotes}
              onChangeText={setPetNotes}
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPetModal(false)} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleAddPet}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveText}>Save Pet</Text>}
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
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
      borderRadius: 12,
      padding: 4,
      marginHorizontal: 16,
      marginVertical: 10,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: 9,
    },
    tabButtonActive: {
      backgroundColor: '#facc15',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 2,
    },
    tabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabTextActive: {
      color: '#0f172a',
      fontWeight: '800',
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 4,
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
    plateNumber: {
      fontSize: 15,
      fontWeight: '800',
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      letterSpacing: 0.5,
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
    typeBadge: {
      backgroundColor: '#eff6ff',
      borderColor: '#bfdbfe',
      borderWidth: 1,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    typeBadgeText: {
      color: '#1d4ed8',
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
    emptyContainer: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      marginVertical: 8,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginTop: 10,
    },
    emptySubTitle: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 17,
      maxWidth: 260,
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
    typeSelectorRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    typeOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    typeOptionActive: {
      backgroundColor: '#facc15',
      borderColor: '#facc15',
    },
    typeOptionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    typeOptionTextActive: {
      color: '#0f172a',
      fontWeight: '800',
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
