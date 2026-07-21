import { StyleSheet, Text, View } from 'react-native';
import type { PushUpPhase } from '../detection';

interface RepCounterProps {
  count: number;
  phase: PushUpPhase;
  formScore: number;
  poseVisible: boolean;
}

const PHASE_LABELS: Record<PushUpPhase, string> = {
  waiting: 'Get in position',
  start_position: 'Top — arms extended',
  moving_down: 'Going down…',
  bottom_position: 'Bottom — push up!',
  moving_up: 'Coming up…',
  rep_completed: 'Rep complete!',
};

export function RepCounter({ count, phase, formScore, poseVisible }: RepCounterProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>REPS</Text>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.phase}>{poseVisible ? PHASE_LABELS[phase] : 'No pose detected'}</Text>
      <View style={styles.formRow}>
        <Text style={styles.formLabel}>Form</Text>
        <View style={styles.formBarTrack}>
          <View style={[styles.formBarFill, { width: `${Math.round(formScore * 100)}%` }]} />
        </View>
        <Text style={styles.formValue}>{Math.round(formScore * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(10, 10, 15, 0.82)',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  label: {
    color: '#8b8b9e',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  count: {
    color: '#ffffff',
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 78,
    marginTop: 4,
  },
  phase: {
    color: '#c8c8d4',
    fontSize: 15,
    marginTop: 4,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  formLabel: {
    color: '#8b8b9e',
    fontSize: 12,
    width: 36,
  },
  formBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  formBarFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 999,
  },
  formValue: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
});
