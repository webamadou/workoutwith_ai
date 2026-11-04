-- Fonctions transactionnelles appelées par le client (RLS appliquée : security invoker).

-- Insère les séances/exercices d'une version à partir d'un JSON :
-- [{week_number, day_of_week, title, focus, exercises: [{exercise_id, sets, reps_min, reps_max, duration_s, rest_s, load_kg, notes}]}]
create or replace function public._insert_plan_sessions(p_version_id uuid, p_sessions jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  s jsonb;
  e jsonb;
  v_session_id uuid;
  v_pos int;
begin
  if jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) = 0 then
    raise exception 'sessions must be a non-empty array';
  end if;
  for s in select * from jsonb_array_elements(p_sessions) loop
    insert into planned_sessions (plan_version_id, week_number, day_of_week, title, focus)
    values (p_version_id, (s->>'week_number')::smallint, (s->>'day_of_week')::smallint, s->>'title', s->>'focus')
    returning id into v_session_id;
    v_pos := 0;
    for e in select * from jsonb_array_elements(s->'exercises') loop
      insert into planned_exercises (planned_session_id, exercise_id, position, sets, reps_min, reps_max, duration_s, rest_s, load_kg, notes)
      values (v_session_id, (e->>'exercise_id')::uuid, v_pos, (e->>'sets')::smallint,
              (e->>'reps_min')::smallint, (e->>'reps_max')::smallint, (e->>'duration_s')::smallint,
              coalesce((e->>'rest_s')::smallint, 90), (e->>'load_kg')::numeric, e->>'notes');
      v_pos := v_pos + 1;
    end loop;
  end loop;
end $$;

-- Crée un programme actif (archive l'éventuel programme actif précédent) et sa version 1.
create or replace function public.create_workout_plan(
  p_name text, p_goal text, p_start_date date, p_weeks smallint, p_sessions jsonb,
  p_change_summary text default 'Programme initial'
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_plan_id uuid;
  v_version_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update workout_plans set status = 'archived' where user_id = auth.uid() and status = 'active';
  insert into workout_plans (name, goal, start_date, weeks) values (p_name, p_goal, p_start_date, p_weeks)
  returning id into v_plan_id;
  insert into workout_plan_versions (plan_id, version_number, source, change_summary)
  values (v_plan_id, 1, 'template', p_change_summary) returning id into v_version_id;
  perform _insert_plan_sessions(v_version_id, p_sessions);
  update workout_plans set current_version_id = v_version_id where id = v_plan_id;
  return v_plan_id;
end $$;

-- Crée une nouvelle version (les versions précédentes restent intactes pour la traçabilité).
-- Si une recommandation est fournie, elle passe à « accepted » et pointe vers la version créée.
create or replace function public.create_plan_version(
  p_plan_id uuid, p_sessions jsonb, p_source text, p_change_summary text, p_recommendation_id uuid default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_version_id uuid;
  v_next int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  -- verrouille le programme pour sérialiser les versions concurrentes
  perform 1 from workout_plans where id = p_plan_id and user_id = auth.uid() for update;
  if not found then raise exception 'plan not found'; end if;
  select coalesce(max(version_number), 0) + 1 into v_next from workout_plan_versions where plan_id = p_plan_id;
  insert into workout_plan_versions (plan_id, version_number, source, change_summary, recommendation_id)
  values (p_plan_id, v_next, p_source, p_change_summary, p_recommendation_id) returning id into v_version_id;
  perform _insert_plan_sessions(v_version_id, p_sessions);
  update workout_plans set current_version_id = v_version_id where id = p_plan_id;
  if p_recommendation_id is not null then
    update coach_recommendations
       set status = 'accepted', decided_at = now(), applied_version_id = v_version_id
     where id = p_recommendation_id and user_id = auth.uid() and status = 'pending';
    if not found then raise exception 'recommendation not pending'; end if;
  end if;
  return v_version_id;
end $$;

-- Suppression du compte : supprime l'utilisateur courant (cascade sur toutes ses données).
-- Les fichiers de stockage doivent être supprimés avant via l'API Storage.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public._insert_plan_sessions(uuid, jsonb) from public, anon;
