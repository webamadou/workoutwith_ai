<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import EquipmentEditor, { type EquipmentItem } from '@/components/profile/EquipmentEditor.vue'
import ImportPanel from '@/components/profile/ImportPanel.vue'
import { getAIStatus } from '@/services/coach'
import { uploadPhoto } from '@/services/progress'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { usePlanStore } from '@/stores/plan'
import { saveEquipment } from '@/services/profile'
import { createPlan } from '@/services/program'
import { EXPERIENCE_LABELS } from '@/services/types'
import { GOAL_OPTIONS, LIMITATION_OPTIONS } from '@/lib/profileOptions'
import { saveMeasurement } from '@/services/progress'
import { useToast } from '@/composables/useToast'
import { generateInitialProgram } from '@shared/program/template'
import { DAY_SHORT, addDays, isoDayOfWeek, mondayOf, toISODate } from '@shared/dates'

const auth = useAuthStore()
const catalog = useCatalogStore()
const plan = usePlanStore()
const router = useRouter()
const toast = useToast()

const steps = ['Vous', 'Objectif', 'Rythme', 'Matériel', 'Précautions', 'Programme'] as const
const step = ref(0)
const saving = ref(false)

const today = toISODate(new Date())
const nextMonday = isoDayOfWeek(today) === 1 ? today : addDays(mondayOf(today), 7)

const f = reactive({
  height_cm: null as number | null,
  weight_kg: null as number | null,
  waist_cm: null as number | null,
  goal: GOAL_OPTIONS[0].value as string | null,
  experience_level: 'returning' as string | null,
  sessions_per_week: 3 as number | null,
  available_days: [1, 3, 5] as number[],
  session_duration_min: 45 as number | null,
  equipment: [] as EquipmentItem[],
  avoided: [] as string[],
  limitation_tags: [] as string[],
  limitations: '',
  recovery_notes: '',
  training_preferences: '',
  start: nextMonday as string,
})

const aiEnabled = ref(false)
const showImport = ref(false)
const bodyPhotos = ref<File[]>([])
onMounted(() => {
  catalog.load().catch(toast.error)
  getAIStatus().then((s) => (aiEnabled.value = s.enabled)).catch(() => {})
})

function onBodyPhotos(e: Event) {
  const input = e.target as HTMLInputElement
  bodyPhotos.value = [...bodyPhotos.value, ...[...(input.files ?? [])].filter((f) => f.size <= 10 * 1024 * 1024)].slice(0, 4)
  input.value = ''
}

async function afterImport() {
  await plan.load()
  if (auth.onboarded) await router.replace('/')
}

const dayOptions = DAY_SHORT.map((label, i) => ({ value: i + 1, label }))
const experienceOptions = Object.entries(EXPERIENCE_LABELS).map(([value, label]) => ({ value, label }))
const exerciseOptions = computed(() => catalog.exercises.map((e) => ({ value: e.slug, label: e.name })))

const preview = computed(() => catalog.exercises.length
  ? generateInitialProgram({
    exercises: catalog.infos, ownedEquipment: f.equipment.map((e) => e.equipment_key), avoidedSlugs: f.avoided, availableDays: f.available_days,
    experience: f.experience_level as never, goal: f.goal,
  })
  : null)

const canNext = computed(() => {
  if (step.value === 0) return Boolean(f.height_cm && f.weight_kg)
  if (step.value === 1) return Boolean(f.goal && f.experience_level)
  if (step.value === 2) return f.available_days.length >= 3
  return true
})

async function finish() {
  if (!preview.value || !auth.user) return
  saving.value = true
  try {
    await saveEquipment(f.equipment.map((e) => ({ equipment_key: e.equipment_key, quantity: e.quantity || 1, details: e.details.trim() || null })))
    await saveMeasurement({ measured_on: today, weight_kg: f.weight_kg, waist_cm: f.waist_cm, note: 'Mesure initiale' })
    await createPlan(preview.value.draft, f.start, catalog.bySlug)
    await auth.saveProfile({
      height_cm: f.height_cm, goal: f.goal, experience_level: f.experience_level as never,
      sessions_per_week: f.sessions_per_week, available_days: f.available_days, session_duration_min: f.session_duration_min,
      avoided_exercise_ids: f.avoided.map((s) => catalog.bySlug.get(s)!.id), limitation_tags: f.limitation_tags,
      limitations: f.limitations || null, recovery_notes: f.recovery_notes || null,
      training_preferences: f.training_preferences || null, onboarding_completed_at: new Date().toISOString(),
    })
    // Photos de référence : facultatives, privées, jamais analysées.
    for (const file of bodyPhotos.value) await uploadPhoto(auth.user.id, file, today, 'Photo de référence (onboarding)').catch(() => toast.error(`Photo non enregistrée : ${file.name}`))
    await plan.load()
    toast.success('Programme créé. Bonne reprise !')
    await router.replace('/')
  } catch (e) {
    toast.error(e)
  } finally {
    saving.value = false
  }
}

const input = 'h-12 w-full rounded-xl border border-line bg-surface px-4 outline-none focus:border-accent'
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-safe" style="padding-top: max(1.25rem, env(safe-area-inset-top))">
    <div class="flex items-center gap-3">
      <button v-if="step > 0" type="button" class="-ml-2 grid size-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Étape précédente" @click="step--">
        <ArrowLeft class="size-6" aria-hidden="true" />
      </button>
      <ol class="flex flex-1 gap-1.5" aria-label="Progression de l'inscription">
        <li v-for="(s, i) in steps" :key="s" class="h-1.5 flex-1 rounded-full" :class="i <= step ? 'bg-accent' : 'bg-line'">
          <span class="sr-only">{{ s }}{{ i === step ? ' (étape en cours)' : '' }}</span>
        </li>
      </ol>
    </div>

    <form class="flex flex-1 flex-col pt-8" @submit.prevent="step < steps.length - 1 ? canNext && step++ : finish()">
      <section v-if="step === 0" class="flex flex-col gap-5">
        <h1 class="font-display text-4xl font-semibold">Faisons connaissance</h1>
        <div class="rounded-2xl bg-surface p-4">
          <button type="button" class="text-sm font-semibold text-accent" :aria-expanded="showImport" @click="showImport = !showImport">Vous avez un ancien suivi ? Importer un fichier</button>
          <ImportPanel v-if="showImport" class="mt-3" @imported="afterImport" />
        </div>
        <p class="-mt-3 text-muted">Ces mesures servent de point de départ à votre suivi. Elles restent modifiables.</p>
        <label class="flex flex-col gap-1.5"><span class="text-sm font-medium">Taille (cm)</span>
          <input v-model.number="f.height_cm" type="number" inputmode="decimal" min="100" max="250" step="0.5" required :class="input" /></label>
        <label class="flex flex-col gap-1.5"><span class="text-sm font-medium">Poids (kg)</span>
          <input v-model.number="f.weight_kg" type="number" inputmode="decimal" min="25" max="350" step="0.1" required :class="input" /></label>
        <label class="flex flex-col gap-1.5"><span class="text-sm font-medium">Tour de taille (cm) <span class="text-muted">— facultatif</span></span>
          <input v-model.number="f.waist_cm" type="number" inputmode="decimal" min="30" max="250" step="0.5" :class="input" /></label>
        <div class="rounded-2xl border border-dashed border-line p-4">
          <p class="font-semibold">Photos de référence <span class="font-normal text-muted">— facultatif</span></p>
          <p class="mt-1 text-sm text-muted">Pour comparer visuellement plus tard. Elles restent privées et ne sont jamais analysées : aucune mesure ni estimation de masse grasse.</p>
          <label class="mt-3 flex h-11 cursor-pointer items-center justify-center rounded-xl bg-surface text-sm font-semibold">
            Ajouter des photos ({{ bodyPhotos.length }}/4)
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple class="sr-only" @change="onBodyPhotos" />
          </label>
          <ul v-if="bodyPhotos.length" class="mt-2 flex flex-wrap gap-2 text-xs">
            <li v-for="(p, i) in bodyPhotos" :key="i" class="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1">{{ p.name }}
              <button type="button" class="font-bold text-muted" :aria-label="`Retirer ${p.name}`" @click="bodyPhotos.splice(i, 1)">×</button></li>
          </ul>
        </div>
      </section>

      <section v-else-if="step === 1" class="flex flex-col gap-6">
        <h1 class="font-display text-4xl font-semibold">Votre objectif</h1>
        <ChipGroup v-model="f.goal" :options="GOAL_OPTIONS" label="Objectif principal" />
        <div>
          <h2 class="mb-2 font-semibold">Niveau d’expérience</h2>
          <ChipGroup v-model="f.experience_level" :options="experienceOptions" label="Niveau d'expérience" />
        </div>
      </section>

      <section v-else-if="step === 2" class="flex flex-col gap-6">
        <h1 class="font-display text-4xl font-semibold">Votre rythme</h1>
        <div>
          <h2 class="mb-1 font-semibold">Jours disponibles</h2>
          <p class="mb-3 text-sm text-muted">Le programme compte 3 séances par semaine : choisissez au moins 3 jours, on les espace au mieux.</p>
          <ChipGroup v-model="f.available_days" :options="dayOptions" multiple label="Jours disponibles" />
        </div>
        <label class="flex flex-col gap-1.5"><span class="text-sm font-medium">Durée d’une séance (minutes)</span>
          <input v-model.number="f.session_duration_min" type="number" min="10" max="240" step="5" :class="input" /></label>
        <label class="flex flex-col gap-1.5"><span class="text-sm font-medium">Préférences d’entraînement <span class="text-muted">— facultatif</span></span>
          <textarea v-model="f.training_preferences" rows="3" class="rounded-xl border border-line bg-surface p-4 outline-none focus:border-accent" placeholder="Ex. : séances courtes le matin, pas de saut…" /></label>
      </section>

      <section v-else-if="step === 3" class="flex flex-col gap-5">
        <h1 class="font-display text-4xl font-semibold">Votre matériel</h1>
        <p class="-mt-3 text-muted">Les exercices impossibles sans ce matériel seront remplacés.</p>
        <EquipmentEditor v-model="f.equipment" :ai-enabled="aiEnabled" />
      </section>

      <section v-else-if="step === 4" class="flex flex-col gap-6">
        <h1 class="font-display text-4xl font-semibold">Précautions</h1>
        <div>
          <h2 class="mb-1 font-semibold">Zones sensibles</h2>
          <p class="mb-3 text-sm text-muted">Les exercices concernés afficheront un rappel de vigilance.</p>
          <ChipGroup v-model="f.limitation_tags" :options="LIMITATION_OPTIONS" multiple label="Zones sensibles" />
        </div>
        <label class="flex flex-col gap-1.5"><span class="text-sm font-medium">Limitations ou antécédents <span class="text-muted">— facultatif</span></span>
          <textarea v-model="f.limitations" rows="3" class="rounded-xl border border-line bg-surface p-4 outline-none focus:border-accent" placeholder="Ex. : antécédents de douleurs abdominales" /></label>
        <p v-if="f.limitation_tags.length || f.limitations" class="rounded-xl bg-energy/15 p-4 text-sm">
          Évitez tout exercice qui déclenche une douleur. En cas de douleur persistante ou inhabituelle, consultez un médecin ou un kinésithérapeute avant de poursuivre.
        </p>
        <div>
          <h2 class="mb-2 font-semibold">Exercices à éviter <span class="font-normal text-muted">— facultatif</span></h2>
          <ChipGroup v-model="f.avoided" :options="exerciseOptions" multiple label="Exercices à éviter" />
        </div>
        <label class="flex flex-col gap-1.5"><span class="text-sm font-medium">Récupération <span class="text-muted">— facultatif</span></span>
          <textarea v-model="f.recovery_notes" rows="2" class="rounded-xl border border-line bg-surface p-4 outline-none focus:border-accent" placeholder="Ex. : sommeil court en semaine, travail debout" /></label>
      </section>

      <section v-else class="flex flex-col gap-5">
        <h1 class="font-display text-4xl font-semibold">Votre programme</h1>
        <div v-if="preview" class="rounded-2xl bg-surface p-5">
          <p class="font-display text-2xl font-semibold">{{ preview.draft.name }}</p>
          <p class="mt-1 text-sm text-muted">8 semaines · semaines 1–2 en reprise progressive, semaine 8 allégée.</p>
          <ul class="mt-4 flex flex-col gap-3">
            <li v-for="s in preview.draft.sessions.filter((s) => s.week_number === 1)" :key="s.day_of_week">
              <p class="font-semibold">{{ DAY_SHORT[s.day_of_week - 1] }} — {{ s.title }}</p>
              <p class="text-sm text-muted">{{ s.exercises.map((e) => catalog.bySlug.get(e.exercise_slug)?.name).join(', ') }}</p>
            </li>
          </ul>
          <ul v-if="preview.substitutions.length" class="mt-4 space-y-1 border-t border-line pt-3 text-sm text-muted">
            <li v-for="s in preview.substitutions" :key="s.from">
              {{ catalog.bySlug.get(s.from)?.name }} → {{ s.to ? catalog.bySlug.get(s.to)?.name : 'retiré' }} ({{ s.reason }})
            </li>
          </ul>
        </div>
        <fieldset>
          <legend class="mb-2 font-semibold">Début du programme</legend>
          <ChipGroup v-model="f.start" label="Début du programme" :options="[
            { value: nextMonday, label: nextMonday === today ? 'Aujourd’hui' : 'Lundi prochain', hint: nextMonday },
            ...(nextMonday === today ? [] : [{ value: today, label: 'Cette semaine', hint: 'les séances déjà passées sont ignorées' }]),
          ]" />
        </fieldset>
      </section>

      <div class="sticky bottom-0 mt-auto bg-bg py-5">
        <AppButton type="submit" size="lg" block :disabled="!canNext || (step === steps.length - 1 && !preview)" :loading="saving">
          {{ step < steps.length - 1 ? 'Continuer' : 'Créer mon programme' }}
        </AppButton>
      </div>
    </form>
  </div>
</template>
