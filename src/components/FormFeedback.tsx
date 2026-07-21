import { StyleSheet, Text, View } from 'react-native';
import type { FormMetrics } from '../detection';

interface FormFeedbackProps {
  message: string | null;
  metrics: FormMetrics | null;
  showDebug: boolean;
}

export function FormFeedback({ message, metrics, showDebug }: FormFeedbackProps) {
  if (!message && (!showDebug || !metrics)) {
    return null;
  }

  return (
    <View style={styles.container}>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {showDebug && metrics ? (
        <View style={styles.debugBox}>
          <Text style={styles.debugLine}>Elbow: {metrics.elbowAngle.toFixed(0)}°</Text>
          <Text style={styles.debugLine}>
            Body: {metrics.bodyStraightness.toFixed(0)}°
          </Text>
          <Text style={styles.debugLine}>
            Depth: {(metrics.depthScore * 100).toFixed(0)}% · Extension:{' '}
            {(metrics.extensionScore * 100).toFixed(0)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(10, 10, 15, 0.82)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  message: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
  },
  debugBox: {
    gap: 4,
  },
  debugLine: {
    color: '#8b8b9e',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
