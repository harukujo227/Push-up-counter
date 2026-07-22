import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkoutCamera } from '../src/components/WorkoutCamera';

export default function WorkoutScreen() {
  const [showDebug, setShowDebug] = useState(false);
  const insets = useSafeAreaInsets();
  // Keep controls at least 30px below the top / status bar.
  const topOffset = Math.max(insets.top, StatusBar.currentHeight ?? 0) + 30;

  return (
    <View style={styles.container}>
      <WorkoutCamera showDebug={showDebug} />

      <View style={[styles.toolbar, { top: topOffset }]}>
        <View style={styles.debugToggle}>
          <Text style={styles.debugLabel}>Pose overlay</Text>
          <Switch
            value={showDebug}
            onValueChange={setShowDebug}
            trackColor={{ false: '#333', true: '#166534' }}
            thumbColor={showDebug ? '#4ade80' : '#888'}
          />
        </View>
        <Link href="/history" asChild>
          <Pressable style={styles.historyLink}>
            <Text style={styles.historyText}>History →</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  toolbar: {
    position: 'absolute',
    right: 16,
    left: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  debugToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10,10,15,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  debugLabel: {
    color: '#c8c8d4',
    fontSize: 12,
  },
  historyLink: {
    backgroundColor: 'rgba(10,10,15,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  historyText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
});
