import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { usePoseDetection } from 'react-native-mediapipe-posedetection';
import { FormFeedback } from './FormFeedback';
import { PoseOverlay } from './PoseOverlay';
import { RepCounter } from './RepCounter';
import { usePushUpDetection } from '../hooks/usePushUpDetection';
import type { PoseLandmark } from '../detection';

interface WorkoutCameraProps {
  showDebug?: boolean;
}

function mapMediaPipeLandmarks(
  raw: Array<{ x: number; y: number; z?: number; visibility?: number; presence?: number }>,
): PoseLandmark[] {
  return raw.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z ?? 0,
    visibility: point.visibility ?? point.presence ?? 1,
  }));
}

export function WorkoutCamera({ showDebug = false }: WorkoutCameraProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
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

  const onLandmarks = useRunOnJS(processLandmarks, [processLandmarks]);

  const poseDetection = usePoseDetection(
    {
      onResults: (results) => {
        const firstPose = results?.landmarks?.[0];
        if (!firstPose) return;
        onLandmarks(mapMediaPipeLandmarks(firstPose));
      },
    },
    'LIVE_STREAM',
    'pose_landmarker_lite.task',
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      poseDetection.frameProcessor(frame);
    },
    [poseDetection.frameProcessor],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const handleStart = useCallback(async () => {
    reset();
    await startSession();
    setSessionActive(true);
  }, [reset, startSession]);

  const handleStop = useCallback(async () => {
    await endSession();
    setSessionActive(false);
  }, [endSession]);

  const statusText = useMemo(() => {
    if (!hasPermission) return 'Camera permission required';
    if (!device) return 'No camera device found';
    return null;
  }, [device, hasPermission]);

  if (statusText) {
    return (
      <View style={styles.centered}>
        <Text style={styles.statusText}>{statusText}</Text>
        {!hasPermission ? (
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant camera access</Text>
          </Pressable>
        ) : (
          <ActivityIndicator color="#4ade80" style={{ marginTop: 16 }} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device!}
        isActive={sessionActive}
        pixelFormat="rgb"
        frameProcessor={sessionActive ? frameProcessor : undefined}
      />

      <PoseOverlay
        landmarks={landmarks}
        width={layout.width}
        height={layout.height}
        visible={showDebug && sessionActive}
      />

      <View style={styles.overlay}>
        <View style={styles.topRow}>
          <RepCounter
            count={state.repCount}
            phase={state.phase}
            formScore={state.formScore}
            poseVisible={state.poseVisible}
          />
        </View>

        <View style={styles.bottomRow}>
          <FormFeedback
            message={lastFeedback}
            metrics={state.lastMetrics}
            showDebug={showDebug}
          />

          <View style={styles.actions}>
            {!sessionActive ? (
              <Pressable style={[styles.button, styles.startButton]} onPress={handleStart}>
                <Text style={styles.buttonText}>Start workout</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.button, styles.stopButton]} onPress={handleStop}>
                <Text style={styles.buttonText}>Finish</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0f',
    padding: 24,
  },
  statusText: {
    color: '#c8c8d4',
    fontSize: 16,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 56,
    paddingBottom: 40,
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
