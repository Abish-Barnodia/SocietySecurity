import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useAuth } from '@apartment-security/shared-auth';
import { useCommunity, Poll } from '../../context/CommunityContext';

export default function PollCard({ poll, tint }: { poll: Poll; tint?: string }) {
  const { userId } = useAuth();
  const { votePoll } = useCommunity();

  const totalVotes = poll.options.reduce((sum, o) => sum + o.voterIds.length, 0);
  const accent = tint ?? colors.primary;

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{poll.question}</Text>
      {poll.options.map((option) => {
        const voted = !!userId && option.voterIds.includes(userId);
        const pct = totalVotes > 0 ? Math.round((option.voterIds.length / totalVotes) * 100) : 0;
        return (
          <TouchableOpacity key={option.id} style={styles.optionRow} onPress={() => votePoll(poll.id, option.id)}>
            <View style={styles.optionBarBackground}>
              <View style={[styles.optionBarFill, { width: `${pct}%`, backgroundColor: `${accent}33` }]} />
              <View style={styles.optionLabelRow}>
                <View style={styles.optionLabelLeft}>
                  {voted && <View style={[styles.checkDot, { backgroundColor: accent }]} />}
                  <Text style={styles.optionText} numberOfLines={2}>{option.text}</Text>
                </View>
                <Text style={styles.optionPct}>{pct}%</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={styles.footer}>
        {totalVotes} vote{totalVotes === 1 ? '' : 's'} · {poll.allowMultiple ? 'Multiple answers' : 'Single answer'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 220, maxWidth: 260 },
  question: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  optionRow: { marginBottom: 8 },
  optionBarBackground: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  optionBarFill: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  optionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionLabelLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 8 },
  checkDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  optionText: { fontSize: 13, color: colors.text, flexShrink: 1 },
  optionPct: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  footer: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
