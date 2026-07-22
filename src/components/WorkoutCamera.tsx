import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getMockPoseReason, shouldUseMockPose } from '../utils/shouldUseMockPose';
import { AppErrorBoundary } from './AppErrorBoundary';
import { EmulatorWorkoutCamera } from './EmulatorWorkoutCamera';

export interface WorkoutCameraProps {
  showDebug?: boolean;
}

type NativeCameraComponent = typeof import('./NativeWorkoutCamera').NativeWorkoutCamera;

/**
 * On emulators / LDPlayer we always use EmulatorWorkoutCamera so "Start workout" works
 * without requesting the PC webcam (which crashes the app).
 */
export function WorkoutCamera(props: WorkoutCameraProps) {
  const [useMock, setUseMock] = useState(() => shouldUseMockPose());
  const [NativeWorkoutCamera, setNativeWorkoutCamera] = useState<NativeCameraComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(() => getMockPoseReason());

  const handleNativeUnavailable = useCallback((reason: string) => {
    setLoadError(reason);
    setUseMock(true);
    setNativeWorkoutCamera(null);
  }, []);

  useEffect(() => {
    // Re-evaluate once after mount in case Platform constants settle late.
    if (shouldUseMockPose()) {
      setUseMock(true);
      setLoadError(getMockPoseReason());
    }
  }, []);

  useEffect(() => {
    if (useMock) return;

    let cancelled = false;

    import('./NativeWorkoutCamera')
      .then((module) => {
        if (!cancelled) {
          setNativeWorkoutCamera(() => module.NativeWorkoutCamera);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Native camera unavailable';
          setLoadError(message);
          setUseMock(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [useMock]);

  if (useMock) {
    return <EmulatorWorkoutCamera {...props} nativeFallbackReason={loadError} />;
  }

  if (!NativeWorkoutCamera) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#4ade80" size="large" />
        <Text style={styles.loadingText}>Loading camera…</Text>
        <Text
          style={styles.fallbackLink}
          onPress={() =>
            handleNativeUnavailable('Switched to emulator test mode manually.')
          }
        >
          Use emulator test mode instead
        </Text>
      </View>
    );
  }

  return (
    <AppErrorBoundary fallbackTitle="Camera failed to start">
      <NativeWorkoutCamera {...props} onUnavailable={handleNativeUnavailable} />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0f',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#8b8b9e',
    fontSize: 14,
  },
  fallbackLink: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
});
