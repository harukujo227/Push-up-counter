import Svg, { Circle, Line } from 'react-native-svg';
import { SKELETON_CONNECTIONS } from '../detection';
import type { PoseLandmark } from '../detection';

interface PoseOverlayProps {
  landmarks: PoseLandmark[];
  width: number;
  height: number;
  visible: boolean;
}

export function PoseOverlay({ landmarks, width, height, visible }: PoseOverlayProps) {
  if (!visible || landmarks.length === 0 || width === 0 || height === 0) {
    return null;
  }

  const toX = (x: number) => x * width;
  const toY = (y: number) => y * height;

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      {SKELETON_CONNECTIONS.map(([from, to]) => {
        const a = landmarks[from];
        const b = landmarks[to];
        if (!a || !b) return null;
        const opacity = Math.min(a.visibility ?? 1, b.visibility ?? 1);
        if (opacity < 0.3) return null;
        return (
          <Line
            key={`${from}-${to}`}
            x1={toX(a.x)}
            y1={toY(a.y)}
            x2={toX(b.x)}
            y2={toY(b.y)}
            stroke="#4ade80"
            strokeWidth={3}
            opacity={opacity}
          />
        );
      })}
      {landmarks.map((point, index) => {
        const opacity = point.visibility ?? 1;
        if (opacity < 0.3) return null;
        return (
          <Circle
            key={index}
            cx={toX(point.x)}
            cy={toY(point.y)}
            r={4}
            fill="#22d3ee"
            opacity={opacity}
          />
        );
      })}
    </Svg>
  );
}
