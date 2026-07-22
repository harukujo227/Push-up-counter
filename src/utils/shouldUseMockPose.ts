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

type AndroidConstants = {
  Model?: string;
  Brand?: string;
  Manufacturer?: string;
  Fingerprint?: string;
  Hardware?: string;
  Product?: string;
  Device?: string;
  Board?: string;
  Host?: string;
  Serial?: string;
  SupportedAbis?: string[];
};

function getAndroidConstants(): AndroidConstants {
  return (Platform.constants ?? {}) as AndroidConstants;
}

function getAndroidIdentityBlob(): string {
  const c = getAndroidConstants();
  return [
    c.Manufacturer,
    c.Brand,
    c.Model,
    c.Fingerprint,
    c.Hardware,
    c.Product,
    c.Device,
    c.Board,
    c.Host,
    c.Serial,
    Device.brand,
    Device.manufacturer,
    Device.modelName,
    Device.designName,
    Device.productName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isAndroidEmulator(): boolean {
  if (Platform.OS !== 'android') return false;

  const c = getAndroidConstants();
  const blob = getAndroidIdentityBlob();
  const markers = [
    'emulator',
    'sdk_gphone',
    'android sdk built for x86',
    'google_sdk',
    'generic_x86',
    'generic',
    'ldplayer',
    'changxiang',
    'ttvm',
    'tiantian',
    'vbox86',
    'android_x86',
    'goldfish',
    'ranchu',
    'nox',
    'bluestacks',
    'bst_x86',
    'mumu',
    'memu',
    'genymotion',
    'andyroid',
    'droid4x',
    'microvirt',
    'asus_z01qd',
    'sm-g975n',
    'sm-g975f',
  ];

  if (markers.some((m) => blob.includes(m))) return true;

  const hardware = String(c.Hardware ?? '').toLowerCase();
  if (
    hardware.includes('x86') ||
    hardware.includes('vbox') ||
    hardware.includes('intel') ||
    hardware.includes('amd')
  ) {
    return true;
  }

  const host = String(c.Host ?? '').toLowerCase();
  const device = String(c.Device ?? Device.designName ?? '').toLowerCase();
  if (host.includes('ubuntu') && (device === 'aosp' || device.includes('generic'))) {
    return true;
  }

  return false;
}

function lacksMediaPipeNativeSupport(): boolean {
  if (Platform.OS !== 'android') return false;

  const abis = getAndroidConstants().SupportedAbis ?? [];
  if (abis.length === 0) return isAndroidEmulator();

  if (abis[0] === 'x86' || abis[0] === 'x86_64') return true;
  if (abis.includes('x86') || abis.includes('x86_64')) return true;
  return !abis.includes('arm64-v8a');
}

function readMockPoseOverride(): boolean | null {
  return parseBooleanEnv(
    process.env.EXPO_PUBLIC_MOCK_POSE ??
      (Constants.expoConfig?.extra?.mockPose as string | undefined) ??
      null,
  );
}

/** True when the app should use simulated poses (safe for LDPlayer / emulators). */
export function shouldUseMockPose(): boolean {
  const override = readMockPoseOverride();
  if (override === true) return true;

  if (lacksMediaPipeNativeSupport()) return true;
  if (isAndroidEmulator()) return true;
  if (!Device.isDevice) return true;

  if (override === false) return false;
  return false;
}

export function getPoseModeLabel(): string {
  return shouldUseMockPose() ? 'Emulator test mode' : 'Camera mode';
}

export function getMockPoseReason(): string | null {
  if (readMockPoseOverride() === true) {
    return 'Test mode is on. Tap Start workout — reps are simulated (no camera needed).';
  }
  if (lacksMediaPipeNativeSupport() || isAndroidEmulator() || !Device.isDevice) {
    return 'Emulator/LDPlayer detected. Tap Start workout — reps are simulated (no camera needed).';
  }
  return null;
}
