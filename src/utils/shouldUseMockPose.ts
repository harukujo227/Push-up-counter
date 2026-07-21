import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function parseBooleanEnv(value: string | undefined | null): boolean | null {
  if (value == null || String(value).trim() === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function isAndroidEmulator(): boolean {
  if (Platform.OS !== 'android') return false;

  const constants = Platform.constants as {
    Model?: string;
    Brand?: string;
    Manufacturer?: string;
    Fingerprint?: string;
  };

  const fingerprint = [
    constants.Manufacturer,
    constants.Brand,
    constants.Model,
    constants.Fingerprint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    fingerprint.includes('emulator') ||
    fingerprint.includes('sdk_gphone') ||
    fingerprint.includes('android sdk built for x86') ||
    fingerprint.includes('google_sdk') ||
    fingerprint.includes('generic')
  );
}

/** MediaPipe posedetection ships native libs for arm64-v8a only. */
function lacksMediaPipeNativeSupport(): boolean {
  if (Platform.OS !== 'android') return false;

  const abis =
    (Platform.constants as { SupportedAbis?: string[] }).SupportedAbis ?? [];

  if (abis.length === 0) {
    return isAndroidEmulator();
  }

  return !abis.includes('arm64-v8a');
}

function readMockPoseOverride(): boolean | null {
  return parseBooleanEnv(
    process.env.EXPO_PUBLIC_MOCK_POSE ??
      (Constants.expoConfig?.extra?.mockPose as string | undefined) ??
      null,
  );
}

/**
 * Prefer mock pose whenever MediaPipe cannot run.
 * Importing react-native-mediapipe-posedetection on unsupported ABIs
 * (x86 emulators, 32-bit ARM) crashes the release process.
 */
export function shouldUseMockPose(): boolean {
  if (lacksMediaPipeNativeSupport()) return true;
  if (isAndroidEmulator()) return true;
  if (!Device.isDevice) return true;

  const override = readMockPoseOverride();
  if (override != null) return override;

  return false;
}

export function getPoseModeLabel(): string {
  return shouldUseMockPose() ? 'Emulator test mode' : 'Camera mode';
}
