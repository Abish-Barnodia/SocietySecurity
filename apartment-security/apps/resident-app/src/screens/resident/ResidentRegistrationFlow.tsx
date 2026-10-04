import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '@apartment-security/shared-auth';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';

interface CountryItem {
  id: string;
  name: string;
  code: string;
}

interface CityItem {
  id: string;
  name: string;
  iconName?: string;
}

const COUNTRIES: CountryItem[] = [
  { id: 'in', name: 'India', code: '+91' },
];

const POPULAR_CITIES: CityItem[] = [
  { id: 'blr', name: 'Bangalore', iconName: 'business-outline' },
  { id: 'mum', name: 'Mumbai', iconName: 'boat-outline' },
  { id: 'del', name: 'Delhi NCR', iconName: 'shield-outline' },
  { id: 'pun', name: 'Pune', iconName: 'school-outline' },
  { id: 'che', name: 'Chennai', iconName: 'trail-sign-outline' },
  { id: 'hyd', name: 'Hyderabad', iconName: 'diamond-outline' },
  { id: 'ahm', name: 'Ahmedabad', iconName: 'earth-outline' },
  { id: 'kol', name: 'Kolkata', iconName: 'bridge-outline' },
  { id: 'koc', name: 'Kochi', iconName: 'leaf-outline' },
];

const ALL_CITIES: CityItem[] = [
  { id: 'c1', name: 'Indirapuram' },
  { id: 'c2', name: 'Abu Road' },
  { id: 'c3', name: 'Adalaj' },
  { id: 'c4', name: 'Adchini' },
  { id: 'c5', name: 'Adharwadi Jail road' },
  { id: 'c6', name: 'Adilabad' },
  { id: 'c7', name: 'Adityapur' },
  { id: 'c8', name: 'Agartala' },
  { id: 'c9', name: 'Agra' },
  { id: 'c10', name: 'Ahmedabad' },
  { id: 'c11', name: 'Bengaluru' },
  { id: 'c12', name: 'Bhopal' },
  { id: 'c13', name: 'Chandigarh' },
  { id: 'c14', name: 'Chennai' },
  { id: 'c15', name: 'Coimbatore' },
  { id: 'c16', name: 'Delhi NCR' },
  { id: 'c17', name: 'Dehradun' },
  { id: 'c18', name: 'Faridabad' },
  { id: 'c19', name: 'Ghaziabad' },
  { id: 'c20', name: 'Gurgaon' },
  { id: 'c21', name: 'Guwahati' },
  { id: 'c22', name: 'Hyderabad' },
  { id: 'c23', name: 'Indore' },
  { id: 'c24', name: 'Jaipur' },
  { id: 'c25', name: 'Kochi' },
  { id: 'c26', name: 'Kolkata' },
  { id: 'c27', name: 'Lucknow' },
  { id: 'c28', name: 'Mumbai' },
  { id: 'c29', name: 'Mysuru' },
  { id: 'c30', name: 'Nagpur' },
  { id: 'c31', name: 'Navi Mumbai' },
  { id: 'c32', name: 'Noida' },
  { id: 'c33', name: 'Patna' },
  { id: 'c34', name: 'Pune' },
  { id: 'c35', name: 'Thane' },
  { id: 'c36', name: 'Visakhapatnam' },
];

const DEFAULT_BUILDINGS = ['Block A', 'Block B', 'Block C', 'Block D'];

const DEFAULT_FLATS_BY_BUILDING: Record<string, string[]> = {
  'Block A': ['101', '102', '103', '104', '201', '202', '203', '204', '301', '302', '303', '304', '401', '402', '403', '404'],
  'Block B': ['101', '102', '103', '104', '201', '202', '203', '204', '301', '302', '303', '304', '401', '402', '403', '404'],
  'Block C': ['101', '102', '103', '104', '201', '202', '203', '204', '301', '302', '303', '304'],
  'Block D': ['101', '102', '103', '104', '201', '202', '203', '204', '301', '302', '303', '304'],
};

export type RegistrationStep =
  | 'COUNTRY_SELECT'
  | 'CITY_SELECT'
  | 'ADD_HOME_BUILDING'
  | 'FLAT_SELECT'
  | 'ADD_HOME_DETAILS';

interface Props {
  onCompleteRegistration?: (data: any) => void;
  onGoToLogin?: () => void;
  onBack?: () => void;
  navigation?: any;
}

export default function ResidentRegistrationFlow({ onCompleteRegistration, onGoToLogin, onBack, navigation }: Props) {
  const { colors } = useTheme();
  const { isAuthenticated, signup, login, logout, updateProfile } = useAuth();

  // Navigation step within onboarding
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('ADD_HOME_BUILDING');

  // Search queries
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [flatSearch, setFlatSearch] = useState('');

  // Form selections
  const [selectedCountry, setSelectedCountry] = useState('India');
  const [selectedCity, setSelectedCity] = useState('Bengaluru');
  const [selectedSociety, setSelectedSociety] = useState('Aban Humming bees');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [societiesList, setSocietiesList] = useState<any[]>([]);
  const [loadingSocieties, setLoadingSocieties] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState('Block A');
  const [selectedFlat, setSelectedFlat] = useState('103');

  // Details
  const [residentRole, setResidentRole] = useState<'Owner' | 'Tenant'>('Tenant');
  const [tenantSubtype, setTenantSubtype] = useState<'Tenant' | 'Family member of the tenant' | 'Renting with other flatmates'>('Tenant');
  const [occupancyStatus, setOccupancyStatus] = useState<'Currently residing' | 'Moving in'>('Currently residing');
  
  // User Credentials / Profile Details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('');

  // Document Upload
  const [attachedDoc, setAttachedDoc] = useState<{ name: string; uri: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [societyModalVisible, setSocietyModalVisible] = useState(false);

  const fetchSocieties = async () => {
    setLoadingSocieties(true);
    try {
      const res = await api.get('/auth/societies');
      if (res.data?.data && res.data.data.length > 0) {
        setSocietiesList(res.data.data);
        // If current society is not in list, select the first one
        const currentInList = res.data.data.find((s: any) => s.name === selectedSociety || s.id === selectedPropertyId);
        if (!currentInList) {
          setSelectedSociety(res.data.data[0].name);
          setSelectedPropertyId(res.data.data[0].id);
          if (res.data.data[0].city) setSelectedCity(res.data.data[0].city);
        }
      }
    } catch {
      // Fallback
      if (societiesList.length === 0) {
        setSocietiesList([
          { id: '1', name: 'Aban Humming bees', city: 'Bengaluru' },
          { id: '2', name: 'Aban Essence', city: 'Bengaluru' },
          { id: '3', name: 'Prestige Lakeside', city: 'Bengaluru' },
        ]);
      }
    } finally {
      setLoadingSocieties(false);
    }
  };

  useEffect(() => {
    fetchSocieties();
  }, []);

  const [uploadingDoc, setUploadingDoc] = useState(false);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setUploadingDoc(true);

        const mime = asset.mimeType || (
          asset.name.toLowerCase().endsWith('.png') ? 'image/png' :
          asset.name.toLowerCase().endsWith('.jpg') || asset.name.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' :
          'application/pdf'
        );

        // Read file as Base64 so it can be viewed on web portal directly
        let base64DataUri = asset.uri;
        try {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'base64',
          });
          if (base64) {
            base64DataUri = `data:${mime};base64,${base64}`;
          }
        } catch (readErr) {
          console.log('Base64 read fallback:', readErr);
        }

        setAttachedDoc({
          name: asset.name,
          uri: base64DataUri,
        });

        // Also attempt upload to server
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
            name: asset.name || 'document.pdf',
            type: mime,
          } as any);

          const uploadRes = await api.post('/residents/upload-document', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          if (uploadRes.data?.data?.url) {
            setAttachedDoc({
              name: asset.name,
              uri: uploadRes.data.data.url,
            });
          }
        } catch (uploadErr) {
          console.warn('Document upload server fallback to data URI:', uploadErr);
        } finally {
          setUploadingDoc(false);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not select document. Please try again.');
      setUploadingDoc(false);
    }
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      Alert.alert('Missing Details', 'Please enter your Full Name.');
      return;
    }

    if (!isAuthenticated && (!email.trim() || !password || password.length < 6)) {
      Alert.alert('Missing Details', 'Please enter your Email and Password (min 6 chars) to create your account.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. If not authenticated, sign up or login
      if (!isAuthenticated) {
        const cleanEmail = email.trim();
        try {
          await signup(cleanEmail, password);
        } catch (err: any) {
          // If already registered, attempt login
          if (err?.response?.status === 400 || err?.message?.includes('already exists')) {
            await login(cleanEmail, password);
          } else {
            throw err;
          }
        }
      }

      // 2. Ensure document is uploaded to server if still local URI
      let finalDocUrl = attachedDoc?.uri;
      if (attachedDoc && attachedDoc.uri && attachedDoc.uri.startsWith('file://')) {
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: attachedDoc.uri,
            name: attachedDoc.name || 'document.pdf',
            type: attachedDoc.name.endsWith('.png') ? 'image/png' : attachedDoc.name.endsWith('.jpg') || attachedDoc.name.endsWith('.jpeg') ? 'image/jpeg' : 'application/pdf',
          } as any);
          const uploadRes = await api.post('/residents/upload-document', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (uploadRes.data?.data?.url) {
            finalDocUrl = uploadRes.data.data.url;
          }
        } catch (e) {
          console.warn('Document upload on submit failed:', e);
        }
      }

      // 3. Submit resident onboarding request
      const formattedTower = selectedBuilding.replace(/^Block\s*/i, '');
      const response = await api.post('/residents/me/onboard', {
        name: fullName.trim(),
        tower: formattedTower || selectedBuilding,
        flatNumber: selectedFlat,
        propertyId: selectedPropertyId || undefined,
        societyName: selectedSociety,
        city: selectedCity,
        country: selectedCountry,
        type: residentRole,
        tenantSubtype: residentRole === 'Tenant' ? tenantSubtype : 'Primary',
        occupancyStatus,
        documentName: attachedDoc?.name || undefined,
        documentUrl: finalDocUrl || undefined,
        vehicleNumber: vehicleNumber.trim() || undefined,
      });

      const resident = response.data?.data;
      const cleanEmail = email.trim();

      // Clear session so pending resident is not kept in active auth state
      await logout();

      if (onCompleteRegistration) {
        onCompleteRegistration({
          email: cleanEmail,
          flat: selectedFlat,
          building: selectedBuilding,
          society: selectedSociety,
          submittedAt: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Failed to submit request. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // SCREEN 1: SELECT COUNTRY
  // -------------------------------------------------------------
  if (currentStep === 'COUNTRY_SELECT') {
    const filteredCountries = COUNTRIES.filter((c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase())
    );

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setCurrentStep('ADD_HOME_BUILDING')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Country</Text>
          <Ionicons name="search" size={22} color="#1E293B" />
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search country..."
            placeholderTextColor="#94A3B8"
            value={countrySearch}
            onChangeText={setCountrySearch}
            autoFocus
          />
        </View>

        <FlatList
          data={filteredCountries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => {
                setSelectedCountry(item.name);
                setCurrentStep('ADD_HOME_BUILDING');
              }}
            >
              <Text style={styles.listItemText}>{item.name}</Text>
              {selectedCountry === item.name ? (
                <Ionicons name="checkmark" size={20} color="#0284C7" />
              ) : null}
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 2: SELECT CITY
  // -------------------------------------------------------------
  if (currentStep === 'CITY_SELECT') {
    const filteredCities = ALL_CITIES.filter((c) =>
      c.name.toLowerCase().includes(citySearch.toLowerCase())
    );

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setCurrentStep('ADD_HOME_BUILDING')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select City</Text>
          <Ionicons name="search" size={22} color="#1E293B" />
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search city..."
            placeholderTextColor="#94A3B8"
            value={citySearch}
            onChangeText={setCitySearch}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Top 3x3 Grid of Popular Cities */}
          <View style={styles.cityGrid}>
            {POPULAR_CITIES.map((city) => (
              <TouchableOpacity
                key={city.id}
                style={[
                  styles.cityGridItem,
                  selectedCity === city.name && styles.cityGridItemSelected,
                ]}
                onPress={() => {
                  setSelectedCity(city.name);
                  setCurrentStep('ADD_HOME_BUILDING');
                }}
              >
                <View style={styles.cityIconBox}>
                  <Ionicons
                    name={(city.iconName as any) || 'business-outline'}
                    size={28}
                    color={selectedCity === city.name ? '#0284C7' : '#64748B'}
                  />
                </View>
                <Text style={styles.cityName}>{city.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Alphabetical list */}
          <View style={styles.cityListContainer}>
            {filteredCities.map((city) => (
              <TouchableOpacity
                key={city.id}
                style={styles.listItem}
                onPress={() => {
                  setSelectedCity(city.name);
                  setCurrentStep('ADD_HOME_BUILDING');
                }}
              >
                <Text style={styles.listItemText}>{city.name}</Text>
                {selectedCity === city.name ? (
                  <Ionicons name="checkmark" size={20} color="#0284C7" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 4: SELECT FLAT
  // -------------------------------------------------------------
  if (currentStep === 'FLAT_SELECT') {
    const flatList = DEFAULT_FLATS_BY_BUILDING[selectedBuilding] || DEFAULT_FLATS_BY_BUILDING['Block A'];
    const filteredFlats = flatList.filter((f) => f.toLowerCase().includes(flatSearch.toLowerCase()));

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.searchHeaderRow}>
          <TouchableOpacity onPress={() => setCurrentStep('ADD_HOME_BUILDING')} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.flatSearchInputWrap}>
            <Ionicons name="search-outline" size={18} color="#94A3B8" />
            <TextInput
              style={styles.flatSearchInput}
              placeholder="Enter Flat to Search"
              placeholderTextColor="#94A3B8"
              value={flatSearch}
              onChangeText={setFlatSearch}
              autoFocus
            />
          </View>
        </View>

        <View style={styles.flatSectionHeader}>
          <Text style={styles.flatSectionTitle}>{selectedBuilding.replace(/^Block\s*/i, '')}</Text>
        </View>

        <FlatList
          data={filteredFlats}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.flatListItem}
              onPress={() => {
                setSelectedFlat(item);
                setCurrentStep('ADD_HOME_DETAILS');
              }}
            >
              <View style={styles.flatItemLeft}>
                <Ionicons name="home-outline" size={22} color="#64748B" />
                <Text style={styles.flatItemNumber}>{item}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 3: ADD HOME (SOCIETY & BUILDING SELECTOR)
  // -------------------------------------------------------------
  if (currentStep === 'ADD_HOME_BUILDING') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1E293B" />
            </TouchableOpacity>
          ) : onGoToLogin ? (
            <TouchableOpacity onPress={onGoToLogin} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1E293B" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
          <Text style={styles.headerTitle}>Add Home</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Country Field */}
          <Text style={styles.fieldLabel}>Country</Text>
          <TouchableOpacity
            style={styles.selectDropdown}
            onPress={() => setCurrentStep('COUNTRY_SELECT')}
          >
            <Text style={styles.selectDropdownText}>{selectedCountry}</Text>
            <Ionicons name="caret-down" size={16} color="#64748B" />
          </TouchableOpacity>

          {/* City Field */}
          <Text style={styles.fieldLabel}>City</Text>
          <TouchableOpacity
            style={styles.selectDropdown}
            onPress={() => setCurrentStep('CITY_SELECT')}
          >
            <Text style={styles.selectDropdownText}>{selectedCity}</Text>
            <Ionicons name="caret-down" size={16} color="#64748B" />
          </TouchableOpacity>

          {/* Society Field */}
          <View style={styles.labelWithActionRow}>
            <Text style={styles.fieldLabel}>Society</Text>
            <TouchableOpacity onPress={fetchSocieties} disabled={loadingSocieties}>
              {loadingSocieties ? (
                <ActivityIndicator size="small" color="#0284C7" />
              ) : (
                <Text style={styles.refreshText}>Refresh</Text>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.selectDropdown}
            onPress={() => setSocietyModalVisible(true)}
          >
            <Text style={styles.selectDropdownText}>{selectedSociety}</Text>
            <Ionicons name="caret-down" size={16} color="#64748B" />
          </TouchableOpacity>

          {/* Select Building Header */}
          <Text style={styles.sectionHeading}>SELECT BUILDING</Text>

          {/* Building list items */}
          <View style={styles.buildingList}>
            {DEFAULT_BUILDINGS.map((building) => (
              <TouchableOpacity
                key={building}
                style={styles.buildingListItem}
                onPress={() => {
                  setSelectedBuilding(building);
                  setCurrentStep('FLAT_SELECT');
                }}
              >
                <View style={styles.buildingItemLeft}>
                  <Ionicons name="business-outline" size={22} color="#475569" />
                  <Text style={styles.buildingItemText}>{building}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>

          {onGoToLogin ? (
            <TouchableOpacity style={styles.loginLinkWrap} onPress={onGoToLogin}>
              <Text style={styles.loginLinkText}>
                Already registered? <Text style={styles.loginLinkBold}>Sign In here</Text>
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        {/* Society Picker Modal */}
        <Modal visible={societyModalVisible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSocietyModalVisible(false)}
          >
            <View style={styles.modalSheet}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Select Society</Text>
                <TouchableOpacity onPress={fetchSocieties}>
                  <Text style={styles.refreshText}>Refresh Societies</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={societiesList}
                keyExtractor={(item, index) => item.id || `${item.name}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedSociety(item.name);
                      setSelectedPropertyId(item.id || null);
                      if (item.city) setSelectedCity(item.city);
                      setSocietyModalVisible(false);
                    }}
                  >
                    <View>
                      <Text style={styles.modalItemText}>{item.name}</Text>
                      {item.city ? <Text style={styles.modalItemSubtext}>{item.city}</Text> : null}
                    </View>
                    {selectedSociety === item.name ? (
                      <Ionicons name="checkmark" size={20} color="#0284C7" />
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 5, 6, 7: ADD HOME DETAILS & RENTAL AGREEMENT
  // -------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setCurrentStep('FLAT_SELECT')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Home</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* Summary Dropdowns */}
          <Text style={styles.fieldLabel}>Country</Text>
          <TouchableOpacity style={styles.selectDropdown} onPress={() => setCurrentStep('COUNTRY_SELECT')}>
            <Text style={styles.selectDropdownText}>{selectedCountry}</Text>
            <Ionicons name="caret-down" size={16} color="#64748B" />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>City</Text>
          <TouchableOpacity style={styles.selectDropdown} onPress={() => setCurrentStep('CITY_SELECT')}>
            <Text style={styles.selectDropdownText}>{selectedCity}</Text>
            <Ionicons name="caret-down" size={16} color="#64748B" />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Society</Text>
          <TouchableOpacity style={styles.selectDropdown} onPress={() => setSocietyModalVisible(true)}>
            <Text style={styles.selectDropdownText}>{selectedSociety}</Text>
            <Ionicons name="caret-down" size={16} color="#64748B" />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Building</Text>
          <TouchableOpacity style={styles.selectDropdown} onPress={() => setCurrentStep('ADD_HOME_BUILDING')}>
            <Text style={styles.selectDropdownText}>{selectedBuilding.replace(/^Block\s*/i, '')}</Text>
            <Ionicons name="caret-down" size={16} color="#64748B" />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Flat No.</Text>
          <TouchableOpacity style={styles.selectDropdown} onPress={() => setCurrentStep('FLAT_SELECT')}>
            <Text style={styles.selectDropdownText}>{selectedFlat}</Text>
            <Ionicons name="caret-down" size={16} color="#64748B" />
          </TouchableOpacity>

          {/* You are: Owner / Tenant */}
          <Text style={styles.fieldLabel}>You are</Text>
          <View style={styles.roleToggleContainer}>
            <TouchableOpacity
              style={[
                styles.roleToggleBtn,
                residentRole === 'Owner' && styles.roleToggleBtnActive,
              ]}
              onPress={() => setResidentRole('Owner')}
            >
              <Text
                style={[
                  styles.roleToggleText,
                  residentRole === 'Owner' && styles.roleToggleTextActive,
                ]}
              >
                Owner
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleToggleBtn,
                residentRole === 'Tenant' && styles.roleToggleBtnActive,
              ]}
              onPress={() => setResidentRole('Tenant')}
            >
              <Text
                style={[
                  styles.roleToggleText,
                  residentRole === 'Tenant' && styles.roleToggleTextActive,
                ]}
              >
                Tenant
              </Text>
            </TouchableOpacity>
          </View>

          {/* Subtype radio options for Tenant */}
          {residentRole === 'Tenant' ? (
            <View style={styles.subTypeContainer}>
              <TouchableOpacity
                style={styles.radioRow}
                onPress={() => setTenantSubtype('Tenant')}
              >
                <View style={styles.radioOuter}>
                  {tenantSubtype === 'Tenant' ? <View style={styles.radioInner} /> : null}
                </View>
                <View style={styles.radioContent}>
                  <Text style={styles.radioTitle}>Tenant</Text>
                  <Text style={styles.radioDesc}>You are the primary registered tenant of the flat.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioRow}
                onPress={() => setTenantSubtype('Family member of the tenant')}
              >
                <View style={styles.radioOuter}>
                  {tenantSubtype === 'Family member of the tenant' ? <View style={styles.radioInner} /> : null}
                </View>
                <View style={styles.radioContent}>
                  <Text style={styles.radioTitle}>Family member of the tenant</Text>
                  <Text style={styles.radioDesc}>You are a family member of a registered tenant.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioRow}
                onPress={() => setTenantSubtype('Renting with other flatmates')}
              >
                <View style={styles.radioOuter}>
                  {tenantSubtype === 'Renting with other flatmates' ? <View style={styles.radioInner} /> : null}
                </View>
                <View style={styles.radioContent}>
                  <Text style={styles.radioTitle}>Renting with other flatmates</Text>
                  <Text style={styles.radioDesc}>You share the flat with other registered tenants.</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Occupancy Status */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Occupancy Status</Text>
          <View style={styles.subTypeContainer}>
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => setOccupancyStatus('Currently residing')}
            >
              <View style={styles.radioOuter}>
                {occupancyStatus === 'Currently residing' ? <View style={styles.radioInner} /> : null}
              </View>
              <View style={styles.radioContent}>
                <Text style={styles.radioTitle}>Currently residing</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => setOccupancyStatus('Moving in')}
            >
              <View style={styles.radioOuter}>
                {occupancyStatus === 'Moving in' ? <View style={styles.radioInner} /> : null}
              </View>
              <View style={styles.radioContent}>
                <Text style={styles.radioTitle}>Moving in</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Resident Profile Details */}
          <Text style={[styles.sectionHeading, { marginTop: 24 }]}>RESIDENT DETAILS</Text>
          
          <Text style={styles.fieldLabel}>FULL NAME *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. John Doe"
            placeholderTextColor="#94A3B8"
            value={fullName}
            onChangeText={setFullName}
          />

          {!isAuthenticated ? (
            <>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. resident@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.fieldLabel}>CREATE PASSWORD *</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordTextInput}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIconBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>PHONE NUMBER (OPTIONAL)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="+91 98765 43210"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          {/* Rental Agreement / Document Upload */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Rental Agreement</Text>
          <Text style={styles.uploadSubtext}>
            The document/s will help the admin to quickly verify and approve the request.
          </Text>

          <TouchableOpacity style={styles.uploadDocButton} onPress={handlePickDocument}>
            <Ionicons name="document-text-outline" size={20} color="#1E293B" />
            <Text style={styles.uploadDocText}>
              {attachedDoc ? attachedDoc.name : 'Upload File/ document'}
            </Text>
            {attachedDoc ? (
              <TouchableOpacity onPress={() => setAttachedDoc(null)}>
                <Ionicons name="close-circle" size={18} color="#EF4444" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>

          {/* Submit Action Button */}
          <TouchableOpacity
            style={[styles.addHomeButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.addHomeButtonText}>Add Flat/Villa</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#0F172A',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listItemText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '400',
  },
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cityGridItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 14,
  },
  cityGridItemSelected: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
  },
  cityIconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cityName: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    textAlign: 'center',
  },
  cityListContainer: {
    paddingBottom: 24,
  },
  labelWithActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },
  refreshText: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  selectDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  selectDropdownText: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  buildingList: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  buildingListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  buildingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  buildingItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  flatSearchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    paddingHorizontal: 10,
  },
  flatSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#0F172A',
  },
  flatSectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  flatSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  flatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  flatItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  flatItemNumber: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  roleToggleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  roleToggleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  roleToggleBtnActive: {
    borderColor: '#0284C7',
    borderWidth: 1.5,
    backgroundColor: '#F0F9FF',
  },
  roleToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  roleToggleTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  subTypeContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0284C7',
  },
  radioContent: {
    flex: 1,
  },
  radioTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  radioDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  scrollContentContainer: {
    paddingBottom: 140,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    paddingRight: 10,
  },
  passwordTextInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
  },
  eyeIconBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 18,
  },
  uploadDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 20,
  },
  uploadDocText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    textDecorationLine: 'underline',
    marginLeft: 8,
  },
  addHomeButton: {
    backgroundColor: '#FFD200',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  addHomeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  loginLinkWrap: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 30,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#64748B',
  },
  loginLinkBold: {
    fontWeight: '700',
    color: '#0284C7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '65%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalItemText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '600',
  },
  modalItemSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
});
