<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { Camera, Trash2 } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TrendChart from '@/components/progress/TrendChart.vue'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { usePlanStore } from '@/stores/plan'
import { fetchSets } from '@/services/workout'
import { deleteMeasurement, deletePhoto, fetchMeasurements, fetchPhotos, saveMeasurement, uploadPhoto } from '@/services/progress'
import { MUSCLE_LABELS, type Measurement, type PerformedSet, type ProgressPhoto } from '@/services/types'
import { useToast } from '@/composables/useToast'
import { formatDay, formatDuration, formatShort } from '@/lib/format'
import { exerciseHistory, volumeByMuscle, weeklyStats } from '@shared/progression/engine'
import { toISODate } from '@shared/dates'

const route = useRoute()
const auth = useAuthStore()
const catalog = useCatalogStore()
const plan = usePlanStore()
const toast = useToast()

const tab = ref(route.hash === '#mesures' ? 'mesures' : 'apercu')
const sets = ref<PerformedSet[]>([])
const measurements = ref<Measurement[]>([])
const photos = ref<(ProgressPhoto & { url: string | null })[]>([])
const photosLoaded = ref(false)
const saving = ref(false)
const uploading = ref(false)
const m = reactive({ measured_on: toISODate(new Date()), weight_kg: null as number | null, waist_cm: null as number | null, note: '' })
const focusSlug = ref('pompes')

onMounted(async () => {
  try {
    const [, , s, ms] = await Promise.all([plan.load(), catalog.load(), fetchSets(), fetchMeasurements()])
    sets.value = s
    measurements.value = ms
    // Exercice suivi par défaut : pompes si pratiquées, sinon le plus fréquent.
    if (!s.some((x) => catalog.byId.get(x.exercise_id)?.slug === 'pompes') && s.length) focusSlug.value = catalog.byId.get(s.at(-1)!.exercise_id)?.slug ?? 'pompes'
  } catch (e) { toast.error(e) }
})

async function loadPhotos() {
  if (photosLoaded.value) return
  try { photos.value = await fetchPhotos(); photosLoaded.value = true } catch (e) { toast.error(e) }
}

const completedIds = computed(() => new Set(plan.completed.map((s) => s.id)))
const doneSets = computed(() => sets.value.filter((s) => completedIds.value.has(s.workout_session_id)))
const weeks = computed(() => weeklyStats(plan.sessions as never, doneSets.value as never, 8))
const weekLabels = computed(() => weeks.value.map((w) => formatShort(w.week_start)))
const regularity = computed(() => {
  const target = auth.profile?.sessions_per_week ?? 3
  const recent = weeks.value.slice(-4)
  return { target, avg: Math.round((recent.reduce((n, w) => n + w.sessions, 0) / recent.length) * 10) / 10, weeksOnTarget: recent.filter((w) => w.sessions >= target).length }
})

const muscleVolume = computed(() => {
  const since = Date.now() - 28 * 86_400_000
  const v = volumeByMuscle(doneSets.value.filter((s) => Date.parse(s.completed_at) >= since) as never, catalog.byId)
  return Object.entries(v).sort((a, b) => b[1] - a[1])
})

const practiced = computed(() => [...new Set(doneSets.value.map((s) => s.exercise_id))].map((id) => catalog.byId.get(id)!).filter(Boolean))
const focus = computed(() => catalog.bySlug.get(focusSlug.value))
const focusHistory = computed(() => (focus.value ? exerciseHistory(doneSets.value as never, focus.value.id) : []))

const series = (key: 'weight_kg' | 'waist_cm') => measurements.value.filter((x) => x[key] != null)
const journal = computed(() => plan.sessions.filter((s) => s.status === 'completed' || s.status === 'abandoned'))

async function addMeasurement() {
  if (m.weight_kg == null && m.waist_cm == null) return toast.error('Renseignez le poids ou le tour de taille.')
  saving.value = true
  try {
    const saved = await saveMeasurement({ measured_on: m.measured_on, weight_kg: m.weight_kg, waist_cm: m.waist_cm, note: m.note || null })
    measurements.value = [...measurements.value.filter((x) => x.id !== saved.id && x.measured_on !== saved.measured_on), saved]
      .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
    m.weight_kg = null; m.waist_cm = null; m.note = ''
    toast.success('Mesure enregistrée.')
  } catch (e) { toast.error(e) } finally { saving.value = false }
}

async function removeMeasurement(x: Measurement) {
  if (!confirm(`Supprimer la mesure du ${formatShort(x.measured_on)} ?`)) return
  try { await deleteMeasurement(x.id); measurements.value = measurements.value.filter((y) => y.id !== x.id) } catch (e) { toast.error(e) }
}

async function onPhoto(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !auth.user) return
  if (file.size > 10 * 1024 * 1024) return toast.error('Photo trop lourde (10 Mo maximum).')
  uploading.value = true
  try {
    await uploadPhoto(auth.user.id, file, toISODate(new Date()))
    photosLoaded.value = false
    await loadPhotos()
  } catch (err) { toast.error(err) } finally { uploading.value = false; input.value = '' }
}

async function removePhoto(p: ProgressPhoto) {
  if (!confirm('Supprimer définitivement cette photo ?')) return
  try { await deletePhoto(p.id, p.storage_path); photos.value = photos.value.filter((x) => x.id !== p.id) } catch (e) { toast.error(e) }
}

const tabClass = 'h-10 flex-1 rounded-lg text-sm font-semibold text-muted data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm'
const input = 'h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent'
</script>

<template>
  <div>
    <PageHeader title="Progression" />
    <TabsRoot v-model="tab" @update:model-value="(v) => v === 'photos' && loadPhotos()">
      <TabsList class="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1" aria-label="Sections de progression">
        <TabsTrigger value="apercu" :class="tabClass">Aperçu</TabsTrigger>
        <TabsTrigger value="journal" :class="tabClass">Journal</TabsTrigger>
        <TabsTrigger value="mesures" :class="tabClass">Mesures</TabsTrigger>
        <TabsTrigger value="photos" :class="tabClass">Photos</TabsTrigger>
      </TabsList>

      <TabsContent value="apercu" class="flex flex-col gap-4">
        <section class="rounded-2xl bg-surface p-5" aria-labelledby="freq">
          <h2 id="freq" class="font-semibold">Séances par semaine</h2>
          <p class="mt-0.5 text-sm text-muted">Moyenne sur 4 semaines : {{ regularity.avg.toLocaleString('fr-FR') }} pour un objectif de {{ regularity.target }} · {{ regularity.weeksOnTarget }}/4 semaines à l’objectif</p>
          <TrendChart class="mt-3" type="bar" :labels="weekLabels" :series="[{ label: 'Séances', data: weeks.map((w) => w.sessions) }]" :height="170"
            :summary="`Séances par semaine sur 8 semaines : ${weeks.map((w) => w.sessions).join(', ')}`" />
        </section>

        <section class="rounded-2xl bg-surface p-5" aria-labelledby="vol">
          <h2 id="vol" class="font-semibold">Volume d’entraînement</h2>
          <p class="mt-0.5 text-sm text-muted">Séries et répétitions par semaine</p>
          <TrendChart class="mt-3" :labels="weekLabels" :series="[{ label: 'Séries', data: weeks.map((w) => w.sets) }, { label: 'Répétitions ÷ 10', data: weeks.map((w) => Math.round(w.reps / 10)) }]"
            :summary="`Séries par semaine : ${weeks.map((w) => w.sets).join(', ')}`" />
        </section>

        <section class="rounded-2xl bg-surface p-5" aria-labelledby="ex-prog">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ex-prog" class="font-semibold">Progression par exercice</h2>
            <label class="text-sm"><span class="sr-only">Exercice</span>
              <select v-model="focusSlug" class="h-10 rounded-lg border border-line bg-surface px-2">
                <option v-for="e in practiced.length ? practiced : catalog.exercises.filter((x) => x.slug === 'pompes')" :key="e.id" :value="e.slug">{{ e.name }}</option>
              </select>
            </label>
          </div>
          <template v-if="focusHistory.length">
            <TrendChart class="mt-3" :labels="focusHistory.map((h) => formatShort(h.date))"
              :series="[
                { label: focus?.measurement === 'duration' ? 'Durée totale (s)' : 'Répétitions totales', data: focusHistory.map((h) => focus?.measurement === 'duration' ? h.total_duration_s : h.total_reps) },
                ...(focusHistory.some((h) => h.max_load_kg != null) ? [{ label: 'Charge max (kg)', data: focusHistory.map((h) => h.max_load_kg) }] : []),
              ]"
              :summary="`Progression ${focus?.name} : ${focusHistory.map((h) => h.total_reps).join(', ')}`" />
            <RouterLink :to="`/exercices/${focusSlug}`" class="mt-3 inline-block text-sm font-medium text-accent">Historique détaillé</RouterLink>
          </template>
          <p v-else class="mt-3 text-sm text-muted">Pas encore de séance enregistrée pour cet exercice.</p>
        </section>

        <section class="rounded-2xl bg-surface p-5" aria-labelledby="mus">
          <h2 id="mus" class="font-semibold">Volume par groupe musculaire</h2>
          <p class="mt-0.5 text-sm text-muted">Séries sur 28 jours (secondaires comptés pour moitié)</p>
          <TrendChart v-if="muscleVolume.length" class="mt-3" type="bar" :labels="muscleVolume.map(([k]) => MUSCLE_LABELS[k] ?? k)" :series="[{ label: 'Séries', data: muscleVolume.map(([, v]) => v) }]"
            :summary="muscleVolume.map(([k, v]) => `${MUSCLE_LABELS[k]} ${v}`).join(', ')" />
          <p v-else class="mt-3 text-sm text-muted">Aucune série sur la période.</p>
        </section>

        <section class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-2xl bg-surface p-5">
            <h2 class="font-semibold">Poids</h2>
            <TrendChart v-if="series('weight_kg').length > 1" class="mt-3" :height="160" unit="kg" :labels="series('weight_kg').map((x) => formatShort(x.measured_on))"
              :series="[{ label: 'Poids', data: series('weight_kg').map((x) => Number(x.weight_kg)) }]" summary="Évolution du poids" />
            <p v-else class="mt-2 text-sm text-muted">Ajoutez au moins deux mesures pour voir une courbe.</p>
          </div>
          <div class="rounded-2xl bg-surface p-5">
            <h2 class="font-semibold">Tour de taille</h2>
            <TrendChart v-if="series('waist_cm').length > 1" class="mt-3" :height="160" unit="cm" :labels="series('waist_cm').map((x) => formatShort(x.measured_on))"
              :series="[{ label: 'Tour de taille', data: series('waist_cm').map((x) => Number(x.waist_cm)) }]" summary="Évolution du tour de taille" />
            <p v-else class="mt-2 text-sm text-muted">Ajoutez au moins deux mesures pour voir une courbe.</p>
          </div>
        </section>
        <p class="text-sm text-muted">Le poids n’est qu’un indicateur parmi d’autres : régularité, tour de taille et performances comptent autant.</p>
      </TabsContent>

      <TabsContent value="journal">
        <ul v-if="journal.length" class="flex flex-col gap-2">
          <li v-for="s in journal" :key="s.id">
            <RouterLink :to="s.status === 'completed' ? `/seance/${s.id}/bilan` : `/seance/${s.id}/bilan`" class="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4">
              <span>
                <span class="block font-semibold">{{ s.title }}</span>
                <span class="text-sm text-muted">{{ formatDay(s.started_at ?? s.created_at) }}<template v-if="s.planned_sessions"> · semaine {{ s.planned_sessions.week_number }}</template></span>
              </span>
              <span class="shrink-0 text-right text-sm">
                <span v-if="s.status === 'abandoned'" class="text-bad">Abandonnée</span>
                <span v-else class="text-muted">{{ formatDuration(s.started_at && s.completed_at ? (Date.parse(s.completed_at) - Date.parse(s.started_at)) / 1000 : null) }}</span>
                <span v-if="s.perceived_difficulty" class="block text-xs text-muted">difficulté {{ s.perceived_difficulty }}/10</span>
              </span>
            </RouterLink>
          </li>
        </ul>
        <EmptyState v-else title="Journal vide" text="Vos séances terminées apparaîtront ici." />
      </TabsContent>

      <TabsContent value="mesures" class="flex flex-col gap-4">
        <form class="rounded-2xl bg-surface p-5" @submit.prevent="addMeasurement">
          <h2 class="font-semibold">Nouvelle mesure</h2>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <label class="col-span-2 flex flex-col gap-1 text-sm font-medium">Date<input v-model="m.measured_on" type="date" required :max="toISODate(new Date())" :class="input" /></label>
            <label class="flex flex-col gap-1 text-sm font-medium">Poids (kg)<input v-model.number="m.weight_kg" type="number" step="0.1" min="25" max="350" inputmode="decimal" :class="input" /></label>
            <label class="flex flex-col gap-1 text-sm font-medium">Tour de taille (cm)<input v-model.number="m.waist_cm" type="number" step="0.5" min="30" max="250" inputmode="decimal" :class="input" /></label>
            <label class="col-span-2 flex flex-col gap-1 text-sm font-medium">Note<input v-model="m.note" :class="input" placeholder="ex. : mesuré le matin à jeun" /></label>
          </div>
          <AppButton type="submit" block class="mt-4" :loading="saving">Enregistrer la mesure</AppButton>
        </form>
        <ul class="divide-y divide-line rounded-2xl bg-surface px-4">
          <li v-for="x in [...measurements].reverse()" :key="x.id" class="flex items-center justify-between gap-3 py-3">
            <span><span class="block font-medium">{{ formatDay(x.measured_on) }}</span><span v-if="x.note" class="text-sm text-muted">{{ x.note }}</span></span>
            <span class="tabular ml-auto text-right">{{ x.weight_kg != null ? `${Number(x.weight_kg)} kg` : '' }}<span class="block text-sm text-muted">{{ x.waist_cm != null ? `${Number(x.waist_cm)} cm` : '' }}</span></span>
            <button type="button" class="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2" :aria-label="`Supprimer la mesure du ${x.measured_on}`" @click="removeMeasurement(x)"><Trash2 class="size-4" aria-hidden="true" /></button>
          </li>
        </ul>
      </TabsContent>

      <TabsContent value="photos">
        <p class="mb-4 text-sm text-muted">Vos photos sont privées : stockées dans votre espace personnel, visibles par vous seul, et jamais analysées automatiquement.</p>
        <label class="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-ink" :class="uploading && 'opacity-60'">
          <Camera class="size-5" aria-hidden="true" />{{ uploading ? 'Envoi…' : 'Ajouter une photo' }}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" class="sr-only" :disabled="uploading" @change="onPhoto" />
        </label>
        <ul class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <li v-for="p in photos" :key="p.id" class="group relative overflow-hidden rounded-2xl bg-surface-2">
            <img v-if="p.url" :src="p.url" :alt="`Photo de progression du ${formatShort(p.taken_on)}`" class="aspect-[3/4] w-full object-cover" loading="lazy" />
            <div class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 p-2 text-sm text-white">
              {{ formatShort(p.taken_on) }}
              <button type="button" class="grid size-9 place-items-center rounded-full bg-black/40" aria-label="Supprimer la photo" @click="removePhoto(p)"><Trash2 class="size-4" aria-hidden="true" /></button>
            </div>
          </li>
        </ul>
      </TabsContent>
    </TabsRoot>
  </div>
</template>
