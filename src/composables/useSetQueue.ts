import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useStorage } from '@vueuse/core'
import { saveSet, type SetInput } from '@/services/workout'

/**
 * File d'attente locale des séries : chaque série est d'abord conservée sur l'appareil,
 * puis synchronisée. En cas de coupure réseau, rien n'est perdu.
 */
const queue = useStorage<SetInput[]>('wwai-pending-sets', [])
let flushing: Promise<void> | null = null

const key = (s: SetInput) => `${s.workout_session_id}|${s.exercise_id}|${s.set_number}`

function enqueue(s: SetInput) {
  queue.value = [...queue.value.filter((q) => key(q) !== key(s)), s]
}

export function flushQueue(): Promise<void> {
  flushing ??= (async () => {
    try {
      for (const item of [...queue.value]) {
        try {
          await saveSet(item)
        } catch (e) {
          const msg = (e as Error).message
          if (!navigator.onLine || /fetch|network|load failed|timeout/i.test(msg)) throw e // réessai plus tard
          // Rejet définitif par le serveur (donnée invalide) : on retire la série pour ne pas bloquer la file.
          queue.value = queue.value.filter((q) => q !== item)
          throw new Error(`Série refusée : ${msg}`)
        }
        queue.value = queue.value.filter((q) => q !== item)
      }
    } finally {
      flushing = null
    }
  })()
  return flushing
}

export function useSetQueue() {
  const onOnline = () => void flushQueue().catch(() => {})
  onMounted(() => { window.addEventListener('online', onOnline); onOnline() })
  onBeforeUnmount(() => window.removeEventListener('online', onOnline))

  /** Enregistre une série ; renvoie false si elle reste en attente de synchronisation. */
  async function record(s: SetInput): Promise<boolean> {
    enqueue(s)
    try {
      await flushQueue()
    } catch (e) {
      if ((e as Error).message.startsWith('Série refusée')) throw e
    }
    return !queue.value.some((q) => key(q) === key(s))
  }

  const pending = computed(() => queue.value)
  return { record, pending, flush: flushQueue }
}
