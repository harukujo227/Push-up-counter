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
import {
  usePoseDetection,
  RunningMode,
} from 'react-native-mediapipe-posedetection';
import { usePushUpDetection } from '../hooks/usePushUpDetection';
import type { PoseLandmark } from '../detection';
import { PoseOverlay } from './PoseOverlay';
import { WorkoutSessionOverlay } from './WorkoutSessionOverlay';

interface NativeWorkoutCameraProps {
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

export function NativeWorkoutCamera({ showDebug = false }: NativeWorkoutCameraProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [sessionActive, setSessionActive] = useState(false);
  const [detectorError, setDetectorError] = useState<string | null>(null);

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
      onError: (error) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: string }).message)
            : 'Pose detector failed';
        setDetectorError(message);
        setSessionActive(false);
      },
    },
    RunningMode.LIVE_STREAM,
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
    if (detectorError) return `Pose detection error: ${detectorError}`;
    if (!hasPermission) return 'Camera permission required';
    if (!device) return 'No camera device found';
    return null;
  }, [detectorError, device, hasPermission]);

  if (statusText) {
    return (
      <View style={styles.centered}>
        <Text style={styles.statusText}>{statusText}</Text>
        {!hasPermission && !detectorError ? (
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant camera access</Text>
          </Pressable>
        ) : detectorError ? null : (
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
        onLayout={poseDetection.cameraViewLayoutChangeHandler}
      />

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
  button: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 160,
    alignItems: 'center',
    backgroundColor: '#4ade80',
    marginTop: 16,
  },
  buttonText: {
    color: '#0a0a0f',
    fontSize: 16,
    fontWeight: '800',
  },
});
