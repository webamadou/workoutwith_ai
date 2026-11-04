import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useStorage } from '@vueuse/core'

/** Minuteur de repos basé sur une heure de fin stockée : survit au rechargement de l'application. */
export function useRestTimer(sessionId: string) {
  const state = useStorage<{ endsAt: number; total: number } | null>(`wwai-rest-${sessionId}`, null, localStorage, {
    serializer: { read: (v) => (v ? JSON.parse(v) : null), write: (v) => JSON.stringify(v) },
  })
  const now = ref(Date.now())
  const timer = setInterval(() => (now.value = Date.now()), 250)
  onBeforeUnmount(() => clearInterval(timer))

  const remaining = computed(() => (state.value ? Math.max(0, Math.ceil((state.value.endsAt - now.value) / 1000)) : 0))
  const running = computed(() => Boolean(state.value) && remaining.value > 0)
  const progress = computed(() => (state.value ? Math.min(1, 1 - (state.value.endsAt - now.value) / (state.value.total * 1000)) : 0))

  function start(seconds: number) {
    if (seconds <= 0) return
    state.value = { endsAt: Date.now() + seconds * 1000, total: seconds }
  }
  function add(seconds: number) {
    if (!state.value) return
    const endsAt = Math.max(Date.now() + 1000, state.value.endsAt + seconds * 1000)
    state.value = { endsAt, total: Math.max(state.value.total + seconds, 1) }
  }
  function stop() { state.value = null }

  // Signal de fin : vibration + bip court (sans IA ni réseau).
  watch(remaining, (r, prev) => {
    if (prev > 0 && r === 0 && state.value) {
      navigator.vibrate?.([200, 100, 200])
      beep()
      setTimeout(stop, 1500)
    }
  })

  return { remaining, running, progress, start, add, stop }
}

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.5)
    o.onended = () => ctx.close()
  } catch { /* audio indisponible */ }
}
