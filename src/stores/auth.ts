import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { fetchProfile, updateProfile } from '@/services/profile'
import type { Profile, Update } from '@/services/types'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const ready = ref(false)
  let initPromise: Promise<void> | null = null

  const user = computed(() => session.value?.user ?? null)
  const onboarded = computed(() => Boolean(profile.value?.onboarding_completed_at))

  async function loadProfile() {
    profile.value = user.value ? await fetchProfile(user.value.id) : null
  }

  function init() {
    initPromise ??= (async () => {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      if (session.value) {
        // Session locale dont le compte n'existe plus (supprimé ailleurs) : on se déconnecte proprement.
        // Hors ligne (erreur réseau), on garde la session pour pouvoir reprendre une séance.
        const ok = await supabase.auth.getUser().then((r) => ![401, 403, 404].includes((r.error as { status?: number } | null)?.status ?? 0)).catch(() => true)
        if (!ok) await signOut()
        else await loadProfile().catch(() => (profile.value = null))
      }
      supabase.auth.onAuthStateChange((_event, s) => {
        const changed = s?.user.id !== session.value?.user.id
        session.value = s
        if (changed) void loadProfile()
      })
      ready.value = true
    })()
    return initPromise
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    session.value = data.session
    await loadProfile()
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
    if (error) throw error
    session.value = data.session
    if (data.session) await loadProfile()
    return { needsConfirmation: !data.session }
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    profile.value = null
  }

  async function saveProfile(patch: Update<'profiles'>) {
    if (!user.value) throw new Error('Non connecté')
    profile.value = await updateProfile(user.value.id, patch)
  }

  return { session, profile, ready, user, onboarded, init, signIn, signUp, signOut, loadProfile, saveProfile }
})
