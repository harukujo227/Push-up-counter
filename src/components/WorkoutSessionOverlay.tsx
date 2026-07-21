import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FormFeedback } from './FormFeedback';
import { RepCounter } from './RepCounter';
import type { FormMetrics, PushUpPhase } from '../detection';

interface WorkoutSessionOverlayProps {
  repCount: number;
  phase: PushUpPhase;
  formScore: number;
  poseVisible: boolean;
  lastFeedback: string | null;
  lastMetrics: FormMetrics | null;
  showDebug: boolean;
  sessionActive: boolean;
  modeLabel?: string;
  onStart: () => void;
  onStop: () => void;
}

export function WorkoutSessionOverlay({
  repCount,
  phase,
  formScore,
  poseVisible,
  lastFeedback,
  lastMetrics,
  showDebug,
  sessionActive,
  modeLabel,
  onStart,
  onStop,
}: WorkoutSessionOverlayProps) {
  return (
    <View style={styles.overlay}>
      {modeLabel ? (
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>{modeLabel}</Text>
        </View>
      ) : null}

      <View style={styles.topRow}>
        <RepCounter
          count={repCount}
          phase={phase}
          formScore={formScore}
          poseVisible={poseVisible}
        />
      </View>

      <View style={styles.bottomRow}>
        <FormFeedback
          message={lastFeedback}
          metrics={lastMetrics}
          showDebug={showDebug}
        />

        <View style={styles.actions}>
          {!sessionActive ? (
            <Pressable style={[styles.button, styles.startButton]} onPress={onStart}>
              <Text style={styles.buttonText}>Start workout</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.button, styles.stopButton]} onPress={onStop}>
              <Text style={styles.buttonText}>Finish</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  modeBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderColor: 'rgba(251, 191, 36, 0.45)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modeBadgeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
  },
  topRow: {
    alignItems: 'center',
  },
  bottomRow: {
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 160,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4ade80',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#0a0a0f',
    fontSize: 16,
    fontWeight: '800',
  },
});
