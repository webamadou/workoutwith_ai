<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import { useCatalogStore } from '@/stores/catalog'
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/services/types'
import { useToast } from '@/composables/useToast'

const catalog = useCatalogStore()
const toast = useToast()
const muscle = ref<string>('')
const q = ref('')
onMounted(() => catalog.load().catch(toast.error))

const muscles = computed(() => [{ value: '', label: 'Tous' }, ...[...new Set(catalog.exercises.map((e) => e.primary_muscle))].map((m) => ({ value: m, label: MUSCLE_LABELS[m] ?? m }))])
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const list = computed(() => catalog.exercises.filter((e) => (!muscle.value || e.primary_muscle === muscle.value) && norm(e.name).includes(norm(q.value))))
</script>

<template>
  <div>
    <PageHeader title="Exercices" subtitle="Bibliothèque de référence" back="/programme" />
    <label class="mb-4 block">
      <span class="sr-only">Rechercher un exercice</span>
      <input v-model="q" type="search" placeholder="Rechercher" class="h-12 w-full rounded-xl border border-line bg-surface px-4 outline-none focus:border-accent" />
    </label>
    <ChipGroup v-model="muscle" :options="muscles" label="Filtrer par groupe musculaire" class="mb-5" />
    <ul class="grid gap-3 sm:grid-cols-2">
      <li v-for="e in list" :key="e.id">
        <RouterLink :to="`/exercices/${e.slug}`" class="block rounded-2xl bg-surface p-4 transition hover:ring-2 hover:ring-accent/40">
          <p class="font-semibold">{{ e.name }}</p>
          <p class="mt-0.5 text-sm text-muted">
            {{ MUSCLE_LABELS[e.primary_muscle] }} · {{ e.equipment.length ? e.equipment.map((k) => EQUIPMENT_LABELS[k] ?? k).join(', ') : 'Poids du corps' }}
          </p>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
