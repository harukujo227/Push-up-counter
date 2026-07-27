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

/**
 * Place shoulder / elbow / wrist so the measured elbow angle matches `targetElbowAngle`.
 * The old heuristic only reached ~135° at the bottom, so the rep state machine never
 * reached `bottom_position` and the count stayed at 0.
 */
function buildLandmarks(targetElbowAngle: number): PoseLandmark[] {
  const landmarks = emptyLandmarks();

  const shoulder = point(0.3, 0.28);
  const elbow = point(0.34, 0.4);
  const forearmLen = 0.16;

  // Vector elbow → shoulder; rotate by the target interior elbow angle for elbow → wrist.
  const upperAngle = Math.atan2(
    shoulder.y - elbow.y,
    shoulder.x - elbow.x,
  );
  const interiorRad = (targetElbowAngle * Math.PI) / 180;
  const forearmAngle = upperAngle - interiorRad;

  const wrist = point(
    elbow.x + Math.cos(forearmAngle) * forearmLen,
    elbow.y + Math.sin(forearmAngle) * forearmLen,
  );

  // Keep opposite-side landmarks near the primary side so side-view angles
  // look like a plank (shoulderAngle ≈ hipAngle ≈ 180°).
  const hip = point(0.32, 0.52);
  const knee = point(0.33, 0.64);
  const ankle = point(0.34, 0.78);
  const oppositeShoulder = point(
    shoulder.x - (elbow.x - shoulder.x) * 0.9,
    shoulder.y - (elbow.y - shoulder.y) * 0.9,
    0.35,
  );

  landmarks[POSE_LANDMARK.NOSE] = point(0.38, 0.16);
  landmarks[POSE_LANDMARK.LEFT_SHOULDER] = shoulder;
  landmarks[POSE_LANDMARK.RIGHT_SHOULDER] = oppositeShoulder;
  landmarks[POSE_LANDMARK.LEFT_ELBOW] = elbow;
  landmarks[POSE_LANDMARK.RIGHT_ELBOW] = point(elbow.x + 0.04, elbow.y + 0.01, 0.25);
  landmarks[POSE_LANDMARK.LEFT_WRIST] = wrist;
  landmarks[POSE_LANDMARK.RIGHT_WRIST] = point(wrist.x + 0.04, wrist.y + 0.01, 0.25);
  landmarks[POSE_LANDMARK.LEFT_HIP] = hip;
  landmarks[POSE_LANDMARK.RIGHT_HIP] = point(hip.x + 0.03, hip.y + 0.01, 0.4);
  landmarks[POSE_LANDMARK.LEFT_KNEE] = knee;
  landmarks[POSE_LANDMARK.RIGHT_KNEE] = point(knee.x + 0.03, knee.y + 0.01, 0.3);
  landmarks[POSE_LANDMARK.LEFT_ANKLE] = ankle;
  landmarks[POSE_LANDMARK.RIGHT_ANKLE] = point(ankle.x + 0.03, ankle.y + 0.01, 0.3);

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
