# Push-Up Counter

React Native mobile app for real-time push-up detection, rep counting, and form validation. Uses **MediaPipe BlazePose** (33 landmarks) on-device via the camera, with **Supabase** for workout session storage.


## Features

- Real-time camera pose estimation (MediaPipe BlazePose, 33 landmarks)
- Push-up state machine: `waiting → start → down → bottom → up → rep completed`
- Form validation: elbow angle, shoulder/hip alignment, body straightness, depth, extension
- False-positive reduction: confidence filtering, smoothing, hysteresis, movement duration, rep cooldown
- Live rep counter with optional pose skeleton overlay
- Event API: `onRepCompleted`, `onInvalidRep`, `onPoseLost`, `onPhaseChange`
- Supabase sync for workout sessions and rep records

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native (Expo SDK 53), Expo Router |
| Pose detection | MediaPipe BlazePose via `react-native-mediapipe-posedetection` |
| Camera | `react-native-vision-camera` v4 |
| Backend | Supabase (PostgreSQL) |

## Prerequisites

- Node.js 20+ (install via [nvm-windows](https://github.com/coreybutler/nvm-windows) if needed)
- Android Studio and/or Xcode for device builds
- Supabase project (free tier works)
- Physical device recommended (camera + pose detection do not run well in simulators)

> **Note:** This app requires a **development build** (not Expo Go) because of native camera and MediaPipe modules. New Architecture must be enabled (already set in `app.json`).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Download the pose model

Download [pose_landmarker_lite.task](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task) into `assets/models/`.

### 3. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL in `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor
3. Copy `.env.example` to `.env` and set your credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Generate native projects and run

```bash
npx expo prebuild
npx expo run:android
# or
npx expo run:ios
```

### 5. Build a release APK

Release builds embed the JS bundle and `.env` values at build time.

```bash
# from project root
cd android
gradlew.bat assembleRelease
```

APK output:

`android/app/build/outputs/apk/release/app-release.apk`

Important for release:
- MediaPipe ships **arm64-v8a only**. On x86 emulators / 32-bit devices the app auto-uses mock mode so the release APK does not crash on open
- Use `EXPO_PUBLIC_MOCK_POSE=true` to force mock mode; leave empty for auto-detect on arm64 phones
- After changing `.env` or native deps, rebuild the release APK (Metro reload is not enough)
- Output: `android/app/build/outputs/apk/release/app-release.apk`

## Emulator testing

MediaPipe native libraries only support **arm64** phones. PC emulators like **LDPlayer**, BlueStacks, and Android Studio AVDs usually:

- run on **x86/x86_64** (cannot load MediaPipe `.so`)
- expose a broken or missing virtual camera

So on those environments the app **auto-switches to Emulator test mode**:
- Simulated push-up pose data (no camera / MediaPipe)
- Full rep counter, form validation, and Supabase sync still work
- Toggle **Pose overlay** to see the simulated skeleton

If a camera still fails to open, the app falls back to mock mode automatically (or tap **Use emulator test mode**).

To force mock mode:

```env
EXPO_PUBLIC_MOCK_POSE=true
```

To force real camera mode (real **arm64** phone only):

```env
EXPO_PUBLIC_MOCK_POSE=false
```

Restart Metro after changing `.env`. For release APKs, rebuild after changing `.env`.

## Usage

1. Open the app and grant camera permission
2. Place the phone so your **side profile** is visible (best accuracy)
3. Tap **Start workout**
4. Perform push-ups — valid reps increment the counter
5. Toggle **Pose overlay** for debugging skeleton and form metrics
6. Tap **Finish** to save the session to Supabase
7. View past sessions on the **History** screen

## Architecture

```
Camera → MediaPipe Pose → Pose Landmarks → Pose Validation
  → Push-up State Machine → Form Validation → Rep Counter
  → Public API / Events → UI + Supabase
```

### Detection pipeline (`src/detection/`)

| Module | Role |
|--------|------|
| `PoseSmoother` | Rolling average over landmark frames |
| `FormValidator` | Elbow, shoulder, hip, body straightness checks |
| `PushUpDetector` | State machine + rep counting + event callbacks |

### Integration API

```typescript
import { PushUpDetector } from './src/detection';

const detector = new PushUpDetector({
  onRepCompleted: (event) => console.log('Rep', event.repNumber),
  onInvalidRep: (event) => console.log('Invalid', event.reason),
  onPoseLost: () => console.log('Pose lost'),
});

detector.processFrame(landmarks, Date.now());
```

See [docs/API.md](docs/API.md) for full event and config reference.

## Configuration

Default thresholds in `src/detection/types.ts`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minConfidence` | 0.5 | Minimum landmark visibility |
| `smoothingWindow` | 5 | Frames for landmark averaging |
| `elbowTopAngle` | 155° | Arms extended at top |
| `elbowBottomAngle` | 95° | Minimum bend at bottom |
| `minBodyStraightness` | 150° | Shoulder–hip–ankle alignment |
| `repCooldownMs` | 800 | Minimum time between reps |

## Project structure

```
app/                  Expo Router screens
src/
  detection/          Pose + push-up logic (framework-agnostic)
  components/         Camera, rep counter, overlay UI
  hooks/              usePushUpDetection
  services/           Supabase client + workout sync
supabase/migrations/  Database schema
assets/models/        MediaPipe .task model file
```

## Assumptions (from brief)

- Single person in frame
- Side or slightly angled camera view works best
- Standard indoor lighting

