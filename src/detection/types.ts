export type LandmarkIndex =
  | 0
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28;

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseFrame {
  landmarks: PoseLandmark[];
  timestamp: number;
  averageConfidence: number;
}

export type PushUpPhase =
  | 'waiting'
  | 'start_position'
  | 'moving_down'
  | 'bottom_position'
  | 'moving_up'
  | 'rep_completed';

export interface FormMetrics {
  elbowAngle: number;
  shoulderAngle: number;
  hipAngle: number;
  bodyStraightness: number;
  depthScore: number;
  extensionScore: number;
}

export interface FormValidationResult {
  isValid: boolean;
  issues: string[];
  metrics: FormMetrics;
}

export interface RepEvent {
  repNumber: number;
  timestamp: number;
  formScore: number;
  metrics: FormMetrics;
}

export interface InvalidRepEvent {
  timestamp: number;
  reason: string;
  phase: PushUpPhase;
  metrics: FormMetrics;
}

export interface PushUpDetectorState {
  phase: PushUpPhase;
  repCount: number;
  formScore: number;
  lastMetrics: FormMetrics | null;
  poseVisible: boolean;
}

export interface PushUpDetectorCallbacks {
  onRepCompleted?: (event: RepEvent) => void;
  onInvalidRep?: (event: InvalidRepEvent) => void;
  onPoseLost?: () => void;
  onPoseFound?: () => void;
  onPhaseChange?: (phase: PushUpPhase) => void;
  onStateUpdate?: (state: PushUpDetectorState) => void;
}

export interface PushUpDetectorConfig {
  minConfidence: number;
  smoothingWindow: number;
  elbowTopAngle: number;
  elbowBottomAngle: number;
  minBodyStraightness: number;
  minMovementDurationMs: number;
  repCooldownMs: number;
  hysteresisDegrees: number;
  formScoreThreshold: number;
}

export const DEFAULT_DETECTOR_CONFIG: PushUpDetectorConfig = {
  minConfidence: 0.5,
  smoothingWindow: 5,
  elbowTopAngle: 155,
  elbowBottomAngle: 95,
  minBodyStraightness: 150,
  minMovementDurationMs: 200,
  repCooldownMs: 800,
  hysteresisDegrees: 8,
  formScoreThreshold: 0.55,
};
