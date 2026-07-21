import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InvalidRepEvent, RepEvent } from '../detection';
import {
  isSupabaseConfigured,
  supabase,
  type RepRecord,
  type WorkoutSession,
} from './supabase';

const DEVICE_ID_KEY = 'pushup_device_id';

async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export class WorkoutService {
  private sessionId: string | null = null;
  private validReps = 0;
  private invalidReps = 0;
  private formScores: number[] = [];

  async startSession(): Promise<string | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    const deviceId = await getDeviceId();
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        device_id: deviceId,
        started_at: new Date().toISOString(),
        total_reps: 0,
        valid_reps: 0,
        invalid_reps: 0,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('Failed to start workout session:', error.message);
      return null;
    }

    this.sessionId = data.id;
    this.validReps = 0;
    this.invalidReps = 0;
    this.formScores = [];
    return data.id;
  }

  async recordValidRep(event: RepEvent): Promise<void> {
    this.validReps += 1;
    this.formScores.push(event.formScore);
    await this.persistRep(event, true, null);
  }

  async recordInvalidRep(event: InvalidRepEvent): Promise<void> {
    this.invalidReps += 1;
    await this.persistRep(event, false, event.reason);
  }

  private async persistRep(
    event: RepEvent | InvalidRepEvent,
    isValid: boolean,
    invalidReason: string | null,
  ) {
    if (!this.sessionId || !supabase) return;

    const repNumber = 'repNumber' in event ? event.repNumber : this.validReps + this.invalidReps;
    const formScore = 'formScore' in event ? event.formScore : 0;

    const payload: Omit<RepRecord, 'id' | 'recorded_at'> = {
      session_id: this.sessionId,
      rep_number: repNumber,
      is_valid: isValid,
      form_score: formScore,
      invalid_reason: invalidReason,
      elbow_angle: event.metrics.elbowAngle,
      body_straightness: event.metrics.bodyStraightness,
    };

    const { error } = await supabase.from('rep_records').insert(payload);
    if (error) {
      console.warn('Failed to save rep:', error.message);
    }

    await supabase
      .from('workout_sessions')
      .update({
        total_reps: this.validReps + this.invalidReps,
        valid_reps: this.validReps,
        invalid_reps: this.invalidReps,
        average_form_score:
          this.formScores.length > 0
            ? this.formScores.reduce((sum, score) => sum + score, 0) /
              this.formScores.length
            : null,
      })
      .eq('id', this.sessionId);
  }

  async endSession(): Promise<WorkoutSession | null> {
    if (!this.sessionId || !supabase) return null;

    const { data, error } = await supabase
      .from('workout_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', this.sessionId)
      .select('*')
      .single();

    if (error) {
      console.warn('Failed to end session:', error.message);
      return null;
    }

    this.sessionId = null;
    return data;
  }

  async fetchRecentSessions(limit = 10): Promise<WorkoutSession[]> {
    if (!supabase) return [];

    const deviceId = await getDeviceId();
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('device_id', deviceId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('Failed to fetch sessions:', error.message);
      return [];
    }

    return data ?? [];
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (!supabase) return false;

    const deviceId = await getDeviceId();
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('device_id', deviceId);

    if (error) {
      console.warn('Failed to delete session:', error.message);
      return false;
    }

    return true;
  }

  async clearAllSessions(): Promise<boolean> {
    if (!supabase) return false;

    const deviceId = await getDeviceId();
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('device_id', deviceId);

    if (error) {
      console.warn('Failed to clear sessions:', error.message);
      return false;
    }

    return true;
  }
}

export const workoutService = new WorkoutService();
