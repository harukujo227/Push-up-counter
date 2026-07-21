# Push-Up Detection API

This document describes the public interface for integrating push-up detection into other screens or apps.

## PushUpDetector

Main entry point. Framework-agnostic TypeScript class — no React Native dependency.

### Constructor

```typescript
new PushUpDetector(callbacks?, config?)
```

### Methods

| Method | Description |
|--------|-------------|
| `processFrame(landmarks, timestamp)` | Feed one frame of 33 BlazePose landmarks |
| `getState()` | Current phase, rep count, form score |
| `reset()` | Clear reps and return to `waiting` |

### Callbacks

```typescript
interface PushUpDetectorCallbacks {
  onRepCompleted?: (event: RepEvent) => void;
  onInvalidRep?: (event: InvalidRepEvent) => void;
  onPoseLost?: () => void;
  onPoseFound?: () => void;
  onPhaseChange?: (phase: PushUpPhase) => void;
  onStateUpdate?: (state: PushUpDetectorState) => void;
}
```

#### RepEvent

```typescript
{
  repNumber: number;
  timestamp: number;
  formScore: number;      // 0–1
  metrics: FormMetrics;
}
```

#### InvalidRepEvent

```typescript
{
  timestamp: number;
  reason: string;
  phase: PushUpPhase;
  metrics: FormMetrics;
}
```

### State machine phases

1. **waiting** — No reliable pose or not in push-up position
2. **start_position** — Top of push-up, arms extended
3. **moving_down** — Elbows bending
4. **bottom_position** — Chest near floor, elbows bent
5. **moving_up** — Pushing back up
6. **rep_completed** — Full rep cycle finished (valid or invalid)

### Form metrics

```typescript
interface FormMetrics {
  elbowAngle: number;        // Shoulder–elbow–wrist (degrees)
  shoulderAngle: number;
  hipAngle: number;
  bodyStraightness: number;  // Shoulder–hip–ankle (degrees)
  depthScore: number;        // 0–1
  extensionScore: number;    // 0–1
}
```

### Config overrides

```typescript
const detector = new PushUpDetector(callbacks, {
  minConfidence: 0.55,
  elbowBottomAngle: 90,
  repCooldownMs: 1000,
});
```

## React hook: usePushUpDetection

Wraps `PushUpDetector` with React state and optional Supabase persistence.

```typescript
const {
  state,           // PushUpDetectorState
  landmarks,       // Latest smoothed landmarks
  lastFeedback,    // User-facing form message
  processLandmarks,
  reset,
  startSession,    // Creates Supabase workout_sessions row
  endSession,      // Closes session
} = usePushUpDetection({ persistToSupabase: true });
```

## Supabase schema

### workout_sessions

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| device_id | text | Anonymous device identifier |
| started_at | timestamptz | Session start |
| ended_at | timestamptz | Session end (null if active) |
| total_reps | int | Valid + invalid |
| valid_reps | int | Form-valid reps |
| invalid_reps | int | Rejected reps |
| average_form_score | numeric | Mean form score of valid reps |

### rep_records

| Column | Type | Description |
|--------|------|-------------|
| session_id | uuid | FK to workout_sessions |
| rep_number | int | Rep index |
| is_valid | boolean | Whether rep counted |
| form_score | numeric | 0–1 |
| invalid_reason | text | Null if valid |
| elbow_angle | numeric | Snapshot at rep |
| body_straightness | numeric | Snapshot at rep |

## Landmark indices (BlazePose)

Used by `src/detection/landmarks.ts`:

- 11/12 — left/right shoulder
- 13/14 — left/right elbow
- 15/16 — left/right wrist
- 23/24 — left/right hip
- 27/28 — left/right ankle

The detector automatically picks the side with higher elbow visibility.
