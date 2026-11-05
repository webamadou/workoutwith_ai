<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStorage, useWakeLock } from '@vueuse/core'
import { ChevronLeft, ChevronRight, CloudOff, Info, Pencil, Plus, TriangleAlert, X } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ExerciseDemo from '@/components/exercise/ExerciseDemo.vue'
import SetForm, { type SetDraft } from '@/components/workout/SetForm.vue'
import RestTimerOverlay from '@/components/workout/RestTimerOverlay.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useAuthStore } from '@/stores/auth'
import { deleteSet, fetchSession, fetchSets, updateSession } from '@/services/workout'
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type Exercise, type PerformedSet, type PlannedExercise, type PlannedSession, type WorkoutSession } from '@/services/types'
import { useRestTimer } from '@/composables/useRestTimer'
import { lastSyncError, useSetQueue } from '@/composables/useSetQueue'
import { useToast } from '@/composables/useToast'
import { formatKg, formatTarget } from '@/lib/format'
import { exerciseHistory, suggestNext } from '@shared/progression/engine'

const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const auth = useAuthStore()
const toast = useToast()
const id = route.params.id as string

const session = ref<WorkoutSession | null>(null)
const planned = ref<PlannedSession | null>(null)
const sets = ref<PerformedSet[]>([])
const history = ref<PerformedSet[]>([])
const saving = ref(false)
const editingSet = ref<number | null>(null)
const showInfo = ref(false)
const showFinish = ref(false)
const showQuit = ref(false)
const showAdd = ref(false)
const search = ref('')
const finish = ref({ perceived_difficulty: null as number | null, comment: '' })

const rest = useRestTimer(id)
const queue = useSetQueue()
const wake = useWakeLock()
const drafts = useStorage<Record<string, SetDraft>>(`wwai-draft-${id}`, {})
// Exercices ajoutés en cours de séance : propres à cette séance, le programme n'est pas modifié.
// shortcut: stockés sur l'appareil, perdus si le stockage est vidé avant la fin de séance ; passer en base si besoin multi-appareils.
const extras = useStorage<PlannedExercise[]>(`wwai-extra-${id}`, [])
const isExtra = (e: { id: string }) => e.id.startsWith('extra-')

onMounted(async () => {
  try {
    await catalog.load()
    await queue.flush().catch(() => {})
    const r = await fetchSession(id)
    if (r.session.status === 'completed') return router.replace(`/seance/${id}/bilan`)
    session.value = r.session
    planned.value = r.planned
    sets.value = r.sets
    history.value = (await fetchSets({ since: new Date(Date.now() - 180 * 86_400_000).toISOString() }))
      .filter((s) => s.workout_session_id !== id)
    if (wake.isSupported.value) await wake.request('screen').catch(() => {})
  } catch (e) {
    toast.error(e)
  }
})

const exercises = computed(() => [...(planned.value?.planned_exercises ?? []), ...extras.value])
const index = computed({
  get: () => Math.min(session.value?.current_exercise_position ?? 0, Math.max(exercises.value.length - 1, 0)),
  set: (i) => {
    if (!session.value) return
    session.value.current_exercise_position = i
    editingSet.value = null
    void updateSession(id, { current_exercise_position: i }).catch(() => {}) // non bloquant
  },
})
const pe = computed(() => exercises.value[index.value])
const ex = computed(() => (pe.value ? catalog.byId.get(pe.value.exercise_id) : undefined))
const isDuration = computed(() => ex.value?.measurement === 'duration')
const loaded = computed(() => (ex.value?.equipment.length ?? 0) > 0 || pe.value?.load_kg != null)
const exSets = (exerciseId: string) => sets.value.filter((s) => s.exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number)
const doneSets = computed(() => (pe.value ? exSets(pe.value.exercise_id) : []))
const nextSetNumber = computed(() => editingSet.value ?? doneSets.value.length + 1)
const exerciseDone = computed(() => pe.value && doneSets.value.length >= pe.value.sets)
const caution = computed(() => ex.value?.caution_tags.some((t) => auth.profile?.limitation_tags.includes(t)))

// Dernière performance hors séance courante, pour pré-remplir et guider.
const pastHistory = computed(() => (pe.value ? exerciseHistory(history.value as never, pe.value.exercise_id) : []))
const lastPerf = computed(() => pastHistory.value.at(-1))
const advice = computed(() => (pe.value ? suggestNext(pastHistory.value, pe.value) : null))

function defaultDraft(): SetDraft {
  const prev = doneSets.value.at(-1)
  const lastLoad = prev?.load_kg ?? lastPerf.value?.max_load_kg ?? pe.value?.load_kg ?? null
  return {
    reps: prev?.reps ?? pe.value?.reps_max ?? null,
    duration_s: prev?.duration_s ?? pe.value?.duration_s ?? null,
    load_kg: lastLoad == null ? null : Number(lastLoad),
    difficulty: null, note: '', pain: false, pain_note: '',
    technique: { ...((prev?.technique as SetDraft['technique']) ?? {}) },
  }
}

const draft = computed<SetDraft>({
  get: () => {
    if (!pe.value) return defaultDraft()
    const key = pe.value.id
    drafts.value[key] ??= defaultDraft()
    return drafts.value[key]
  },
  set: (v) => { if (pe.value) drafts.value = { ...drafts.value, [pe.value.id]: v } },
})

function editSet(s: PerformedSet) {
  editingSet.value = s.set_number
  drafts.value = {
    ...drafts.value,
    [pe.value!.id]: {
      reps: s.reps, duration_s: s.duration_s, load_kg: s.load_kg == null ? null : Number(s.load_kg), difficulty: s.difficulty,
      note: s.note ?? '', pain: s.pain, pain_note: s.pain_note ?? '', technique: (s.technique as SetDraft['technique']) ?? {},
    },
  }
}

async function validate(startedAt: number | null) {
  if (!pe.value || !ex.value) return
  saving.value = true
  const d = draft.value
  const wasEditing = editingSet.value != null
  const setNumber = nextSetNumber.value
  const prevSet = doneSets.value.at(-1)
  const input = {
    workout_session_id: id, exercise_id: pe.value.exercise_id, planned_exercise_id: isExtra(pe.value) ? null : pe.value.id, set_number: setNumber,
    reps: isDuration.value ? null : d.reps, duration_s: isDuration.value ? d.duration_s : null,
    load_kg: loaded.value ? d.load_kg : null, difficulty: d.difficulty, note: d.note.trim() || null,
    pain: d.pain, pain_note: d.pain ? d.pain_note.trim() || null : null,
    technique: Object.fromEntries(Object.entries(d.technique).filter(([, v]) => v !== '' && v != null && v !== false)),
    rest_s: !wasEditing && prevSet && startedAt ? Math.round((startedAt - Date.parse(prevSet.completed_at)) / 1000) : null,
    completed_at: wasEditing ? doneSets.value.find((s) => s.set_number === setNumber)?.completed_at : new Date().toISOString(),
  }
  try {
    const synced = await queue.record(input)
    // Mise à jour locale immédiate (même hors ligne).
    const local = { ...input, id: crypto.randomUUID(), user_id: auth.user!.id } as PerformedSet
    sets.value = [...sets.value.filter((s) => !(s.exercise_id === input.exercise_id && s.set_number === setNumber)), local]
    if (!synced) toast.error(`Série conservée sur cet appareil, mais non synchronisée${lastSyncError.value ? ` : ${lastSyncError.value}` : '.'}`)
    if (d.pain) toast.info('Douleur notée. Adaptez ou arrêtez l’exercice si besoin.')
    editingSet.value = null
    drafts.value = { ...drafts.value, [pe.value.id]: { ...d, difficulty: null, note: '', pain: false, pain_note: '' } }
    if (!wasEditing) {
      const lastOfSession = index.value === exercises.value.length - 1 && doneSets.value.length >= pe.value.sets
      if (!lastOfSession) rest.start(pe.value.rest_s || auth.profile?.rest_timer_default_s || 90)
    }
  } catch (e) {
    toast.error(e)
  } finally {
    saving.value = false
  }
}

const candidates = computed(() => {
  const inSession = new Set(exercises.value.map((e) => e.exercise_id))
  const q = search.value.trim().toLowerCase()
  return catalog.exercises.filter((e) => !inSession.has(e.id) && (!q || e.name.toLowerCase().includes(q)))
})

function addExercise(e: Exercise) {
  const duration = e.measurement === 'duration'
  extras.value = [...extras.value, {
    id: `extra-${crypto.randomUUID()}`, planned_session_id: planned.value!.id, user_id: auth.user!.id, exercise_id: e.id,
    position: exercises.value.length, sets: 2, reps_min: duration ? null : 8, reps_max: duration ? null : 12, duration_s: duration ? 30 : null,
    rest_s: e.default_rest_s, load_kg: null, notes: 'Exercice ajouté pendant la séance.',
  }]
  showAdd.value = false
  search.value = ''
  index.value = exercises.value.length - 1
}

async function removeSet(s: PerformedSet) {
  if (!confirm(`Supprimer la série ${s.set_number} ?`)) return
  try {
    await deleteSet(id, s.exercise_id, s.set_number)
    sets.value = sets.value.filter((x) => x !== s)
    editingSet.value = null
  } catch (e) { toast.error(e) }
}

const nextLabel = computed(() => {
  if (!pe.value) return ''
  if (!exerciseDone.value) return `${ex.value?.name}, série ${doneSets.value.length + 1}`
  const n = exercises.value[index.value + 1]
  return n ? catalog.byId.get(n.exercise_id)?.name ?? '' : 'fin de séance'
})

watch(exerciseDone, (d, was) => { if (d && !was) navigator.vibrate?.(80) })

const totalPlanned = computed(() => exercises.value.reduce((n, e) => n + e.sets, 0))
const totalDone = computed(() => sets.value.length)

async function complete() {
  saving.value = true
  try {
    await queue.flush().catch(() => {})
    if (queue.pending.value.some((p) => p.workout_session_id === id)) throw new Error(`Des séries ne sont pas encore synchronisées${lastSyncError.value ? ` (${lastSyncError.value})` : ''}. Vérifiez la connexion puis réessayez.`)
    await updateSession(id, {
      status: 'completed', completed_at: new Date().toISOString(),
      perceived_difficulty: finish.value.perceived_difficulty, comment: finish.value.comment.trim() || null,
    })
    rest.stop()
    localStorage.removeItem(`wwai-draft-${id}`)
    localStorage.removeItem(`wwai-extra-${id}`)
    await wake.release().catch(() => {})
    await router.replace(`/seance/${id}/bilan`)
  } catch (e) {
    toast.error(e)
  } finally {
    saving.value = false
  }
}

async function abandon() {
  try {
    await updateSession(id, { status: 'abandoned', completed_at: new Date().toISOString() })
    rest.stop()
    localStorage.removeItem(`wwai-draft-${id}`)
    localStorage.removeItem(`wwai-extra-${id}`)
    await router.replace('/')
  } catch (e) { toast.error(e) }
}
</script>

<template>
  <div v-if="session && planned && pe && ex" class="mx-auto min-h-dvh max-w-xl px-4 pb-10" style="padding-top: max(0.75rem, env(safe-area-inset-top))">
    <!-- En-tête : progression de la séance -->
    <header class="flex items-center gap-3">
      <button type="button" class="-ml-2 grid size-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Quitter la séance" @click="showQuit = true">
        <X class="size-6" aria-hidden="true" />
      </button>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold">{{ session.title }}</p>
        <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" :aria-valuenow="totalDone" :aria-valuemax="totalPlanned" aria-label="Séries réalisées">
          <div class="h-full rounded-full bg-accent transition-all" :style="{ width: `${Math.min(100, (totalDone / Math.max(totalPlanned, 1)) * 100)}%` }" />
        </div>
      </div>
      <span v-if="queue.pending.value.length" class="flex items-center gap-1 text-xs text-bad" role="status"><CloudOff class="size-4" aria-hidden="true" />{{ queue.pending.value.length }}</span>
      <AppButton size="sm" variant="secondary" @click="showFinish = true">Terminer</AppButton>
    </header>

    <!-- Liste des exercices -->
    <nav class="-mx-4 mt-4 overflow-x-auto px-4" aria-label="Exercices de la séance">
      <ol class="flex gap-2">
        <li v-for="(e, i) in exercises" :key="e.id">
          <button type="button" :aria-current="i === index ? 'step' : undefined"
            class="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition"
            :class="i === index ? 'bg-slate-ink text-chalk dark:bg-chalk dark:text-slate-ink' : exSets(e.exercise_id).length >= e.sets ? 'bg-good/15 text-good' : 'bg-surface'"
            @click="index = i">
            <span class="tabular">{{ i + 1 }}</span><span class="max-w-32 truncate">{{ catalog.byId.get(e.exercise_id)?.name }}</span>
          </button>
        </li>
        <li>
          <button type="button" class="flex h-10 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-line px-3.5 text-sm font-medium text-muted" @click="showAdd = true">
            <Plus class="size-4" aria-hidden="true" />Exercice
          </button>
        </li>
      </ol>
    </nav>

    <!-- Exercice en cours -->
    <section class="mt-4" :aria-labelledby="`ex-${pe.id}`">
      <ExerciseDemo :media="ex.exercise_media" :slug="ex.slug" compact />
      <div class="mt-4 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 :id="`ex-${pe.id}`" class="font-display text-4xl font-semibold leading-none">{{ ex.name }}</h1>
          <p class="mt-1.5 text-sm text-muted">{{ [ex.primary_muscle, ...ex.secondary_muscles].map((m) => MUSCLE_LABELS[m]).join(', ') }}</p>
        </div>
        <button type="button" class="grid size-11 shrink-0 place-items-center rounded-full bg-surface" aria-label="Instructions de l'exercice" @click="showInfo = true">
          <Info class="size-5" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-4 grid grid-cols-3 gap-2 text-center">
        <div class="rounded-2xl bg-surface p-3"><p class="text-xs text-muted">Objectif</p><p class="tabular font-display text-2xl font-semibold">{{ formatTarget(pe) }}</p></div>
        <div class="rounded-2xl bg-surface p-3"><p class="text-xs text-muted">Charge</p><p class="tabular font-display text-2xl font-semibold">{{ pe.load_kg != null ? formatKg(pe.load_kg) : loaded ? 'au choix' : '—' }}</p></div>
        <div class="rounded-2xl bg-surface p-3"><p class="text-xs text-muted">Repos</p><p class="tabular font-display text-2xl font-semibold">{{ pe.rest_s }} s</p></div>
      </div>

      <p v-if="pe.notes" class="mt-3 text-sm text-muted">{{ pe.notes }}</p>
      <p v-if="caution" class="mt-3 flex gap-2 rounded-xl bg-energy/15 p-3 text-sm"><TriangleAlert class="size-5 shrink-0" aria-hidden="true" />Zone sensible déclarée : arrêtez à la moindre douleur.</p>
      <p v-if="lastPerf" class="mt-3 rounded-xl bg-accent-soft p-3 text-sm">
        <span class="font-semibold text-accent">Dernière fois : {{ lastPerf.reps_by_set.join(' · ') }}{{ isDuration ? ' s' : '' }}<template v-if="lastPerf.max_load_kg != null"> à {{ formatKg(lastPerf.max_load_kg) }}</template>.</span>
        {{ advice?.message }}
      </p>
    </section>

    <!-- Séries réalisées -->
    <section class="mt-5" aria-label="Séries réalisées">
      <ol class="flex flex-col gap-2">
        <li v-for="n in Math.max(pe.sets, doneSets.length)" :key="n"
          class="flex h-14 items-center gap-3 rounded-2xl px-4"
          :class="doneSets.find((s) => s.set_number === n) ? 'bg-surface' : n === nextSetNumber && !editingSet ? 'border-2 border-energy' : 'border border-dashed border-line'">
          <span class="tabular w-6 font-display text-xl font-semibold text-muted">{{ n }}</span>
          <template v-if="doneSets.find((s) => s.set_number === n)">
            <span class="tabular flex-1 font-display text-2xl font-semibold">
              {{ isDuration ? `${doneSets.find((s) => s.set_number === n)!.duration_s} s` : `${doneSets.find((s) => s.set_number === n)!.reps} rép.` }}
              <span v-if="doneSets.find((s) => s.set_number === n)!.load_kg != null" class="text-base font-medium text-muted">× {{ formatKg(doneSets.find((s) => s.set_number === n)!.load_kg) }}</span>
            </span>
            <TriangleAlert v-if="doneSets.find((s) => s.set_number === n)!.pain" class="size-5 text-bad" aria-label="Douleur signalée" />
            <button type="button" class="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2" :aria-label="`Modifier la série ${n}`" @click="editSet(doneSets.find((s) => s.set_number === n)!)">
              <Pencil class="size-4" aria-hidden="true" />
            </button>
          </template>
          <span v-else class="flex-1 text-sm text-muted">{{ isDuration ? `${pe.duration_s} s` : `${pe.reps_min}–${pe.reps_max} rép.` }} prévues</span>
        </li>
      </ol>
    </section>

    <div class="mt-4">
      <template v-if="!exerciseDone || editingSet">
        <SetForm v-model="draft" :set-number="nextSetNumber" :measurement="isDuration ? 'duration' : 'reps'" :target-duration="pe.duration_s"
          :loaded="loaded" :saving="saving" :editing="editingSet != null" @validate="validate" @cancel-edit="editingSet = null" />
        <button v-if="editingSet" type="button" class="mt-3 w-full py-2 text-sm font-medium text-bad" @click="removeSet(doneSets.find((s) => s.set_number === editingSet)!)">Supprimer cette série</button>
      </template>
      <div v-else class="rounded-3xl bg-good/10 p-5 text-center">
        <p class="font-display text-2xl font-semibold text-good">Exercice terminé</p>
        <div class="mt-4 flex flex-col gap-2">
          <AppButton v-if="index < exercises.length - 1" size="lg" block @click="index = index + 1">Exercice suivant<ChevronRight class="size-5" aria-hidden="true" /></AppButton>
          <AppButton v-else size="lg" block @click="showFinish = true">Terminer la séance</AppButton>
          <AppButton variant="ghost" @click="editingSet = doneSets.length + 1">Ajouter une série</AppButton>
          <AppButton variant="ghost" @click="showAdd = true"><Plus class="size-5" aria-hidden="true" />Ajouter un exercice</AppButton>
        </div>
      </div>
    </div>

    <div class="mt-6 flex justify-between">
      <AppButton variant="ghost" :disabled="index === 0" @click="index = index - 1"><ChevronLeft class="size-5" aria-hidden="true" />Précédent</AppButton>
      <AppButton variant="ghost" :disabled="index === exercises.length - 1" @click="index = index + 1">Suivant<ChevronRight class="size-5" aria-hidden="true" /></AppButton>
    </div>

    <RestTimerOverlay v-if="rest.running.value" :remaining="rest.remaining.value" :progress="rest.progress.value" :next-label="nextLabel"
      @add="rest.add" @skip="rest.stop" />

    <BottomSheet v-model:open="showInfo" :title="ex.name">
      <ol class="flex list-decimal flex-col gap-2 pl-5">
        <li v-for="(s, i) in ex.instructions" :key="i">{{ s }}</li>
      </ol>
      <ul class="mt-4 list-disc space-y-1 rounded-xl bg-surface-2 p-4 pl-8 text-sm">
        <li v-for="(s, i) in ex.safety_tips" :key="i">{{ s }}</li>
      </ul>
    </BottomSheet>

    <BottomSheet v-model:open="showAdd" title="Ajouter un exercice" description="Vous vous sentez en forme ? Il s’ajoute à cette séance seulement, le programme reste inchangé.">
      <input v-model="search" type="search" placeholder="Rechercher…" aria-label="Rechercher un exercice" class="h-12 w-full rounded-xl border border-line bg-surface px-4 outline-none focus:border-accent">
      <ul class="mt-3 flex max-h-[50dvh] flex-col gap-2 overflow-y-auto">
        <li v-for="e in candidates" :key="e.id">
          <button type="button" class="flex min-h-14 w-full flex-col items-start rounded-xl bg-surface-2 px-4 py-2 text-left" @click="addExercise(e)">
            <span class="font-medium">{{ e.name }}</span>
            <span class="text-xs text-muted">{{ MUSCLE_LABELS[e.primary_muscle] }} · {{ e.equipment.length ? e.equipment.map((k) => EQUIPMENT_LABELS[k]).join(', ') : 'Poids du corps' }}</span>
          </button>
        </li>
        <li v-if="!candidates.length" class="text-sm text-muted">Aucun exercice trouvé.</li>
      </ul>
    </BottomSheet>

    <BottomSheet v-model:open="showFinish" title="Terminer la séance" :description="`${totalDone} séries sur ${totalPlanned} prévues.`">
      <fieldset>
        <legend class="mb-2 text-sm font-medium">Difficulté globale (1 = très facile, 10 = maximale)</legend>
        <div class="grid grid-cols-5 gap-2">
          <button v-for="d in 10" :key="d" type="button" :aria-pressed="finish.perceived_difficulty === d"
            class="tabular h-12 rounded-xl font-display text-xl font-semibold"
            :class="finish.perceived_difficulty === d ? 'bg-slate-ink text-chalk dark:bg-chalk dark:text-slate-ink' : 'bg-surface-2'"
            @click="finish.perceived_difficulty = d">{{ d }}</button>
        </div>
      </fieldset>
      <label class="mt-4 flex flex-col gap-1.5 text-sm font-medium">Commentaire personnel
        <textarea v-model="finish.comment" rows="3" class="rounded-xl border border-line bg-surface p-3 font-normal outline-none focus:border-accent" placeholder="Sensations, fatigue, contexte…" /></label>
      <AppButton size="lg" block class="mt-5" :loading="saving" @click="complete">Enregistrer et voir le bilan</AppButton>
    </BottomSheet>

    <BottomSheet v-model:open="showQuit" title="Quitter la séance ?" description="Vos séries sont enregistrées : vous pourrez reprendre plus tard.">
      <div class="flex flex-col gap-2">
        <AppButton size="lg" block @click="router.push('/')">Reprendre plus tard</AppButton>
        <AppButton variant="ghost" block class="text-bad" @click="abandon">Abandonner la séance</AppButton>
      </div>
    </BottomSheet>
  </div>
  <div v-else class="grid min-h-dvh place-items-center text-muted" aria-busy="true">Chargement de la séance…</div>
</template>
