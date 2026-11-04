<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { CalendarDays, ChartLine, House, MessageCircle, Play, UserRound } from 'lucide-vue-next'

const route = useRoute()
const items = [
  { to: '/', label: 'Accueil', icon: House, match: (p: string) => p === '/' },
  { to: '/programme', label: 'Programme', icon: CalendarDays, match: (p: string) => p.startsWith('/programme') || p.startsWith('/exercices') },
  { to: '/seance', label: 'Séance', icon: Play, match: (p: string) => p.startsWith('/seance'), primary: true },
  { to: '/progression', label: 'Progrès', icon: ChartLine, match: (p: string) => p.startsWith('/progression') },
  { to: '/coach', label: 'Coach', icon: MessageCircle, match: (p: string) => p.startsWith('/coach') },
  { to: '/profil', label: 'Profil', icon: UserRound, match: (p: string) => p.startsWith('/profil') },
]
const mobile = computed(() => items.filter((i) => i.to !== '/profil'))
const isActive = (i: (typeof items)[number]) => i.match(route.path)
</script>

<template>
  <!-- Mobile : barre inférieure, la séance au centre -->
  <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur lg:hidden" aria-label="Navigation principale">
    <ul class="mx-auto grid max-w-lg grid-cols-5">
      <li v-for="i in mobile" :key="i.to">
        <RouterLink
          :to="i.to" :aria-current="isActive(i) ? 'page' : undefined"
          class="flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium"
          :class="isActive(i) ? 'text-accent' : 'text-muted'"
        >
          <span v-if="i.primary" class="-mt-5 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lg ring-4 ring-bg">
            <component :is="i.icon" class="size-6 translate-x-px" aria-hidden="true" />
          </span>
          <component :is="i.icon" v-else class="size-6" :stroke-width="isActive(i) ? 2.4 : 1.8" aria-hidden="true" />
          {{ i.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>

  <!-- Desktop : rail latéral -->
  <nav class="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface px-4 py-6 lg:flex" aria-label="Navigation principale">
    <RouterLink to="/" class="mb-8 flex items-center gap-2.5 px-2">
      <img src="/favicon.svg" alt="" class="size-9" />
      <span class="font-display text-2xl font-semibold leading-none">WorkOut<br /><span class="text-muted">With AI</span></span>
    </RouterLink>
    <ul class="flex flex-col gap-1">
      <li v-for="i in items" :key="i.to">
        <RouterLink
          :to="i.to" :aria-current="isActive(i) ? 'page' : undefined"
          class="flex h-11 items-center gap-3 rounded-xl px-3 font-medium transition"
          :class="isActive(i) ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink'"
        >
          <component :is="i.icon" class="size-5" aria-hidden="true" />{{ i.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
