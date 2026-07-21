import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { shouldUseMockPose } from '../utils/shouldUseMockPose';
import { AppErrorBoundary } from './AppErrorBoundary';
import { EmulatorWorkoutCamera } from './EmulatorWorkoutCamera';

export interface WorkoutCameraProps {
  showDebug?: boolean;
}

type NativeCameraComponent = typeof import('./NativeWorkoutCamera').NativeWorkoutCamera;

export function WorkoutCamera(props: WorkoutCameraProps) {
  const [useMock, setUseMock] = useState(shouldUseMockPose());
  const [NativeWorkoutCamera, setNativeWorkoutCamera] = useState<NativeCameraComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      </View>
    );
  }

  return (
    <AppErrorBoundary fallbackTitle="Camera failed to start">
      <NativeWorkoutCamera {...props} />
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
  },
  loadingText: {
    color: '#8b8b9e',
    fontSize: 14,
  },
});
