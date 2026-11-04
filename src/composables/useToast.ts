import { ref } from 'vue'

export interface Toast { id: number; message: string; tone: 'info' | 'success' | 'error' }
const toasts = ref<Toast[]>([])
let seq = 0

export function useToast() {
  function show(message: string, tone: Toast['tone'] = 'info', ms = 3500) {
    const id = ++seq
    toasts.value.push({ id, message, tone })
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), ms)
  }
  return {
    toasts,
    info: (m: string) => show(m, 'info'),
    success: (m: string) => show(m, 'success'),
    error: (e: unknown) => show(e instanceof Error ? e.message : String(e), 'error', 6000),
  }
}
