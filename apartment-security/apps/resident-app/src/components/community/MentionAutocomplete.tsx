import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { CommunityMember } from '../../context/CommunityContext';

export default function MentionAutocomplete({
  query,
  members,
  onSelect,
}: {
  query: string;
  members: CommunityMember[];
  onSelect: (member: CommunityMember) => void;
}) {
  const filtered = members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  if (filtered.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => onSelect(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              {!!item.unit && <Text style={styles.unit}>{item.unit}</Text>}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 220,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  name: { fontSize: 14, color: colors.text, fontWeight: '600' },
  unit: { fontSize: 12, color: colors.textMuted },
});
