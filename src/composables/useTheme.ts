import { watchEffect } from 'vue'
import { useStorage, usePreferredDark } from '@vueuse/core'

export type ThemeChoice = 'auto' | 'light' | 'dark'
const choice = useStorage<ThemeChoice>('wwai-theme', 'auto', localStorage, { serializer: { read: (v) => (v as ThemeChoice) || 'auto', write: (v) => v } })
const prefersDark = usePreferredDark()

watchEffect(() => {
  const dark = choice.value === 'dark' || (choice.value === 'auto' && prefersDark.value)
  document.documentElement.classList.toggle('dark', dark)
})

export const useTheme = () => choice
