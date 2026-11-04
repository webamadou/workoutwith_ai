<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileUp } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { parseImport, runImport, type ImportPayload, type ImportReport } from '@shared/import/importer'

const emit = defineEmits<{ imported: [report: ImportReport] }>()
const auth = useAuthStore()
const payload = ref<ImportPayload | null>(null)
const errors = ref<string[]>([])
const importing = ref(false)
const report = ref<ImportReport | null>(null)

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  payload.value = null
  report.value = null
  errors.value = []
  if (!file) return
  if (file.size > 2_000_000) return (errors.value = ['Fichier trop volumineux (2 Mo maximum).'])
  try {
    const r = parseImport(JSON.parse(await file.text()))
    if (r.ok) payload.value = r.data
    else errors.value = r.errors
  } catch {
    errors.value = ['Le fichier n’est pas un JSON valide.']
  }
}

const summary = computed(() => {
  const p = payload.value
  if (!p) return []
  const sets = (p.sessions ?? []).reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0)
  return [
    p.profile && 'profil sportif',
    p.equipment && `${p.equipment.length} équipement(s)`,
    p.measurements?.length && `${p.measurements.length} mesure(s)`,
    p.program && 'programme de 8 semaines (si aucun programme actif)',
    p.sessions?.length && `${p.sessions.length} séance(s) dont ${p.sessions.filter((s) => s.status === 'to_verify').length} à vérifier, ${sets} série(s)`,
  ].filter(Boolean) as string[]
})

async function confirm() {
  if (!payload.value || !auth.user) return
  importing.value = true
  errors.value = []
  try {
    report.value = await runImport(supabase, auth.user.id, payload.value)
    await auth.loadProfile()
    payload.value = null
    emit('imported', report.value)
  } catch (e) {
    errors.value = [(e as Error).message]
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div>
    <label class="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface-2 font-semibold">
      <FileUp class="size-5" aria-hidden="true" />Choisir un fichier d’import (JSON)
      <input type="file" accept="application/json,.json" class="sr-only" @change="onFile" />
    </label>
    <ul v-if="errors.length" role="alert" class="mt-3 list-disc space-y-1 pl-5 text-sm text-bad">
      <li v-for="(e, i) in errors" :key="i">{{ e }}</li>
    </ul>
    <div v-if="payload" class="mt-3 rounded-xl bg-accent-soft p-4 text-sm">
      <p class="font-semibold text-accent">Contenu du fichier</p>
      <ul class="mt-1 list-disc pl-5"><li v-for="s in summary" :key="s">{{ s }}</li></ul>
      <p class="mt-2 text-muted">Les données existantes sont complétées, pas effacées. Un import peut être rejoué sans créer de doublon.</p>
      <AppButton class="mt-3" block :loading="importing" @click="confirm">Importer ces données</AppButton>
    </div>
    <div v-if="report" role="status" class="mt-3 rounded-xl bg-good/10 p-4 text-sm">
      <p class="font-semibold text-good">Import terminé</p>
      <p class="mt-1">{{ report.sessions }} séance(s), {{ report.sets }} série(s), {{ report.to_verify }} séance(s) passée(s) marquée(s) « à vérifier » ;
        programme {{ { created: 'créé', kept: 'existant conservé', none: 'non modifié' }[report.program] }}.</p>
      <ul v-if="report.warnings.length" class="mt-1 list-disc pl-5 text-muted"><li v-for="(w, i) in report.warnings" :key="i">{{ w }}</li></ul>
    </div>
  </div>
</template>
