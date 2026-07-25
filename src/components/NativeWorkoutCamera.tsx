import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
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
  type Orientation,
} from 'react-native-vision-camera';
import {
  usePoseDetection,
  RunningMode,
  Delegate,
  type ViewCoordinator,
} from 'react-native-mediapipe-posedetection';
import { usePushUpDetection } from '../hooks/usePushUpDetection';
import type { PoseLandmark } from '../detection';
import { PoseOverlay } from './PoseOverlay';
import { WorkoutSessionOverlay } from './WorkoutSessionOverlay';

/** Degrees to rotate preview so the stream appears upright. */
function previewRotationDegrees(
  previewOrientation: Orientation,
  uiRotation: number,
): number {
  switch (previewOrientation) {
    case 'portrait-upside-down':
      return 180;
    case 'landscape-left':
      return 90;
    case 'landscape-right':
      return 270;
    default: {
      const normalized = ((Math.round(uiRotation / 90) * 90) % 360 + 360) % 360;
      if (normalized !== 0) return normalized;
      // Many Android devices/emulators deliver a visually inverted buffer while
      // still reporting portrait. Correct it so preview + pose stay upright.
      return Platform.OS === 'android' ? 180 : 0;
    }
  }
}

interface NativeWorkoutCameraProps {
  showDebug?: boolean;
  onUnavailable?: (reason: string) => void;
}

type RawLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
};

/**
 * Native MediaPipe events look like:
 *   { results: [{ landmarks: [ PoseLandmark[] ] }], inputImageWidth, ... }
 * (not a flat `landmarks` field — the package README is outdated).
 */
function extractFirstPose(
  bundle: {
    results?: Array<{ landmarks?: RawLandmark[][] }>;
    landmarks?: RawLandmark[][];
  } | null | undefined,
): RawLandmark[] | null {
  const nested = bundle?.results?.[0]?.landmarks?.[0];
  if (nested && nested.length > 0) return nested;

  // Fallback for older / docs-shaped payloads
  const flat = bundle?.landmarks?.[0];
  if (flat && flat.length > 0) return flat;

  return null;
}

function mapMediaPipeLandmarks(raw: RawLandmark[]): PoseLandmark[] {
  return raw.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z ?? 0,
    visibility: point.visibility ?? point.presence ?? 1,
  }));
}

function projectLandmarksForOverlay(
  raw: RawLandmark[],
  viewCoordinator: ViewCoordinator,
  frameDims: { width: number; height: number },
  viewDims: { width: number; height: number },
): PoseLandmark[] {
  if (viewDims.width <= 0 || viewDims.height <= 0) {
    return mapMediaPipeLandmarks(raw);
  }

  return raw.map((point) => {
    const projected = viewCoordinator.convertPoint(frameDims, {
      x: point.x,
      y: point.y,
    });
    return {
      x: projected.x / viewDims.width,
      y: projected.y / viewDims.height,
      z: point.z ?? 0,
      visibility: point.visibility ?? point.presence ?? 1,
    };
  });
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
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const [sessionActive, setSessionActive] = useState(false);
  const [detectorError, setDetectorError] = useState<string | null>(null);
  const [previewOrientation, setPreviewOrientation] =
    useState<Orientation>('portrait');
  const [uiRotation, setUiRotation] = useState(0);

  const previewRotateDeg = previewRotationDegrees(previewOrientation, uiRotation);
  const previewTransformStyle = useMemo(
    () =>
      previewRotateDeg === 0
        ? null
        : { transform: [{ rotate: `${previewRotateDeg}deg` as const }] },
    [previewRotateDeg],
  );

  const {
    state,
    landmarks,
    lastFeedback,
    processLandmarks,
    reset,
    startSession,
    endSession,
  } = usePushUpDetection({
    persistToSupabase: true,
    // Slightly looser than defaults — phone cameras foreshorten elbow angles.
    config: {
      minConfidence: 0.35,
      elbowTopAngle: 145,
      elbowBottomAngle: 105,
      minBodyStraightness: 135,
      hysteresisDegrees: 12,
      formScoreThreshold: 0.45,
    },
  });

  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  const poseCallbacks = useMemo(
    () => ({
      onResults: (
        bundle: {
          results?: Array<{ landmarks?: RawLandmark[][] }>;
          landmarks?: RawLandmark[][];
          inputImageWidth?: number;
          inputImageHeight?: number;
        },
        viewCoordinator: ViewCoordinator,
      ) => {
        const firstPose = extractFirstPose(bundle);
        if (!firstPose) return;

        // Detection uses image-normalized landmarks (angles are view-independent).
        const detectionLandmarks = mapMediaPipeLandmarks(firstPose);

        // Overlay uses view-projected coords so the skeleton lines up with the preview.
        const currentLayout = layoutRef.current;
        let overlayLandmarks = detectionLandmarks;
        if (currentLayout.width > 0 && currentLayout.height > 0) {
          const frameDims = viewCoordinator.getFrameDims({
            inferenceTime: 0,
            inputImageWidth: bundle.inputImageWidth ?? 1,
            inputImageHeight: bundle.inputImageHeight ?? 1,
          });
          overlayLandmarks = projectLandmarksForOverlay(
            firstPose,
            viewCoordinator,
            frameDims,
            currentLayout,
          );
        }

        processLandmarks(detectionLandmarks, overlayLandmarks);
      },
      onError: (error: { message?: string }) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String(error.message)
            : 'Pose detector failed';
        setDetectorError(message);
        setSessionActive(false);
        onUnavailableRef.current?.(message);
      },
    }),
    [processLandmarks],
  );

  // When we apply a 180° preview correction, treat both camera and output as
  // upside-down so MediaPipe rotates frames for inference and the overlay
  // projection stays identity (landmarks already match the upright preview).
  const forceOrientation =
    previewRotateDeg === 180 ? ('portrait-upside-down' as const) : undefined;

  // CPU avoids GPU-thread crashes on many Android devices; pass MediaPipe's
  // frameProcessor directly (do not wrap/call it — it is not a function).
  const poseDetection = usePoseDetection(
    poseCallbacks,
    RunningMode.LIVE_STREAM,
    'pose_landmarker_lite.task',
    {
      delegate: Delegate.CPU,
      fpsMode: 15,
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
      forceOutputOrientation: forceOrientation,
      forceCameraOrientation: forceOrientation,
    },
  );

  useEffect(() => {
    if (device) {
      poseDetection.cameraDeviceChangeHandler(device);
    }
  }, [device, poseDetection.cameraDeviceChangeHandler]);

  useEffect(() => {
    poseDetection.resizeModeChangeHandler('cover');
  }, [poseDetection.resizeModeChangeHandler]);

  const onRootLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

  const onCameraLayout = useCallback(
    (event: LayoutChangeEvent) => {
      poseDetection.cameraViewLayoutChangeHandler(event);
      const { width, height } = event.nativeEvent.layout;
      setLayout({ width, height });
    },
    [poseDetection],
  );

  const onPreviewOrientationChanged = useCallback(
    (orientation: Orientation) => {
      setPreviewOrientation(orientation);
      poseDetection.cameraOrientationChangedHandler(orientation);
    },
    [poseDetection],
  );

  const onOutputOrientationChanged = useCallback(
    (orientation: Orientation) => {
      poseDetection.cameraOrientationChangedHandler(orientation);
    },
    [poseDetection],
  );

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
    <View style={styles.root} onLayout={onRootLayout}>
      {/* TextureView + optional rotate fixes inverted Android previews.
          Keep PoseOverlay outside so session UI coords stay upright; MediaPipe
          forceOrientation keeps skeleton aligned with the corrected preview. */}
      <View style={[StyleSheet.absoluteFill, previewTransformStyle]} pointerEvents="none">
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={sessionActive}
          pixelFormat="rgb"
          resizeMode="cover"
          androidPreviewViewType="texture-view"
          outputOrientation="preview"
          frameProcessor={sessionActive ? poseDetection.frameProcessor : undefined}
          onLayout={onCameraLayout}
          onOutputOrientationChanged={onOutputOrientationChanged}
          onPreviewOrientationChanged={onPreviewOrientationChanged}
          onUIRotationChanged={setUiRotation}
        />
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
