import {
  angleBetweenPoints,
  averageLandmark,
  clamp,
  pickSideLandmarks,
  scoreFromRange,
} from './geometry';
import type {
  FormMetrics,
  FormValidationResult,
  PushUpDetectorConfig,
  PushUpPhase,
} from './types';

export class FormValidator {
  constructor(private readonly config: PushUpDetectorConfig) {}

  computeMetrics(landmarks: Parameters<typeof pickSideLandmarks>[0]): FormMetrics {
    const { shoulder, elbow, wrist, hip, ankle, oppositeShoulder, oppositeHip } =
      pickSideLandmarks(landmarks);

    const elbowAngle = angleBetweenPoints(shoulder, elbow, wrist);
    const shoulderAngle = angleBetweenPoints(oppositeShoulder, shoulder, elbow);
    const hipAngle = angleBetweenPoints(shoulder, hip, ankle);
    const bodyStraightness = angleBetweenPoints(shoulder, hip, ankle);

    const midShoulder = averageLandmark(
      landmarks[11] ?? shoulder,
      landmarks[12] ?? oppositeShoulder,
    );
    const midHip = averageLandmark(
      landmarks[23] ?? hip,
      landmarks[24] ?? oppositeHip,
    );
    const alignmentDelta = Math.abs(midShoulder.y - midHip.y);
    const depthScore = scoreFromRange(
      elbowAngle,
      this.config.elbowBottomAngle,
      45,
    );
    const extensionScore = scoreFromRange(
      elbowAngle,
      this.config.elbowTopAngle,
      25,
    );

    return {
      elbowAngle,
      shoulderAngle,
      hipAngle,
      bodyStraightness,
      depthScore: clamp(depthScore + (1 - alignmentDelta) * 0.2, 0, 1),
      extensionScore,
    };
  }

  validateAtPhase(
    landmarks: Parameters<typeof pickSideLandmarks>[0],
    phase: PushUpPhase,
  ): FormValidationResult {
    const metrics = this.computeMetrics(landmarks);
    const issues: string[] = [];

    if (metrics.bodyStraightness < this.config.minBodyStraightness) {
      issues.push('Keep your body straight from shoulders to ankles.');
    }

    if (Math.abs(metrics.shoulderAngle - metrics.hipAngle) > 35) {
      issues.push('Align shoulders and hips.');
    }

    // Depth is only meaningful at the bottom. Checking it during moving_up would
    // fail every rep once elbows extend again (topFormValid stayed false forever).
    if (phase === 'bottom_position') {
      if (metrics.elbowAngle > this.config.elbowBottomAngle + this.config.hysteresisDegrees) {
        issues.push('Go lower — chest should get closer to the floor.');
      }
    }

    if (phase === 'start_position' || phase === 'rep_completed') {
      if (metrics.elbowAngle < this.config.elbowTopAngle - this.config.hysteresisDegrees) {
        issues.push('Extend arms fully at the top.');
      }
    }

    const formScore = clamp(
      (metrics.depthScore +
        metrics.extensionScore +
        scoreFromRange(metrics.bodyStraightness, 175, 30)) /
        3,
      0,
      1,
    );

    return {
      isValid: issues.length === 0,
      issues,
      metrics,
    };
  }
}
