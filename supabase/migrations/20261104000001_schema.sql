-- WorkOut With AI — schéma principal
-- Toutes les tables utilisateur portent user_id et sont protégées par RLS (auth.uid()).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.experience_level as enum ('beginner', 'returning', 'intermediate', 'advanced');
create type public.session_status as enum ('planned', 'in_progress', 'completed', 'abandoned');
create type public.plan_status as enum ('active', 'archived');
create type public.recommendation_status as enum ('pending', 'accepted', 'rejected', 'superseded');
create type public.message_role as enum ('user', 'assistant');

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profil sportif
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  height_cm numeric(5,1) check (height_cm between 100 and 250),
  goal text,
  experience_level public.experience_level,
  sessions_per_week smallint check (sessions_per_week between 1 and 7),
  available_days smallint[] not null default '{}' check (available_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  session_duration_min smallint check (session_duration_min between 10 and 240),
  training_preferences text,
  preferred_exercise_ids uuid[] not null default '{}',
  avoided_exercise_ids uuid[] not null default '{}',
  limitations text,
  limitation_tags text[] not null default '{}',
  recovery_notes text,
  ai_provider text check (ai_provider in ('openai', 'anthropic')),
  rest_timer_default_s smallint not null default 90 check (rest_timer_default_s between 10 and 600),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.user_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  equipment_key text not null,
  quantity smallint not null default 1 check (quantity between 1 and 100),
  details text,
  created_at timestamptz not null default now(),
  unique (user_id, equipment_key)
);

-- ---------------------------------------------------------------------------
-- Bibliothèque d'exercices (données de référence, lecture seule côté client)
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',      -- matériel requis (vide = poids du corps)
  difficulty smallint not null check (difficulty between 1 and 3),
  measurement text not null default 'reps' check (measurement in ('reps', 'duration')),
  is_unilateral boolean not null default false,
  instructions text[] not null default '{}',
  safety_tips text[] not null default '{}',
  caution_tags text[] not null default '{}',   -- ex. 'abdominal' : vigilance si limitation déclarée
  default_rest_s smallint not null default 90,
  created_at timestamptz not null default now()
);
create index exercises_primary_muscle_idx on public.exercises (primary_muscle);

create table public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  kind text not null check (kind in ('animation', 'image', 'video')),
  url text,
  data jsonb,               -- 'animation' : poses clés dessinées par l'application
  alt text not null,
  position smallint not null default 0,
  check ((kind = 'animation' and data is not null) or (kind <> 'animation' and url is not null))
);
create index exercise_media_exercise_idx on public.exercise_media (exercise_id, position);

-- ---------------------------------------------------------------------------
-- Programmes (versionnés : une version = un instantané immuable)
-- ---------------------------------------------------------------------------
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  goal text,
  status public.plan_status not null default 'active',
  start_date date not null,
  weeks smallint not null check (weeks between 1 and 52),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index workout_plans_one_active_idx on public.workout_plans (user_id) where status = 'active';
create trigger workout_plans_updated_at before update on public.workout_plans
  for each row execute function public.set_updated_at();

create table public.workout_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  source text not null check (source in ('template', 'user', 'coach')),
  change_summary text not null,
  recommendation_id uuid,
  created_at timestamptz not null default now(),
  unique (plan_id, version_number)
);
alter table public.workout_plans
  add constraint workout_plans_current_version_fk
  foreign key (current_version_id) references public.workout_plan_versions (id) on delete set null;

create table public.planned_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.workout_plan_versions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 52),
  day_of_week smallint not null check (day_of_week between 1 and 7), -- 1 = lundi
  title text not null,
  focus text,
  unique (plan_version_id, week_number, day_of_week)
);

create table public.planned_exercises (
  id uuid primary key default gen_random_uuid(),
  planned_session_id uuid not null references public.planned_sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  position smallint not null check (position >= 0),
  sets smallint not null check (sets between 1 and 10),
  reps_min smallint check (reps_min between 1 and 100),
  reps_max smallint check (reps_max between 1 and 100),
  duration_s smallint check (duration_s between 5 and 600),
  rest_s smallint not null default 90 check (rest_s between 0 and 600),
  load_kg numeric(6,2) check (load_kg >= 0),
  notes text,
  unique (planned_session_id, position),
  check (reps_min is null or reps_max is null or reps_min <= reps_max),
  check (reps_max is not null or duration_s is not null)
);
create index planned_exercises_exercise_idx on public.planned_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- Séances réalisées
-- ---------------------------------------------------------------------------
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid references public.workout_plans (id) on delete set null,
  planned_session_id uuid references public.planned_sessions (id) on delete set null,
  title text not null,
  status public.session_status not null default 'planned',
  scheduled_for date,
  started_at timestamptz,
  completed_at timestamptz,
  current_exercise_position smallint not null default 0,
  perceived_difficulty smallint check (perceived_difficulty between 1 and 10),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'completed' or completed_at is not null),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);
create unique index workout_sessions_one_in_progress_idx on public.workout_sessions (user_id) where status = 'in_progress';
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, started_at desc);
create index workout_sessions_planned_idx on public.workout_sessions (planned_session_id);
create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();

create table public.performed_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  planned_exercise_id uuid references public.planned_exercises (id) on delete set null,
  set_number smallint not null check (set_number between 1 and 20),
  reps smallint check (reps between 0 and 500),
  duration_s smallint check (duration_s between 0 and 3600),
  load_kg numeric(6,2) check (load_kg >= 0),
  difficulty smallint check (difficulty between 1 and 5), -- 1 très facile … 5 maximal
  rest_s smallint check (rest_s between 0 and 3600),      -- repos effectif avant la série
  pain boolean not null default false,
  pain_note text,
  note text,
  technique jsonb not null default '{}'::jsonb,           -- variante, pauses, amplitude…
  completed_at timestamptz not null default now(),
  unique (workout_session_id, exercise_id, set_number),
  check (reps is not null or duration_s is not null)
);
create index performed_sets_user_exercise_idx on public.performed_sets (user_id, exercise_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Suivi physique
-- ---------------------------------------------------------------------------
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,2) check (weight_kg between 25 and 350),
  waist_cm numeric(5,1) check (waist_cm between 30 and 250),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, measured_on),
  check (weight_kg is not null or waist_cm is not null)
);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null unique,
  taken_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index progress_photos_user_idx on public.progress_photos (user_id, taken_on desc);

-- ---------------------------------------------------------------------------
-- Coach IA
-- ---------------------------------------------------------------------------
create table public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Nouvelle conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_conversations_user_idx on public.coach_conversations (user_id, updated_at desc);
create trigger coach_conversations_updated_at before update on public.coach_conversations
  for each row execute function public.set_updated_at();

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role public.message_role not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index coach_messages_conversation_idx on public.coach_messages (conversation_id, created_at);

create table public.coach_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversation_id uuid references public.coach_conversations (id) on delete set null,
  workout_session_id uuid references public.workout_sessions (id) on delete set null,
  kind text not null check (kind in ('session_analysis', 'program_adjustment')),
  title text not null,
  summary text not null,
  rationale text,
  details jsonb not null default '{}'::jsonb,      -- points forts, difficultés…
  adjustments jsonb not null default '[]'::jsonb,  -- opérations proposées sur le programme
  engine_facts jsonb not null default '{}'::jsonb, -- faits déterministes utilisés (explicabilité)
  status public.recommendation_status not null default 'pending',
  provider text,
  model text,
  applied_version_id uuid references public.workout_plan_versions (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index coach_recommendations_user_idx on public.coach_recommendations (user_id, created_at desc);
alter table public.workout_plan_versions
  add constraint workout_plan_versions_recommendation_fk
  foreign key (recommendation_id) references public.coach_recommendations (id) on delete set null;

create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null,
  model text not null,
  task text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer,
  status text not null check (status in ('ok', 'error')),
  error_code text,
  created_at timestamptz not null default now()
);
create index ai_usage_logs_user_idx on public.ai_usage_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_equipment enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_media enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_plan_versions enable row level security;
alter table public.planned_sessions enable row level security;
alter table public.planned_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.performed_sets enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;
alter table public.coach_recommendations enable row level security;
alter table public.ai_usage_logs enable row level security;

-- Référentiel : lecture pour les utilisateurs connectés, aucune écriture client.
create policy "exercises readable" on public.exercises for select to authenticated using (true);
create policy "exercise media readable" on public.exercise_media for select to authenticated using (true);

create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Tables possédées directement : CRUD complet sur ses propres lignes.
do $$
declare t text;
begin
  foreach t in array array['user_equipment', 'workout_plans', 'body_measurements', 'progress_photos', 'coach_conversations']
  loop
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Versions de programme : immuables (insertion + lecture).
create policy "own versions select" on public.workout_plan_versions for select to authenticated using (user_id = auth.uid());
create policy "own versions insert" on public.workout_plan_versions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()));

create policy "own planned sessions select" on public.planned_sessions for select to authenticated using (user_id = auth.uid());
create policy "own planned sessions insert" on public.planned_sessions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.workout_plan_versions v where v.id = plan_version_id and v.user_id = auth.uid()));

create policy "own planned exercises select" on public.planned_exercises for select to authenticated using (user_id = auth.uid());
create policy "own planned exercises insert" on public.planned_exercises for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.planned_sessions s where s.id = planned_session_id and s.user_id = auth.uid()));

create policy "own sessions" on public.workout_sessions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (plan_id is null or exists (select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid())));

create policy "own sets" on public.performed_sets for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.workout_sessions s where s.id = workout_session_id and s.user_id = auth.uid()));

create policy "own messages select" on public.coach_messages for select to authenticated using (user_id = auth.uid());
create policy "own messages insert" on public.coach_messages for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.coach_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "own messages delete" on public.coach_messages for delete to authenticated using (user_id = auth.uid());

create policy "own recommendations select" on public.coach_recommendations for select to authenticated using (user_id = auth.uid());
create policy "own recommendations insert" on public.coach_recommendations for insert to authenticated with check (user_id = auth.uid());
create policy "own recommendations update" on public.coach_recommendations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Journaux de consommation : lecture et ajout seulement (pas de suppression pour fiabiliser les quotas).
create policy "own usage select" on public.ai_usage_logs for select to authenticated using (user_id = auth.uid());
create policy "own usage insert" on public.ai_usage_logs for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Stockage privé des photos de progression : dossier = uid de l'utilisateur
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "own photos select" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
