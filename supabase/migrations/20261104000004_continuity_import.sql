-- Continuité du coaching et import d'un ancien suivi.

-- « skipped » : séance volontairement non réalisée (le programme continue, sans réinitialisation).
-- « to_verify » : séance issue d'un import ou d'une date passée dont la réalisation n'est pas confirmée.
alter type public.session_status add value if not exists 'skipped';
alter type public.session_status add value if not exists 'to_verify';

-- Référence externe pour rendre un import rejouable sans doublon.
alter table public.workout_sessions add column if not exists external_ref text;
-- Contrainte complète (et non index partiel) pour permettre upsert « on conflict (user_id, external_ref) » ; les NULL restent distincts.
alter table public.workout_sessions add constraint workout_sessions_external_ref_key unique (user_id, external_ref);

-- Les recommandations peuvent venir de l'IA ou des règles déterministes de l'application.
alter table public.coach_recommendations add column if not exists source text not null default 'ai' check (source in ('ai', 'rules'));
alter table public.coach_recommendations add column if not exists trigger_key text;
-- Un même déclencheur (ex. douleur sur un exercice lors d'une séance) ne génère qu'une proposition.
alter table public.coach_recommendations add constraint coach_recommendations_trigger_key unique (user_id, trigger_key);

-- Versions de programme issues d'une suggestion automatique acceptée.
alter table public.workout_plan_versions drop constraint if exists workout_plan_versions_source_check;
alter table public.workout_plan_versions add constraint workout_plan_versions_source_check check (source in ('template', 'user', 'coach', 'rules'));
