import { FormValidator } from './FormValidator';
import { PoseSmoother } from './PoseSmoother';
import type {
  InvalidRepEvent,
  PoseFrame,
  PushUpDetectorCallbacks,
  PushUpDetectorConfig,
  PushUpDetectorState,
  PushUpPhase,
  RepEvent,
} from './types';
import { DEFAULT_DETECTOR_CONFIG } from './types';

export class PushUpDetector {
  private readonly config: PushUpDetectorConfig;
  private readonly smoother: PoseSmoother;
  private readonly validator: FormValidator;
  private readonly callbacks: PushUpDetectorCallbacks;

  private phase: PushUpPhase = 'waiting';
  private repCount = 0;
  private poseVisible = false;
  private lastMetrics: PushUpDetectorState['lastMetrics'] = null;
  private phaseEnteredAt = 0;
  private lastRepAt = 0;
  private bottomFormValid = true;
  private topFormValid = true;

  constructor(
    callbacks: PushUpDetectorCallbacks = {},
    config: Partial<PushUpDetectorConfig> = {},
  ) {
    this.config = { ...DEFAULT_DETECTOR_CONFIG, ...config };
    this.callbacks = callbacks;
    this.smoother = new PoseSmoother(this.config.smoothingWindow);
    this.validator = new FormValidator(this.config);
  }

  reset() {
    this.phase = 'waiting';
    this.repCount = 0;
    this.poseVisible = false;
    this.lastMetrics = null;
    this.phaseEnteredAt = 0;
    this.lastRepAt = 0;
    this.bottomFormValid = true;
    this.topFormValid = true;
    this.smoother.reset();
    this.emitState();
  }

  processFrame(rawLandmarks: PoseFrame['landmarks'], timestamp: number) {
    const frame = this.smoother.toPoseFrame(rawLandmarks, timestamp);

    if (frame.averageConfidence < this.config.minConfidence) {
      if (this.poseVisible) {
        this.poseVisible = false;
        this.callbacks.onPoseLost?.();
      }
      this.setPhase('waiting');
      this.emitState();
      return;
    }

    if (!this.poseVisible) {
      this.poseVisible = true;
      this.callbacks.onPoseFound?.();
    }

    const validation = this.validator.validateAtPhase(frame.landmarks, this.phase);
    this.lastMetrics = validation.metrics;
    this.advanceState(validation.metrics, validation.isValid, timestamp);
    this.emitState();
  }

  getState(): PushUpDetectorState {
    return {
      phase: this.phase,
      repCount: this.repCount,
      formScore: this.computeFormScore(),
      lastMetrics: this.lastMetrics,
      poseVisible: this.poseVisible,
    };
  }

  private computeFormScore(): number {
    if (!this.lastMetrics) return 0;
    return (
      (this.lastMetrics.depthScore +
        this.lastMetrics.extensionScore +
        this.lastMetrics.bodyStraightness / 180) /
      3
    );
  }

  private advanceState(
    metrics: NonNullable<PushUpDetectorState['lastMetrics']>,
    formValid: boolean,
    timestamp: number,
  ) {
    const elbow = metrics.elbowAngle;
    const topThreshold = this.config.elbowTopAngle;
    const bottomThreshold = this.config.elbowBottomAngle;
    const h = this.config.hysteresisDegrees;

    switch (this.phase) {
      case 'waiting':
        if (elbow >= topThreshold - h) {
          this.setPhase('start_position', timestamp);
        }
        break;

      case 'start_position':
        if (elbow <= bottomThreshold + h) {
          if (this.hasMinDuration(timestamp)) {
            this.bottomFormValid = formValid;
            this.setPhase('bottom_position', timestamp);
          } else {
            this.setPhase('moving_down', timestamp);
          }
        } else if (elbow < topThreshold - h * 2) {
          this.setPhase('moving_down', timestamp);
        }
        break;

      case 'moving_down':
        if (elbow <= bottomThreshold + h) {
          this.bottomFormValid = formValid;
          this.setPhase('bottom_position', timestamp);
        }
        break;

      case 'bottom_position':
        if (elbow >= topThreshold - h) {
          if (this.hasMinDuration(timestamp)) {
            this.topFormValid = formValid;
            this.setPhase('rep_completed', timestamp);
            this.completeRep(timestamp, metrics);
          } else {
            this.setPhase('moving_up', timestamp);
          }
        } else if (elbow > bottomThreshold + h * 2) {
          this.setPhase('moving_up', timestamp);
        }
        break;

      case 'moving_up':
        if (elbow >= topThreshold - h) {
          this.topFormValid = formValid;
          this.setPhase('rep_completed', timestamp);
          this.completeRep(timestamp, metrics);
        }
        break;

      case 'rep_completed':
        if (timestamp - this.lastRepAt > this.config.repCooldownMs) {
          this.setPhase('start_position', timestamp);
        }
        break;

      default:
        break;
    }
  }

  private completeRep(
    timestamp: number,
    metrics: NonNullable<PushUpDetectorState['lastMetrics']>,
  ) {
    if (timestamp - this.lastRepAt < this.config.repCooldownMs) {
      return;
    }

    const formScore = this.computeFormScore();
    const isValidRep = this.bottomFormValid && this.topFormValid && formScore >= 0.55;

    if (isValidRep) {
      this.repCount += 1;
      const event: RepEvent = {
        repNumber: this.repCount,
        timestamp,
        formScore,
        metrics,
      };
      this.callbacks.onRepCompleted?.(event);
    } else {
      const reason = !this.bottomFormValid
        ? 'Insufficient depth at the bottom.'
        : !this.topFormValid
          ? 'Incomplete extension at the top.'
          : 'Form score below threshold.';
      const event: InvalidRepEvent = {
        timestamp,
        reason,
        phase: this.phase,
        metrics,
      };
      this.callbacks.onInvalidRep?.(event);
    }

    this.lastRepAt = timestamp;
    this.bottomFormValid = true;
    this.topFormValid = true;
  }

  private hasMinDuration(timestamp: number): boolean {
    return timestamp - this.phaseEnteredAt >= this.config.minMovementDurationMs;
  }

  private setPhase(phase: PushUpPhase, timestamp = Date.now()) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.phaseEnteredAt = timestamp;
    this.callbacks.onPhaseChange?.(phase);
  }

  private emitState() {
    this.callbacks.onStateUpdate?.(this.getState());
  }
}
