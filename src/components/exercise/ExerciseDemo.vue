<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { Pause, Play } from 'lucide-vue-next'
import type { Joints, PoseAnimation } from '@shared/exercises/poses'
import type { ExerciseMedia } from '@/services/types'
import DemoPlayer from './DemoPlayer.vue'
import { demoFor } from '@shared/exercises/demos'

const props = withDefaults(defineProps<{ media: ExerciseMedia[]; compact?: boolean; slug?: string }>(), { compact: false })
const demo = computed(() => (props.slug ? demoFor(props.slug) : undefined))

const anim = computed(() => props.media.find((m) => m.kind === 'animation')?.data as PoseAnimation | undefined)
const image = computed(() => props.media.find((m) => m.kind === 'image'))
const video = computed(() => props.media.find((m) => m.kind === 'video'))
const alt = computed(() => props.media[0]?.alt ?? '')

const reduced = usePreferredReducedMotion()
const playing = ref(true)
const frame = ref<Joints | null>(null)
let raf = 0
let t0 = 0

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
function lerp(a: Joints, b: Joints, t: number): Joints {
  const out: Joints = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const p = a[k] ?? b[k]
    const q = b[k] ?? a[k]
    out[k] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
  }
  return out
}

function tick(now: number) {
  const a = anim.value
  if (!a) return
  const total = a.timing.reduce((n, s) => n + s.move + s.hold, 0)
  let t = ((now - t0) / 1000) % total
  const n = a.frames.length
  for (let i = 0; i < n; i++) {
    const { move, hold } = a.timing[i]
    const from = a.frames[(i - 1 + n) % n]
    const to = a.frames[i]
    if (t < move) { frame.value = lerp(from, to, ease(t / move)); break }
    t -= move
    if (t < hold) { frame.value = to; break }
    t -= hold
  }
  raf = requestAnimationFrame(tick)
}

function start() {
  cancelAnimationFrame(raf)
  if (!anim.value) return
  frame.value = anim.value.frames[0] // affichage immédiat, même si l'animation est suspendue par le navigateur
  if (!playing.value || reduced.value === 'reduce') {
    frame.value = anim.value.frames.at(-1)!
    return
  }
  t0 = performance.now()
  raf = requestAnimationFrame(tick)
}

onMounted(start)
watch([anim, playing, reduced], start)
onBeforeUnmount(() => cancelAnimationFrame(raf))

const pts = (f: Joints, names: string[]) => names.filter((n) => f[n]).map((n) => f[n].join(',')).join(' ')
const angleOf = (f: Joints, hand: string) => {
  const elbow = f[hand.replace('hand', 'elbow')]
  const h = f[hand]
  if (!elbow || !h) return 0
  return (Math.atan2(h[1] - elbow[1], h[0] - elbow[0]) * 180) / Math.PI + 90
}
</script>

<template>
  <DemoPlayer v-if="demo" :demo="demo" :compact="compact" />
  <figure v-else class="relative overflow-hidden rounded-2xl bg-surface-2" :class="compact ? 'aspect-[4/3]' : 'aspect-[4/3] sm:aspect-[16/10]'">
    <video v-if="video?.url" :src="video.url" class="size-full object-cover" autoplay muted loop playsinline :aria-label="alt" />
    <img v-else-if="image?.url" :src="image.url" :alt="alt" class="size-full object-cover" />
    <template v-else-if="anim && frame">
      <svg :viewBox="anim.viewBox" class="size-full text-ink" role="img" :aria-label="alt" preserveAspectRatio="xMidYMid meet">
        <line x1="-40" y1="180" x2="280" y2="180" class="stroke-line" stroke-width="3" />
        <rect v-if="anim.props?.mat" x="20" y="179" width="200" height="5" rx="2" class="fill-accent/30" />
        <rect v-if="anim.props?.box" :x="anim.props.box.x" :y="anim.props.box.y" :width="anim.props.box.w" :height="anim.props.box.h" rx="4" class="fill-line" />
        <template v-if="anim.props?.band">
          <line v-for="t in anim.props.band.to" :key="t" :x1="anim.props.band.anchor[0]" :y1="anim.props.band.anchor[1]" :x2="frame[t]?.[0]" :y2="frame[t]?.[1]"
            class="stroke-energy" stroke-width="3" stroke-linecap="round" />
        </template>
        <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <polyline v-for="(c, i) in anim.chains" :key="i" :points="pts(frame, c.points)" :stroke-width="c.far ? 6 : 7.5" :opacity="c.far ? 0.32 : 1" />
        </g>
        <circle v-if="anim.head && frame[anim.head]" :cx="frame[anim.head][0]" :cy="frame[anim.head][1]" r="9.5" fill="currentColor" />
        <template v-for="d in anim.props?.handles ?? []" :key="'h' + d">
          <rect v-if="frame[d]" :x="frame[d][0] - 9" :y="frame[d][1]" width="18" height="6" rx="2" class="fill-muted" />
        </template>
        <g v-for="d in anim.props?.dumbbells ?? []" :key="d" :transform="frame[d] ? `translate(${frame[d][0]} ${frame[d][1]}) rotate(${angleOf(frame, d)})` : ''">
          <template v-if="frame[d]">
            <rect x="-11" y="-2" width="22" height="4" rx="2" class="fill-ink" />
            <rect x="-13" y="-6.5" width="6" height="13" rx="2" class="fill-accent" />
            <rect x="7" y="-6.5" width="6" height="13" rx="2" class="fill-accent" />
          </template>
        </g>
      </svg>
      <button
        v-if="reduced !== 'reduce'" type="button"
        class="absolute bottom-2 right-2 grid size-10 place-items-center rounded-full bg-surface/90 text-ink shadow"
        :aria-label="playing ? 'Mettre la démonstration en pause' : 'Lire la démonstration'" @click="playing = !playing"
      >
        <Pause v-if="playing" class="size-5" aria-hidden="true" />
        <Play v-else class="size-5" aria-hidden="true" />
      </button>
      <figcaption class="absolute left-3 top-2 text-xs text-muted">Démonstration schématique</figcaption>
    </template>
    <div v-else class="grid size-full place-items-center text-sm text-muted">Pas de démonstration</div>
  </figure>
</template>
