-- Push-Up Counter Supabase schema
-- Run in Supabase SQL Editor or via supabase db push

create extension if not exists "pgcrypto";

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  total_reps integer not null default 0,
  valid_reps integer not null default 0,
  invalid_reps integer not null default 0,
  average_form_score numeric(4, 3),
  created_at timestamptz not null default now()
);

create table if not exists public.rep_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  rep_number integer not null,
  is_valid boolean not null default true,
  form_score numeric(4, 3) not null default 0,
  invalid_reason text,
  elbow_angle numeric(6, 2),
  body_straightness numeric(6, 2),
  recorded_at timestamptz not null default now()
);

create index if not exists idx_workout_sessions_device_id
  on public.workout_sessions(device_id);

create index if not exists idx_workout_sessions_started_at
  on public.workout_sessions(started_at desc);

create index if not exists idx_rep_records_session_id
  on public.rep_records(session_id);

alter table public.workout_sessions enable row level security;
alter table public.rep_records enable row level security;

-- MVP: allow anonymous insert/read (replace with auth policies later)
create policy "Allow anonymous read workout_sessions"
  on public.workout_sessions for select
  using (true);

create policy "Allow anonymous insert workout_sessions"
  on public.workout_sessions for insert
  with check (true);

create policy "Allow anonymous update workout_sessions"
  on public.workout_sessions for update
  using (true);

create policy "Allow anonymous delete workout_sessions"
  on public.workout_sessions for delete
  using (true);

create policy "Allow anonymous read rep_records"
  on public.rep_records for select
  using (true);

create policy "Allow anonymous insert rep_records"
  on public.rep_records for insert
  with check (true);

create policy "Allow anonymous delete rep_records"
  on public.rep_records for delete
  using (true);
