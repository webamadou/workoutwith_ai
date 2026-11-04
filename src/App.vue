<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppNav from '@/components/layout/AppNav.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { isSupabaseConfigured } from '@/lib/supabase'

const route = useRoute()
const bare = computed(() => route.meta.bare)
</script>

<template>
  <ToastHost />
  <main v-if="!isSupabaseConfigured" class="mx-auto max-w-lg p-6">
    <h1 class="font-display text-3xl font-semibold">Configuration requise</h1>
    <p class="mt-2 text-muted">Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env (voir .env.example), puis relancez le serveur.</p>
  </main>
  <template v-else>
    <RouterView v-if="bare" />
    <template v-else>
      <AppNav />
      <div class="lg:pl-60">
        <main class="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-28 lg:max-w-4xl lg:px-10 lg:pb-12" style="padding-top: max(1.5rem, env(safe-area-inset-top))">
          <RouterView />
        </main>
      </div>
    </template>
  </template>
</template>
