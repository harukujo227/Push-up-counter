import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { isSupabaseConfigured, type WorkoutSession } from '../src/services/supabase';
import { workoutService } from '../src/services/workoutService';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await workoutService.fetchRecentSessions();
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Supabase not configured</Text>
        <Text style={styles.subtitle}>
          Copy `.env.example` to `.env` and add your Supabase URL and anon key.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && sessions.length === 0 ? (
        <ActivityIndicator color="#4ade80" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#4ade80" />}
          contentContainerStyle={sessions.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <Text style={styles.subtitle}>No workouts yet. Complete a session on the home screen.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardDate}>{formatDate(item.started_at)}</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{item.valid_reps}</Text>
                  <Text style={styles.statLabel}>Valid reps</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{item.invalid_reps}</Text>
                  <Text style={styles.statLabel}>Invalid</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {item.average_form_score != null
                      ? `${Math.round(Number(item.average_form_score) * 100)}%`
                      : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Avg form</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a0a0f',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#8b8b9e',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#14141c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardDate: {
    color: '#c8c8d4',
    fontSize: 14,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: '#8b8b9e',
    fontSize: 11,
    marginTop: 4,
  },
});
