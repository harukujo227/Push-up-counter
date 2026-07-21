import { PUSH_UP_LANDMARKS } from './landmarks';
import { computeAverageConfidence } from './geometry';
import type { PoseFrame, PoseLandmark } from './types';

export class PoseSmoother {
  private readonly windowSize: number;
  private buffer: PoseLandmark[][] = [];

  constructor(windowSize: number) {
    this.windowSize = Math.max(1, windowSize);
  }

  reset() {
    this.buffer = [];
  }

  smooth(landmarks: PoseLandmark[]): PoseLandmark[] {
    this.buffer.push(landmarks);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    const count = landmarks.length;
    const averaged: PoseLandmark[] = [];

    for (let index = 0; index < count; index += 1) {
      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;
      let sumVis = 0;
      let samples = 0;

      for (const frame of this.buffer) {
        const point = frame[index];
        if (!point) continue;
        sumX += point.x;
        sumY += point.y;
        sumZ += point.z;
        sumVis += point.visibility ?? 1;
        samples += 1;
      }

      if (samples === 0) {
        averaged.push(landmarks[index]);
        continue;
      }

      averaged.push({
        x: sumX / samples,
        y: sumY / samples,
        z: sumZ / samples,
        visibility: sumVis / samples,
      });
    }

    return averaged;
  }

  toPoseFrame(landmarks: PoseLandmark[], timestamp: number): PoseFrame {
    const smoothed = this.smooth(landmarks);
    const relevant = PUSH_UP_LANDMARKS.map((index) => smoothed[index]);
    return {
      landmarks: smoothed,
      timestamp,
      averageConfidence: computeAverageConfidence(relevant),
    };
  }
}
