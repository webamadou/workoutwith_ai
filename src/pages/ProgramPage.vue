<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { History, Library, Pencil } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import PlannedExerciseEditor from '@/components/workout/PlannedExerciseEditor.vue'
import { useCatalogStore } from '@/stores/catalog'
import { usePlanStore } from '@/stores/plan'
import { fetchPlanVersions } from '@/services/program'
import type { PlannedExercise, PlannedSession, PlanVersion } from '@/services/types'
import { useToast } from '@/composables/useToast'
import { formatShort, formatTarget, formatKg } from '@/lib/format'
import { DAY_LABELS } from '@shared/dates'
import { SLOT_BADGE, SLOT_LABELS } from '@/lib/status'
import { PHASE_LABELS, phaseOfWeek } from '@shared/program/template'

const catalog = useCatalogStore()
const plan = usePlanStore()
const toast = useToast()

const week = ref(1)
const versions = ref<PlanVersion[]>([])
const showHistory = ref(false)
const editing = ref<{ session: PlannedSession; exercise: PlannedExercise } | null>(null)

onMounted(async () => {
  try {
    await Promise.all([plan.load(), catalog.load()])
    week.value = plan.currentWeek
  } catch (e) { toast.error(e) }
})

watch(showHistory, async (open) => {
  if (open && plan.active) versions.value = await fetchPlanVersions(plan.active.plan.id).catch((e) => (toast.error(e), []))
})

const weeks = computed(() => Array.from({ length: plan.active?.plan.weeks ?? 0 }, (_, i) => i + 1))
const sessions = computed(() => plan.active?.sessions.filter((s) => s.week_number === week.value) ?? [])
const statusOf = (s: PlannedSession) => plan.schedule.find((x) => x.slot.week_number === s.week_number && x.slot.day_of_week === s.day_of_week)
const sourceLabel: Record<string, string> = { template: 'Création', user: 'Modifié par vous', coach: 'Proposé par le coach', rules: 'Suggestion automatique acceptée' }
</script>

<template>
  <div>
    <PageHeader title="Programme" :subtitle="plan.active?.plan.name">
      <div class="flex gap-1">
        <RouterLink to="/exercices" class="grid size-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Bibliothèque d'exercices"><Library class="size-5" aria-hidden="true" /></RouterLink>
        <button v-if="plan.active" type="button" class="grid size-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Historique des versions" @click="showHistory = true"><History class="size-5" aria-hidden="true" /></button>
      </div>
    </PageHeader>

    <template v-if="plan.active">
      <div class="-mx-4 mb-5 overflow-x-auto px-4" role="tablist" aria-label="Semaines">
        <div class="flex gap-2">
          <button
            v-for="w in weeks" :key="w" type="button" role="tab" :aria-selected="w === week"
            class="flex h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-2xl px-3 transition"
            :class="w === week ? 'bg-slate-ink text-chalk dark:bg-chalk dark:text-slate-ink' : 'bg-surface text-ink'"
            @click="week = w"
          >
            <span class="text-[11px] opacity-70">Sem.</span>
            <span class="tabular font-display text-xl font-semibold leading-none">{{ w }}</span>
          </button>
        </div>
      </div>

      <p class="mb-4 text-sm text-muted">
        <span class="font-semibold text-ink">{{ PHASE_LABELS[phaseOfWeek(week, plan.active.plan.weeks)] }}</span>
        <template v-if="week === plan.currentWeek"> — semaine en cours</template>
        · version {{ plan.active.version.version_number }}
      </p>

      <div class="flex flex-col gap-4">
        <section v-for="s in sessions" :key="s.id" class="rounded-2xl bg-surface p-5" :aria-labelledby="`s-${s.id}`">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm text-muted">{{ DAY_LABELS[s.day_of_week - 1] }}<template v-if="statusOf(s)"> · {{ formatShort(statusOf(s)!.date) }}</template></p>
              <h2 :id="`s-${s.id}`" class="font-display text-2xl font-semibold">{{ s.title }}</h2>
            </div>
            <span v-if="statusOf(s)" class="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold"
              :class="SLOT_BADGE[statusOf(s)!.status]">
              {{ SLOT_LABELS[statusOf(s)!.status] }}
            </span>
          </div>
          <ol class="mt-3 divide-y divide-line">
            <li v-for="e in s.planned_exercises" :key="e.id" class="flex items-center gap-3 py-2.5">
              <RouterLink :to="`/exercices/${catalog.byId.get(e.exercise_id)?.slug}`" class="min-w-0 flex-1">
                <span class="block truncate font-medium">{{ catalog.byId.get(e.exercise_id)?.name }}</span>
                <span class="block text-sm text-muted">
                  {{ formatTarget(e) }} · repos {{ e.rest_s }} s<template v-if="e.load_kg != null"> · {{ formatKg(e.load_kg) }}</template>
                </span>
              </RouterLink>
              <button type="button" class="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
                :aria-label="`Modifier ${catalog.byId.get(e.exercise_id)?.name}`" @click="editing = { session: s, exercise: e }">
                <Pencil class="size-4" aria-hidden="true" />
              </button>
            </li>
          </ol>
        </section>
      </div>
    </template>

    <EmptyState v-else-if="plan.loaded" title="Aucun programme actif" text="Générez un programme depuis votre profil.">
      <AppButton @click="$router.push('/profil#programme')">Aller au profil</AppButton>
    </EmptyState>

    <BottomSheet v-model:open="showHistory" title="Historique des versions" description="Chaque modification crée une nouvelle version ; les précédentes sont conservées.">
      <ol class="flex flex-col gap-3">
        <li v-for="v in versions" :key="v.id" class="rounded-xl bg-surface-2 p-4">
          <p class="font-semibold">Version {{ v.version_number }} <span class="font-normal text-muted">· {{ sourceLabel[v.source] }}</span></p>
          <p class="mt-1 text-sm">{{ v.change_summary }}</p>
          <p class="mt-1 text-xs text-muted">{{ formatShort(v.created_at) }}</p>
        </li>
      </ol>
    </BottomSheet>

    <PlannedExerciseEditor v-if="editing" :session="editing.session" :exercise="editing.exercise" @close="editing = null" />
  </div>
</template>
