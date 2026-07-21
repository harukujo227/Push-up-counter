import { POSE_LANDMARK } from './landmarks';
import type { PoseLandmark } from './types';

export function angleBetweenPoints(
  a: PoseLandmark,
  b: PoseLandmark,
  c: PoseLandmark,
): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const ac = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * ac.x + ab.y * ac.y;
  const magAb = Math.hypot(ab.x, ab.y);
  const magAc = Math.hypot(ac.x, ac.y);
  if (magAb === 0 || magAc === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magAb * magAc)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function averageLandmark(
  left: PoseLandmark,
  right: PoseLandmark,
): PoseLandmark {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: (left.z + right.z) / 2,
    visibility: ((left.visibility ?? 1) + (right.visibility ?? 1)) / 2,
  };
}

export function pickSideLandmarks(landmarks: PoseLandmark[]) {
  const leftElbowVis =
    landmarks[POSE_LANDMARK.LEFT_ELBOW]?.visibility ?? 0;
  const rightElbowVis =
    landmarks[POSE_LANDMARK.RIGHT_ELBOW]?.visibility ?? 0;
  const useLeft = leftElbowVis >= rightElbowVis;

  const shoulder = useLeft
    ? landmarks[POSE_LANDMARK.LEFT_SHOULDER]
    : landmarks[POSE_LANDMARK.RIGHT_SHOULDER];
  const elbow = useLeft
    ? landmarks[POSE_LANDMARK.LEFT_ELBOW]
    : landmarks[POSE_LANDMARK.RIGHT_ELBOW];
  const wrist = useLeft
    ? landmarks[POSE_LANDMARK.LEFT_WRIST]
    : landmarks[POSE_LANDMARK.RIGHT_WRIST];
  const hip = useLeft
    ? landmarks[POSE_LANDMARK.LEFT_HIP]
    : landmarks[POSE_LANDMARK.RIGHT_HIP];
  const ankle = useLeft
    ? landmarks[POSE_LANDMARK.LEFT_ANKLE]
    : landmarks[POSE_LANDMARK.RIGHT_ANKLE];
  const oppositeShoulder = useLeft
    ? landmarks[POSE_LANDMARK.RIGHT_SHOULDER]
    : landmarks[POSE_LANDMARK.LEFT_SHOULDER];
  const oppositeHip = useLeft
    ? landmarks[POSE_LANDMARK.RIGHT_HIP]
    : landmarks[POSE_LANDMARK.LEFT_HIP];

  return {
    shoulder,
    elbow,
    wrist,
    hip,
    ankle,
    oppositeShoulder,
    oppositeHip,
    side: useLeft ? ('left' as const) : ('right' as const),
  };
}

export function computeAverageConfidence(landmarks: PoseLandmark[]): number {
  const values = landmarks
    .map((landmark) => landmark.visibility ?? 1)
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function scoreFromRange(
  value: number,
  ideal: number,
  tolerance: number,
): number {
  const delta = Math.abs(value - ideal);
  return clamp(1 - delta / tolerance, 0, 1);
}
