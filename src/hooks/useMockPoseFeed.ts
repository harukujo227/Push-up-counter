import { useCallback, useEffect, useRef, useState } from 'react';
import { EmulatorPoseSimulator } from '../detection/EmulatorPoseSimulator';
import type { PoseLandmark } from '../detection';

export function useMockPoseFeed(active: boolean, onFrame: (landmarks: PoseLandmark[]) => void) {
  const simulatorRef = useRef(new EmulatorPoseSimulator());
  const [tick, setTick] = useState(0);

  const reset = useCallback(() => {
    simulatorRef.current.reset();
    setTick(0);
  }, []);

  useEffect(() => {
    if (!active) return;

    simulatorRef.current.reset();
    const interval = setInterval(() => {
      const landmarks = simulatorRef.current.getLandmarks();
      onFrame(landmarks);
      setTick((value) => value + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [active, onFrame]);

  return { reset, tick };
}
