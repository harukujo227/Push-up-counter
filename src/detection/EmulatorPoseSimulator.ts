import { POSE_LANDMARK } from './landmarks';
import type { PoseLandmark } from './types';

function emptyLandmarks(): PoseLandmark[] {
  return Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));
}

function point(x: number, y: number, visibility = 0.95): PoseLandmark {
  return { x, y, z: 0, visibility };
}

function buildLandmarks(elbowAngle: number): PoseLandmark[] {
  const landmarks = emptyLandmarks();
  const depth = Math.max(0, Math.min(1, (165 - elbowAngle) / 80));

  const shoulder = point(0.34, 0.3);
  const wrist = point(0.38, 0.58);
  const elbow = point(0.35 + depth * 0.08, 0.36 + depth * 0.14);
  const hip = point(0.36, 0.48);
  const knee = point(0.37, 0.62);
  const ankle = point(0.38, 0.76);

  landmarks[POSE_LANDMARK.NOSE] = point(0.4, 0.18);
  landmarks[POSE_LANDMARK.LEFT_SHOULDER] = shoulder;
  landmarks[POSE_LANDMARK.RIGHT_SHOULDER] = point(0.46, 0.31, 0.25);
  landmarks[POSE_LANDMARK.LEFT_ELBOW] = elbow;
  landmarks[POSE_LANDMARK.RIGHT_ELBOW] = point(0.5, 0.42, 0.2);
  landmarks[POSE_LANDMARK.LEFT_WRIST] = wrist;
  landmarks[POSE_LANDMARK.RIGHT_WRIST] = point(0.52, 0.56, 0.2);
  landmarks[POSE_LANDMARK.LEFT_HIP] = hip;
  landmarks[POSE_LANDMARK.RIGHT_HIP] = point(0.42, 0.49, 0.35);
  landmarks[POSE_LANDMARK.LEFT_KNEE] = knee;
  landmarks[POSE_LANDMARK.RIGHT_KNEE] = point(0.43, 0.63, 0.25);
  landmarks[POSE_LANDMARK.LEFT_ANKLE] = ankle;
  landmarks[POSE_LANDMARK.RIGHT_ANKLE] = point(0.44, 0.77, 0.25);

  return landmarks;
}

export class EmulatorPoseSimulator {
  private startTime = Date.now();
  private readonly repDurationMs: number;

  constructor(repDurationMs = 2800) {
    this.repDurationMs = repDurationMs;
  }

  reset(timestamp = Date.now()) {
    this.startTime = timestamp;
  }

  getLandmarks(timestamp = Date.now()): PoseLandmark[] {
    const elapsed = timestamp - this.startTime;
    const cycle = (elapsed % this.repDurationMs) / this.repDurationMs;
    const depth = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2;
    const elbowAngle = 165 - depth * 80;
    return buildLandmarks(elbowAngle);
  }
}
