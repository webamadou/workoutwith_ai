<script setup lang="ts">
import { computed, ref } from 'vue'
import { Camera, Check } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import { EQUIPMENT_OPTIONS } from '@/lib/profileOptions'
import { toJpegBase64 } from '@/lib/images'
import { analyzeEquipment, CoachError, type EquipmentSuggestion } from '@/services/coach'

export interface EquipmentItem { equipment_key: string; quantity: number; details: string }

const items = defineModel<EquipmentItem[]>({ required: true })
defineProps<{ aiEnabled: boolean }>()

const analyzing = ref(false)
const error = ref('')
const suggestion = ref<(EquipmentSuggestion['items'][number] & { keep: boolean })[] | null>(null)
const notes = ref('')

const has = (k: string) => items.value.some((i) => i.equipment_key === k)
function toggle(k: string) {
  items.value = has(k) ? items.value.filter((i) => i.equipment_key !== k) : [...items.value, { equipment_key: k, quantity: 1, details: '' }]
}
const label = (k: string) => EQUIPMENT_OPTIONS.find((o) => o.value === k)?.label ?? k

async function onPhotos(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])].slice(0, 4)
  input.value = ''
  if (!files.length) return
  analyzing.value = true
  error.value = ''
  try {
    const images = await Promise.all(files.map((f) => toJpegBase64(f)))
    const r = await analyzeEquipment(images)
    suggestion.value = r.items.map((i) => ({ ...i, keep: i.equipment_key !== 'other' && i.confidence !== 'low' }))
    notes.value = r.notes
  } catch (err) {
    error.value = err instanceof CoachError ? err.message : (err as Error).message
  } finally {
    analyzing.value = false
  }
}

const unsupported = computed(() => suggestion.value?.filter((s) => s.equipment_key === 'other') ?? [])

/** L'utilisateur valide la suggestion : fusion dans l'inventaire (rien n'est enregistré avant validation du formulaire). */
function applySuggestion() {
  const next = items.value.map((i) => ({ ...i }))
  for (const s of suggestion.value ?? []) {
    if (!s.keep || s.equipment_key === 'other') continue
    const existing = next.find((i) => i.equipment_key === s.equipment_key)
    const details = [s.details, s.label].filter(Boolean).join(' — ')
    if (existing) {
      existing.quantity = s.quantity ?? existing.quantity
      existing.details = existing.details || details
    } else next.push({ equipment_key: s.equipment_key, quantity: s.quantity ?? 1, details })
  }
  items.value = next
  suggestion.value = null
}

const confidence = { low: 'incertain', medium: 'probable', high: 'sûr' }
const input = 'h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent'
</script>

<template>
  <div class="flex flex-col gap-4">
    <div role="group" aria-label="Matériel disponible" class="flex flex-wrap gap-2">
      <button v-for="o in EQUIPMENT_OPTIONS" :key="o.value" type="button" :aria-pressed="has(o.value)"
        class="min-h-11 rounded-xl border px-4 py-2 text-left text-sm font-medium transition"
        :class="has(o.value) ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface hover:border-muted'" @click="toggle(o.value)">
        {{ o.label }}<span v-if="o.hint" class="block text-xs font-normal text-muted">{{ o.hint }}</span>
      </button>
    </div>

    <div v-for="item in items" :key="item.equipment_key" class="grid grid-cols-[5rem_1fr] gap-2 rounded-xl bg-surface-2 p-3">
      <p class="col-span-2 text-sm font-semibold">{{ label(item.equipment_key) }}</p>
      <label class="flex flex-col gap-1 text-xs text-muted">Quantité<input v-model.number="item.quantity" type="number" min="1" max="100" :class="input" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted">Détails<input v-model="item.details" :class="input" :placeholder="item.equipment_key === 'weight_plate' ? '8 × 1 kg, 4 × 2 kg' : 'réglage, couleur…'" /></label>
    </div>

    <div v-if="aiEnabled" class="rounded-2xl border border-dashed border-line p-4">
      <p class="font-semibold">Identifier le matériel sur photo <span class="font-normal text-muted">— facultatif</span></p>
      <p class="mt-1 text-sm text-muted">Le coach propose un inventaire que vous vérifiez avant de l’ajouter. Les photos servent uniquement à cette analyse et ne sont pas conservées.</p>
      <label class="mt-3 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface font-semibold" :class="analyzing && 'opacity-60'">
        <Camera class="size-5" aria-hidden="true" />{{ analyzing ? 'Analyse en cours…' : 'Choisir jusqu’à 4 photos' }}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="sr-only" :disabled="analyzing" @change="onPhotos" />
      </label>
      <p v-if="error" role="alert" class="mt-3 text-sm text-bad">{{ error }}</p>

      <div v-if="suggestion" class="mt-4">
        <p class="text-sm font-semibold">Matériel repéré : cochez ce qui est juste, corrigez si besoin</p>
        <p v-if="!suggestion.length" class="mt-2 text-sm text-muted">Aucun matériel identifié.</p>
        <ul class="mt-2 flex flex-col gap-2">
          <li v-for="(s, i) in suggestion" :key="i" class="rounded-xl bg-surface p-3">
            <label class="flex items-center gap-3">
              <input v-model="s.keep" type="checkbox" class="size-5" :disabled="s.equipment_key === 'other'" />
              <span class="flex-1 font-medium">{{ s.label }} <span class="text-xs font-normal text-muted">({{ confidence[s.confidence] }})</span></span>
            </label>
            <div v-if="s.equipment_key !== 'other'" class="mt-2 grid grid-cols-[5rem_1fr] gap-2">
              <input v-model.number="s.quantity" type="number" min="1" max="100" placeholder="?" aria-label="Quantité" :class="input" />
              <input v-model="s.details" aria-label="Détails" :class="input" />
            </div>
          </li>
        </ul>
        <p v-if="unsupported.length" class="mt-2 text-xs text-muted">Non utilisable par la bibliothèque d’exercices : {{ unsupported.map((u) => u.label).join(', ') }}.</p>
        <p v-if="notes" class="mt-2 text-xs text-muted">{{ notes }}</p>
        <div class="mt-3 flex gap-2">
          <AppButton size="sm" @click="applySuggestion"><Check class="size-4" aria-hidden="true" />Ajouter la sélection</AppButton>
          <AppButton size="sm" variant="ghost" @click="suggestion = null">Ignorer</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>
