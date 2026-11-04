// Génère la migration SQL de la bibliothèque d'exercices à partir de shared/exercises/library.ts.
// Usage : npm run gen:exercises
import { writeFileSync } from 'node:fs'
import { EXERCISES } from '../shared/exercises/library'

const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const arr = (a: readonly string[]) => (a.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`)

const rows = EXERCISES.map((e) => `  (${[
  q(e.slug), q(e.name), q(e.description), q(e.primary_muscle), arr(e.secondary_muscles), arr(e.equipment),
  e.difficulty, q(e.measurement), e.is_unilateral ? 'true' : 'false', arr(e.instructions), arr(e.safety_tips),
  arr(e.caution_tags ?? []), e.default_rest_s,
].join(', ')})`)

const media = EXERCISES.map((e) => `  (${q(e.slug)}, ${q(JSON.stringify(e.animation))}::jsonb, ${q(e.alt)})`)

const sql = `-- Généré par scripts/generate-exercise-library.ts — ne pas modifier à la main.
insert into public.exercises (slug, name, description, primary_muscle, secondary_muscles, equipment, difficulty, measurement, is_unilateral, instructions, safety_tips, caution_tags, default_rest_s)
values
${rows.join(',\n')}
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles, equipment = excluded.equipment, difficulty = excluded.difficulty,
  measurement = excluded.measurement, is_unilateral = excluded.is_unilateral, instructions = excluded.instructions,
  safety_tips = excluded.safety_tips, caution_tags = excluded.caution_tags, default_rest_s = excluded.default_rest_s;

delete from public.exercise_media where kind = 'animation';
insert into public.exercise_media (exercise_id, kind, data, alt, position)
select e.id, 'animation', m.data, m.alt, 0
from (values
${media.join(',\n')}
) as m(slug, data, alt)
join public.exercises e on e.slug = m.slug;
`
writeFileSync(process.argv[2] ?? 'supabase/migrations/20261104000003_exercise_library.sql', sql)
console.log(`${EXERCISES.length} exercices écrits`)
