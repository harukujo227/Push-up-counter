import { useCallback, useEffect, useState } from 'react';
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
  useCameraDevices,
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
  onUnavailable?: (reason: string) => void;
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

/** Only mounts MediaPipe/VisionCamera after the user opts into camera mode. */
function ActiveNativeCamera({
  showDebug = false,
  onUnavailable,
}: NativeWorkoutCameraProps) {
  const devices = useCameraDevices();
  const frontDevice = useCameraDevice('front');
  const backDevice = useCameraDevice('back');
  const device = frontDevice ?? backDevice ?? devices[0] ?? null;

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
        onUnavailable?.(message);
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
    if (device) return;
    const timer = setTimeout(() => {
      onUnavailable?.('No usable camera found. Use emulator test mode on LDPlayer.');
    }, 1500);
    return () => clearTimeout(timer);
  }, [device, onUnavailable]);

  const handleStart = useCallback(async () => {
    reset();
    await startSession();
    setSessionActive(true);
  }, [reset, startSession]);

  const handleStop = useCallback(async () => {
    await endSession();
    setSessionActive(false);
  }, [endSession]);

  if (detectorError || !device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.statusText}>
          {detectorError ? `Pose detection error: ${detectorError}` : 'Looking for camera…'}
        </Text>
        {!detectorError ? <ActivityIndicator color="#4ade80" style={{ marginTop: 16 }} /> : null}
        {onUnavailable ? (
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => onUnavailable(detectorError ?? 'No camera device')}
          >
            <Text style={styles.secondaryButtonText}>Use emulator test mode</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
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

export function NativeWorkoutCamera({
  showDebug = false,
  onUnavailable,
}: NativeWorkoutCameraProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [wantsCamera, setWantsCamera] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const handleEnableCamera = useCallback(async () => {
    setRequesting(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        onUnavailable?.('Camera permission denied. Use emulator test mode instead.');
        return;
      }
      setWantsCamera(true);
    } catch (error) {
      onUnavailable?.(error instanceof Error ? error.message : 'Camera permission failed');
    } finally {
      setRequesting(false);
    }
  }, [onUnavailable, requestPermission]);

  if (hasPermission && wantsCamera) {
    return <ActiveNativeCamera showDebug={showDebug} onUnavailable={onUnavailable} />;
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Camera mode</Text>
      <Text style={styles.statusText}>
        On LDPlayer, do not use “Turn on Camera” (PC webcam) — it crashes the app. Use emulator
        test mode to try the workout flow.
      </Text>
      <Pressable
        style={[styles.button, requesting && styles.buttonDisabled]}
        onPress={handleEnableCamera}
        disabled={requesting}
      >
        <Text style={styles.buttonText}>
          {requesting ? 'Requesting…' : 'Enable phone camera'}
        </Text>
      </Pressable>
      {onUnavailable ? (
        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={() =>
            onUnavailable('Using emulator test mode. Tap Start workout for simulated reps.')
          }
        >
          <Text style={styles.secondaryButtonText}>Use emulator test mode</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0f',
    padding: 24,
    gap: 8,
  },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  statusText: {
    color: '#c8c8d4',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
    backgroundColor: '#4ade80',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#0a0a0f', fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.45)',
  },
  secondaryButtonText: { color: '#4ade80', fontSize: 14, fontWeight: '700' },
});
