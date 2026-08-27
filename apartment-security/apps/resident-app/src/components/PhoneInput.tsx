import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { COUNTRIES, Country, flagEmoji } from '../utils/countryCodes';

type Props = {
  colors: any;
  digits: string;
  onChangeDigits: (digits: string) => void;
  country: Country;
  onChangeCountry: (country: Country) => void;
  placeholder?: string;
};

export default function PhoneInput({ colors, digits, onChangeDigits, country, onChangeCountry, placeholder }: Props) {
  const styles = getStyles(colors);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.dial.includes(q));
  }, [search]);

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.codeButton} onPress={() => setPickerOpen(true)}>
        <Text style={styles.flag}>{flagEmoji(country.iso2)}</Text>
        <Text style={styles.dial}>{country.dial}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.numberInput}
        placeholder={placeholder ?? 'Phone number'}
        keyboardType="phone-pad"
        value={digits}
        onChangeText={(t) => onChangeDigits(t.replace(/[^0-9]/g, ''))}
        placeholderTextColor="#9ca3af"
      />

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select country</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            placeholder="Search country or code"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9ca3af"
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.iso2}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.countryRow}
                onPress={() => { onChangeCountry(item); setPickerOpen(false); setSearch(''); }}
              >
                <Text style={styles.flag}>{flagEmoji(item.iso2)}</Text>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.dial}>{item.dial}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  flag: {
    fontSize: 18,
    marginRight: 6,
  },
  dial: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 4,
  },
  numberInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  modalClose: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  search: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    marginLeft: 4,
  },
});
