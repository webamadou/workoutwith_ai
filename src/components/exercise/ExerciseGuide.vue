<script setup lang="ts">
import { computed } from 'vue'
import { Check, X } from 'lucide-vue-next'
import type { ExerciseDemoDef } from '@shared/exercises/demos'
import { EQUIPMENT_LABELS } from '@/services/types'

const props = defineProps<{ demo: ExerciseDemoDef; owned: string[] }>()
const VIEW = { face: 'de face', profil: 'de profil', 'trois-quarts': 'de trois quarts' } as const
const alternatives = computed(() => props.demo.alternatives.map((a) => ({ ...a, available: a.requires.every((k) => props.owned.includes(k)) })))
</script>

<template>
  <div>
    <p class="mt-4 font-medium leading-relaxed">{{ demo.summary }}</p>
    <p class="mt-1 text-xs text-muted">Vue {{ VIEW[demo.view] }} · Photos : {{ demo.credit.author }}, {{ demo.credit.license }}</p>

    <section class="mt-5" aria-labelledby="key-points">
      <h2 id="key-points" class="font-display text-2xl font-semibold">Points techniques</h2>
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="p in demo.keyPoints" :key="p" class="flex gap-2.5"><Check class="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" /><span>{{ p }}</span></li>
      </ul>
    </section>

    <section class="mt-5" aria-labelledby="mistakes">
      <h2 id="mistakes" class="font-display text-2xl font-semibold">Erreurs fréquentes</h2>
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="m in demo.mistakes" :key="m" class="flex gap-2.5"><X class="mt-0.5 size-5 shrink-0 text-energy" aria-hidden="true" /><span>{{ m }}</span></li>
      </ul>
    </section>

    <section class="mt-5" aria-labelledby="alts">
      <h2 id="alts" class="font-display text-2xl font-semibold">Selon votre matériel</h2>
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="a in alternatives" :key="a.label" class="rounded-xl bg-surface p-3" :class="{ 'opacity-60': !a.available }">
          <p class="font-medium">{{ a.label }}
            <span class="ml-1 text-xs font-normal text-muted">{{ a.requires.length ? a.requires.map((k) => EQUIPMENT_LABELS[k]).join(', ') : 'Sans matériel' }}{{ a.available ? '' : ' · non disponible' }}</span>
          </p>
          <p class="mt-0.5 text-sm text-muted">{{ a.note }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>
