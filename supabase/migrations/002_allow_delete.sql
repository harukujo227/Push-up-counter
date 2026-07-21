-- Allow anonymous delete so History "Clear" buttons can remove sessions.
-- rep_records are removed automatically via ON DELETE CASCADE.

create policy "Allow anonymous delete workout_sessions"
  on public.workout_sessions for delete
  using (true);

create policy "Allow anonymous delete rep_records"
  on public.rep_records for delete
  using (true);
