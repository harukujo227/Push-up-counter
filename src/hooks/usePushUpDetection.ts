import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PushUpDetector,
  type InvalidRepEvent,
  type PoseLandmark,
  type PushUpDetectorCallbacks,
  type PushUpDetectorConfig,
  type PushUpDetectorState,
  type RepEvent,
} from '../detection';
import { workoutService } from '../services/workoutService';

export interface UsePushUpDetectionOptions {
  config?: Partial<PushUpDetectorConfig>;
  persistToSupabase?: boolean;
  onRepCompleted?: (event: RepEvent) => void;
  onInvalidRep?: (event: InvalidRepEvent) => void;
}

export function usePushUpDetection(options: UsePushUpDetectionOptions = {}) {
  const [state, setState] = useState<PushUpDetectorState>({
    phase: 'waiting',
    repCount: 0,
    formScore: 0,
    lastMetrics: null,
    poseVisible: false,
  });
  const [landmarks, setLandmarks] = useState<PoseLandmark[]>([]);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const detectorRef = useRef<PushUpDetector | null>(null);

  const callbacks = useMemo<PushUpDetectorCallbacks>(
    () => ({
      onStateUpdate: setState,
      onRepCompleted: async (event) => {
        setLastFeedback('Good rep!');
        options.onRepCompleted?.(event);
        if (options.persistToSupabase !== false) {
          await workoutService.recordValidRep(event);
        }
      },
      onInvalidRep: async (event) => {
        setLastFeedback(event.reason);
        options.onInvalidRep?.(event);
        if (options.persistToSupabase !== false) {
          await workoutService.recordInvalidRep(event);
        }
      },
      onPoseLost: () => setLastFeedback('Move into frame — side view works best.'),
      onPoseFound: () => setLastFeedback(null),
    }),
    [options],
  );

  useEffect(() => {
    detectorRef.current = new PushUpDetector(callbacks, options.config);
    return () => {
      detectorRef.current = null;
    };
  }, [callbacks, options.config]);

  const processLandmarks = useCallback((nextLandmarks: PoseLandmark[]) => {
    setLandmarks(nextLandmarks);
    detectorRef.current?.processFrame(nextLandmarks, Date.now());
  }, []);

  const reset = useCallback(() => {
    detectorRef.current?.reset();
    setLandmarks([]);
    setLastFeedback(null);
  }, []);

  const startSession = useCallback(async () => {
    if (options.persistToSupabase === false) return null;
    return workoutService.startSession();
  }, [options.persistToSupabase]);

  const endSession = useCallback(async () => {
    if (options.persistToSupabase === false) return null;
    return workoutService.endSession();
  }, [options.persistToSupabase]);

  return {
    state,
    landmarks,
    lastFeedback,
    processLandmarks,
    reset,
    startSession,
    endSession,
  };
}
