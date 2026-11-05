import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { saveSet, type SetInput } from '@/services/workout'

/**
 * File d'attente locale des séries : chaque série est d'abord conservée sur l'appareil,
 * puis synchronisée. En cas de coupure réseau, rien n'est perdu.
 */
const queue = useStorage<SetInput[]>('wwai-pending-sets', [])
let flushing: Promise<void> | null = null
/** Dernière cause d'échec de synchronisation, pour l'afficher au lieu d'un message générique. */
export const lastSyncError = ref('')

const key = (s: SetInput) => `${s.workout_session_id}|${s.exercise_id}|${s.set_number}`

function enqueue(s: SetInput) {
  queue.value = [...queue.value.filter((q) => key(q) !== key(s)), s]
}

export function flushQueue(): Promise<void> {
  if (!queue.value.length) return flushing ?? Promise.resolve()
  flushing ??= (async () => {
    try {
      // Boucle : une série ajoutée pendant l'envoi est prise au tour suivant.
      while (queue.value.length) {
        const item = queue.value[0]
        const snapshot = JSON.stringify(item)
        try {
          await saveSet(item)
        } catch (e) {
          lastSyncError.value = (e as Error).message
          throw e
        }
        // Une correction saisie pendant l'envoi doit rester dans la file.
        queue.value = queue.value.filter((q) => key(q) !== key(item) || JSON.stringify(q) !== snapshot)
        lastSyncError.value = ''
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
    } catch { /* La série reste enregistrée localement pour un nouvel essai. */ }
    return !queue.value.some((q) => key(q) === key(s))
  }

  const pending = computed(() => queue.value)
  return { record, pending, flush: flushQueue }
}
