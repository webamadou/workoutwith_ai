<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const name = ref('')
const loading = ref(false)
const error = ref('')
const info = ref('')

const messages: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
  'User already registered': 'Un compte existe déjà avec cet e-mail.',
  'Email not confirmed': 'Confirmez votre e-mail avant de vous connecter.',
  'Load failed': 'Impossible de joindre Supabase. Vérifiez votre connexion Internet, puis réessayez.',
  'Failed to fetch': 'Impossible de joindre Supabase. Vérifiez votre connexion Internet, puis réessayez.',
}

async function submit() {
  error.value = ''
  info.value = ''
  loading.value = true
  try {
    if (mode.value === 'signin') {
      await auth.signIn(email.value.trim(), password.value)
    } else {
      const r = await auth.signUp(email.value.trim(), password.value, name.value.trim())
      if (r.needsConfirmation) {
        info.value = 'Compte créé. Ouvrez le lien reçu par e-mail pour l’activer, puis connectez-vous.'
        mode.value = 'signin'
        return
      }
    }
    await router.replace((route.query.redirect as string) || '/')
  } catch (e) {
    const m = (e as Error).message
    error.value = messages[m] ?? m
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="grid min-h-dvh lg:grid-cols-2">
    <section class="relative hidden overflow-hidden bg-slate-ink p-12 text-chalk lg:flex lg:flex-col lg:justify-between">
      <div class="flex items-center gap-3">
        <img src="/favicon.svg" alt="" class="size-10" />
        <span class="font-display text-2xl font-semibold">WorkOut With AI</span>
      </div>
      <p class="max-w-md font-display text-6xl font-semibold leading-[0.95]">Chaque série compte. Le coach lit vos vraies données.</p>
      <svg viewBox="0 0 400 400" class="pointer-events-none absolute -right-28 top-1/2 w-[34rem] -translate-y-1/2 opacity-90" aria-hidden="true">
        <circle cx="200" cy="200" r="190" fill="#2d4fd8" />
        <circle cx="200" cy="200" r="150" fill="none" stroke="#f4f5f2" stroke-opacity=".18" stroke-width="3" />
        <circle cx="200" cy="200" r="110" fill="none" stroke="#f4f5f2" stroke-opacity=".12" stroke-width="2" />
        <circle cx="200" cy="200" r="34" fill="#f5b800" />
        <circle cx="200" cy="200" r="16" fill="#1d262b" />
      </svg>
    </section>

    <section class="flex flex-col justify-center px-6 py-10 sm:px-12">
      <div class="mx-auto w-full max-w-sm">
        <div class="mb-10 flex items-center gap-3 lg:hidden">
          <img src="/favicon.svg" alt="" class="size-11" />
          <span class="font-display text-2xl font-semibold leading-none">WorkOut With AI</span>
        </div>
        <h1 class="font-display text-4xl font-semibold">{{ mode === 'signin' ? 'Connexion' : 'Créer un compte' }}</h1>
        <p class="mt-1 text-muted">{{ mode === 'signin' ? 'Retrouvez votre programme et vos séances.' : 'Quelques secondes, puis on prépare votre programme.' }}</p>

        <form class="mt-8 flex flex-col gap-4" @submit.prevent="submit">
          <label v-if="mode === 'signup'" class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">Prénom</span>
            <input v-model="name" required autocomplete="given-name" class="h-12 rounded-xl border border-line bg-surface px-4 outline-none focus:border-accent" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">E-mail</span>
            <input v-model="email" type="email" required autocomplete="email" class="h-12 rounded-xl border border-line bg-surface px-4 outline-none focus:border-accent" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">Mot de passe</span>
            <span class="relative">
              <input v-model="password" :type="showPassword ? 'text' : 'password'" required minlength="8" :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'" class="h-12 w-full rounded-xl border border-line bg-surface px-4 pr-20 outline-none focus:border-accent" />
              <button type="button" class="absolute inset-y-0 right-3 text-sm font-medium text-accent" :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'" @click="showPassword = !showPassword">{{ showPassword ? 'Masquer' : 'Afficher' }}</button>
            </span>
            <span v-if="mode === 'signup'" class="text-xs text-muted">8 caractères minimum.</span>
          </label>
          <p v-if="error" role="alert" class="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">{{ error }}</p>
          <p v-if="info" role="status" class="rounded-xl bg-good/10 px-4 py-3 text-sm text-good">{{ info }}</p>
          <AppButton type="submit" size="lg" block :loading="loading">{{ mode === 'signin' ? 'Se connecter' : 'Créer mon compte' }}</AppButton>
        </form>

        <p class="mt-6 text-center text-sm text-muted">
          {{ mode === 'signin' ? 'Pas encore de compte ?' : 'Déjà inscrit ?' }}
          <button type="button" class="font-semibold text-accent underline-offset-2 hover:underline" @click="mode = mode === 'signin' ? 'signup' : 'signin'; error = ''">
            {{ mode === 'signin' ? 'Créer un compte' : 'Se connecter' }}
          </button>
        </p>
      </div>
    </section>
  </div>
</template>
