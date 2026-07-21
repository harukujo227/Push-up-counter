import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Push-Up Counter',
  slug: 'push-up-counter',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'pushup',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0f',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.pushup.counter',
    infoPlist: {
      NSCameraUsageDescription:
        'Camera access is required to detect push-ups and count reps.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0f',
    },
    package: 'com.pushup.counter',
    permissions: ['android.permission.CAMERA'],
  },
  plugins: [
    'expo-router',
    [
      'react-native-vision-camera',
      {
        cameraPermissionText:
          'Camera access is required to detect push-ups and count reps.',
        enableMicrophonePermission: false,
      },
    ],
    [
      'react-native-mediapipe-posedetection',
      {
        assetsPaths: ['./assets/models/'],
      },
    ],
    'expo-asset',
    'expo-font',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    mockPose: process.env.EXPO_PUBLIC_MOCK_POSE,
  },
};

export default config;
