<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown, X } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import { useCatalogStore } from '@/stores/catalog'
import { usePlanStore } from '@/stores/plan'
import { useAuthStore } from '@/stores/auth'
import { createVersion, fetchActivePlan, fetchPlanVersions, toDraft } from '@/services/program'
import { fetchEquipment } from '@/services/profile'
import { rejectRecommendation } from '@/services/coach'
import { supabase } from '@/lib/supabase'
import type { Recommendation } from '@/services/types'
import { useToast } from '@/composables/useToast'
import { formatShort } from '@/lib/format'
import { adjustmentListSchema, applyAdjustments, checkAdjustments, describeAdjustment } from '@shared/program/adjustments'

const props = defineProps<{ rec: Recommendation }>()
const emit = defineEmits<{ updated: [rec: Recommendation] }>()
const catalog = useCatalogStore()
const plan = usePlanStore()
const auth = useAuthStore()
const toast = useToast()
const busy = ref<'accept' | 'reject' | null>(null)
const showWhy = ref(false)

const names = computed(() => new Map(catalog.exercises.map((e) => [e.slug, e.name])))
const parsed = computed(() => adjustmentListSchema.safeParse(props.rec.adjustments))
const adjustments = computed(() => (parsed.value.success ? parsed.value.data : []))
const details = computed(() => props.rec.details as { highlights?: string[]; difficulties?: string[]; next_steps?: string[] })
const statusLabel: Record<string, string> = { pending: 'En attente', accepted: 'Acceptée', rejected: 'Refusée', superseded: 'Remplacée' }

async function accept() {
  busy.value = 'accept'
  try {
    const active = await fetchActivePlan()
    if (!active) throw new Error('Aucun programme actif.')
    await catalog.load()
    const current = toDraft(active, catalog.byId)
    const versions = await fetchPlanVersions(active.plan.id)
    const lastCoach = versions.find((v) => v.source === 'coach')?.created_at
    const owned = (await fetchEquipment()).map((e) => e.equipment_key)
    const avoided = (auth.profile?.avoided_exercise_ids ?? []).map((i) => catalog.byId.get(i)?.slug).filter(Boolean) as string[]
    // Les garde-fous sont revérifiés au moment de l'acceptation (le programme a pu changer).
    const check = checkAdjustments(current, adjustments.value, catalog.infos, {
      currentWeek: plan.currentWeek, lastCoachChangeAt: lastCoach, ownedEquipment: owned, avoidedSlugs: avoided,
    })
    if (!check.ok) throw new Error(`Ajustement bloqué par les garde-fous : ${check.violations.join(' ')}`)
    const next = applyAdjustments(current, adjustments.value, catalog.infos)
    const summary = `${props.rec.title} — ${adjustments.value.map((a) => describeAdjustment(a, names.value)).join(' ; ')}`
    await createVersion(active.plan.id, next, catalog.bySlug, props.rec.source === 'rules' ? 'rules' : 'coach', summary, props.rec.id)
    // Les autres propositions en attente sur les mêmes exercices deviennent caduques.
    for (const slug of new Set(adjustments.value.map((a) => a.exercise_slug))) {
      await supabase.from('coach_recommendations').update({ status: 'superseded', decided_at: new Date().toISOString() })
        .eq('status', 'pending').neq('id', props.rec.id).filter('adjustments', 'cs', JSON.stringify([{ exercise_slug: slug }]))
    }
    await plan.load()
    toast.success('Programme mis à jour.')
    emit('updated', { ...props.rec, status: 'accepted', decided_at: new Date().toISOString() })
  } catch (e) {
    toast.error(e)
  } finally {
    busy.value = null
  }
}

async function reject() {
  busy.value = 'reject'
  try {
    emit('updated', await rejectRecommendation(props.rec.id))
  } catch (e) {
    toast.error(e)
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <article class="rounded-2xl border border-line bg-surface p-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs text-muted">{{ rec.kind === 'session_analysis' ? 'Analyse de séance' : rec.source === 'rules' ? 'Suggestion automatique' : 'Ajustement proposé' }} · {{ formatShort(rec.created_at) }}</p>
        <h3 class="mt-0.5 font-semibold">{{ rec.title }}</h3>
      </div>
      <span v-if="adjustments.length" class="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold"
        :class="{ 'bg-energy/25': rec.status === 'pending', 'bg-good/15 text-good': rec.status === 'accepted', 'bg-surface-2 text-muted': rec.status === 'rejected' || rec.status === 'superseded' }">
        {{ statusLabel[rec.status] }}
      </span>
    </div>
    <p class="mt-2 whitespace-pre-line text-sm leading-relaxed">{{ rec.summary }}</p>

    <div v-if="details.highlights?.length || details.difficulties?.length" class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
      <div v-if="details.highlights?.length"><p class="font-semibold text-good">Points forts</p><ul class="mt-1 list-disc pl-5"><li v-for="(h, i) in details.highlights" :key="i">{{ h }}</li></ul></div>
      <div v-if="details.difficulties?.length"><p class="font-semibold text-bad">Difficultés</p><ul class="mt-1 list-disc pl-5"><li v-for="(h, i) in details.difficulties" :key="i">{{ h }}</li></ul></div>
    </div>

    <div v-if="adjustments.length" class="mt-4 rounded-xl bg-accent-soft p-4">
      <p class="text-sm font-semibold text-accent">Modifications du programme</p>
      <ul class="mt-1.5 list-disc space-y-1 pl-5 text-sm">
        <li v-for="(a, i) in adjustments" :key="i">{{ describeAdjustment(a, names) }}</li>
      </ul>
    </div>

    <button v-if="rec.rationale" type="button" class="mt-3 flex items-center gap-1 text-sm font-medium text-accent" :aria-expanded="showWhy" @click="showWhy = !showWhy">
      Pourquoi ?<ChevronDown class="size-4 transition" :class="showWhy && 'rotate-180'" aria-hidden="true" />
    </button>
    <p v-if="showWhy" class="mt-2 whitespace-pre-line text-sm text-muted">{{ rec.rationale }}</p>

    <div v-if="adjustments.length && rec.status === 'pending'" class="mt-4 flex gap-2">
      <AppButton class="flex-1" :loading="busy === 'accept'" :disabled="busy !== null" @click="accept"><Check class="size-5" aria-hidden="true" />Accepter</AppButton>
      <AppButton variant="secondary" class="flex-1" :loading="busy === 'reject'" :disabled="busy !== null" @click="reject"><X class="size-5" aria-hidden="true" />Refuser</AppButton>
    </div>
    <p v-if="rec.source === 'rules'" class="mt-3 text-xs text-muted">Proposé par les règles de progression de l’application, à partir de vos données enregistrées.</p>
    <p v-else-if="rec.provider" class="mt-3 text-xs text-muted">Généré par {{ rec.provider === 'openai' ? 'OpenAI' : 'Anthropic' }} ({{ rec.model }}) à partir de vos données enregistrées.</p>
  </article>
</template>
