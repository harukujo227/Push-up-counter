import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PushUpDetector,
  type InvalidRepEvent,
  type PoseLandmark,
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
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Keep config identity stable unless values actually change.
  const configKey = JSON.stringify(options.config ?? {});

  useEffect(() => {
    detectorRef.current = new PushUpDetector(
      {
        onStateUpdate: setState,
        onRepCompleted: async (event) => {
          setLastFeedback('Good rep!');
          optionsRef.current.onRepCompleted?.(event);
          if (optionsRef.current.persistToSupabase !== false) {
            await workoutService.recordValidRep(event);
          }
        },
        onInvalidRep: async (event) => {
          setLastFeedback(event.reason);
          optionsRef.current.onInvalidRep?.(event);
          if (optionsRef.current.persistToSupabase !== false) {
            await workoutService.recordInvalidRep(event);
          }
        },
        onPoseLost: () => setLastFeedback('Move into frame — side view works best.'),
        onPoseFound: () => setLastFeedback(null),
      },
      optionsRef.current.config,
    );
    return () => {
      detectorRef.current = null;
    };
  }, [configKey]);

  const processLandmarks = useCallback(
    (detectionLandmarks: PoseLandmark[], overlayLandmarks?: PoseLandmark[]) => {
      setLandmarks(overlayLandmarks ?? detectionLandmarks);
      detectorRef.current?.processFrame(detectionLandmarks, Date.now());
    },
    [],
  );

  const reset = useCallback(() => {
    detectorRef.current?.reset();
    setLandmarks([]);
    setLastFeedback(null);
  }, []);

  const startSession = useCallback(async () => {
    if (optionsRef.current.persistToSupabase === false) return null;
    return workoutService.startSession();
  }, []);

  const endSession = useCallback(async () => {
    if (optionsRef.current.persistToSupabase === false) return null;
    return workoutService.endSession();
  }, []);

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
