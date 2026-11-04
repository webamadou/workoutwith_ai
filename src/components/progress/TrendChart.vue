<script setup lang="ts">
import { computed } from 'vue'
import { Bar, Line } from 'vue-chartjs'
import {
  BarElement, CategoryScale, Chart, Filler, LinearScale, LineElement, PointElement, Tooltip, Legend,
} from 'chart.js'
import { usePreferredDark } from '@vueuse/core'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

export interface Series { label: string; data: (number | null)[]; color?: string }

const props = withDefaults(defineProps<{
  labels: string[]
  series: Series[]
  type?: 'line' | 'bar'
  unit?: string
  height?: number
  stacked?: boolean
  summary: string // description accessible du graphique
}>(), { type: 'line', height: 220 })

const dark = usePreferredDark()
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
const PALETTE = ['--app-accent', '--app-energy', '--app-good', '--app-bad', '--app-muted']

const data = computed(() => {
  void dark.value
  return {
    labels: props.labels,
    datasets: props.series.map((s, i) => {
      const color = s.color ?? css(PALETTE[i % PALETTE.length])
      return {
        label: s.label, data: s.data, borderColor: color, backgroundColor: props.type === 'bar' ? color : color + '22',
        pointBackgroundColor: color, pointRadius: 3.5, pointHoverRadius: 6, borderWidth: 2.5, tension: 0.3,
        fill: props.type === 'line' && props.series.length === 1, spanGaps: true, borderRadius: 6, maxBarThickness: 28,
      }
    }),
  }
})

const options = computed(() => {
  void dark.value
  const grid = css('--app-line')
  const muted = css('--app-muted')
  return {
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: props.series.length > 1, labels: { color: muted, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
      tooltip: { callbacks: { label: (c: { dataset: { label?: string }; parsed: { y: number } }) => `${c.dataset.label} : ${c.parsed.y.toLocaleString('fr-FR')}${props.unit ? ' ' + props.unit : ''}` } },
    },
    scales: {
      x: { stacked: props.stacked, grid: { display: false }, ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
      y: { stacked: props.stacked, grid: { color: grid }, border: { display: false }, ticks: { color: muted, maxTicksLimit: 5 }, beginAtZero: props.type === 'bar' },
    },
  }
})
</script>

<template>
  <div :style="{ height: `${height}px` }" role="img" :aria-label="summary">
    <Bar v-if="type === 'bar'" :data="data as never" :options="options as never" />
    <Line v-else :data="data as never" :options="options as never" />
  </div>
</template>
