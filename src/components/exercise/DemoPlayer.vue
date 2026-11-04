<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { Pause, Play, RotateCcw } from 'lucide-vue-next'
import type { ExerciseDemoDef } from '@shared/exercises/demos'

const props = defineProps<{ demo: ExerciseDemoDef; compact?: boolean }>()

const SPEEDS = [0.5, 1, 1.5]
const reduced = usePreferredReducedMotion()
const playing = ref(true)
const speed = ref(1)
const run = ref(0) // changer la clé relance l'animation depuis le départ
const failed = ref(false)
const video = ref<HTMLVideoElement | null>(null)

const media = computed(() => props.demo.media)
const still = computed(() => reduced.value === 'reduce')
const cycleS = computed(() => 4 / speed.value)

watch([speed, playing], () => {
  if (video.value) { video.value.playbackRate = speed.value; playing.value ? void video.value.play() : video.value.pause() }
})

function restart() {
  run.value++
  playing.value = true
  if (video.value) { video.value.currentTime = 0; void video.value.play() }
}
</script>

<template>
  <figure class="overflow-hidden rounded-2xl bg-surface-2">
    <div class="relative bg-surface-2" :class="compact ? 'aspect-[4/3]' : 'aspect-[4/3] sm:aspect-[16/10]'">
      <!-- Secours : aucun média valide, jamais d'animation de remplacement -->
      <div v-if="failed" class="grid size-full place-items-center p-6 text-center text-sm text-muted" role="img" :aria-label="demo.alt">
        Démonstration visuelle indisponible. Suivez les consignes ci-dessous.
      </div>
      <video
        v-else-if="media.kind === 'video'" ref="video" class="size-full object-contain" autoplay muted playsinline
        :poster="media.poster" :aria-label="demo.alt" :loop="!still" @error="failed = true"
      >
        <source v-for="s in media.sources" :key="s.src" :src="s.src" :type="s.type">
      </video>
      <div v-else class="relative size-full" role="img" :aria-label="demo.alt">
        <img :src="media.start" alt="" class="absolute inset-0 size-full object-contain" @error="failed = true">
        <img
          :key="run" :src="media.end" alt="" class="demo-end absolute inset-0 size-full object-contain" :class="{ 'opacity-0': still }"
          :style="{ animationDuration: `${cycleS}s`, animationPlayState: playing && !still ? 'running' : 'paused' }" @error="failed = true"
        >
      </div>
    </div>

    <figcaption v-if="!failed" class="flex items-center gap-2 border-t border-line bg-surface px-3 py-2">
      <button type="button" class="grid size-11 place-items-center rounded-full hover:bg-surface-2" :aria-label="playing ? 'Mettre en pause' : 'Lire'" @click="playing = !playing">
        <Pause v-if="playing" class="size-5" aria-hidden="true" /><Play v-else class="size-5" aria-hidden="true" />
      </button>
      <button type="button" class="grid size-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Recommencer" @click="restart"><RotateCcw class="size-5" aria-hidden="true" /></button>
      <div class="ml-auto flex gap-1" role="group" aria-label="Vitesse de lecture">
        <button
          v-for="s in SPEEDS" :key="s" type="button" class="tabular min-h-11 min-w-11 rounded-full px-2 text-sm font-medium"
          :class="speed === s ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-surface-2'" :aria-pressed="speed === s" @click="speed = s"
        >×{{ s }}</button>
      </div>
    </figcaption>
  </figure>
</template>

<style scoped>
/* Départ → arrivée : maintien aux deux positions, fondu entre les deux. */
.demo-end { animation: demo-cycle linear infinite; }
@keyframes demo-cycle {
  0%, 20% { opacity: 0; }
  40%, 70% { opacity: 1; }
  90%, 100% { opacity: 0; }
}
</style>
