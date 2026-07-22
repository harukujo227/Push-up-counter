import { useCallback, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useMockPoseFeed } from '../hooks/useMockPoseFeed';
import { usePushUpDetection } from '../hooks/usePushUpDetection';
import { getPoseModeLabel } from '../utils/shouldUseMockPose';
import { PoseOverlay } from './PoseOverlay';
import { WorkoutSessionOverlay } from './WorkoutSessionOverlay';

interface EmulatorWorkoutCameraProps {
  showDebug?: boolean;
  nativeFallbackReason?: string | null;
}

export function EmulatorWorkoutCamera({
  showDebug = false,
  nativeFallbackReason = null,
}: EmulatorWorkoutCameraProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [sessionActive, setSessionActive] = useState(false);

  const {
    state,
    landmarks,
    lastFeedback,
    processLandmarks,
    reset,
    startSession,
    endSession,
  } = usePushUpDetection({ persistToSupabase: true });

  const { reset: resetSimulator } = useMockPoseFeed(sessionActive, processLandmarks);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

  const handleStart = useCallback(async () => {
    reset();
    resetSimulator();
    await startSession();
    setSessionActive(true);
  }, [reset, resetSimulator, startSession]);

  const handleStop = useCallback(async () => {
    await endSession();
    setSessionActive(false);
  }, [endSession]);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={styles.mockPreview}>
        <Text style={styles.mockTitle}>Simulated push-ups</Text>
        <Text style={styles.mockSubtitle}>
          {nativeFallbackReason
            ? nativeFallbackReason
            : 'Emulator test mode — no camera needed. Tap Start workout; reps count automatically.'}
        </Text>
      </View>

      <PoseOverlay
        landmarks={landmarks}
        width={layout.width}
        height={layout.height}
        visible={showDebug && sessionActive}
      />

      <WorkoutSessionOverlay
        repCount={state.repCount}
        phase={state.phase}
        formScore={state.formScore}
        poseVisible={state.poseVisible}
        lastFeedback={lastFeedback}
        lastMetrics={state.lastMetrics}
        showDebug={showDebug}
        sessionActive={sessionActive}
        modeLabel={getPoseModeLabel()}
        onStart={handleStart}
        onStop={handleStop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  mockPreview: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#11111a',
  },
  mockTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  mockSubtitle: {
    color: '#8b8b9e',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
