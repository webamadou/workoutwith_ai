<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Download, LogOut, Monitor, Moon, Sun } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import EquipmentEditor, { type EquipmentItem } from '@/components/profile/EquipmentEditor.vue'
import ImportPanel from '@/components/profile/ImportPanel.vue'
import { proposeForEquipment } from '@/services/continuity'
import { fetchSets } from '@/services/workout'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { usePlanStore } from '@/stores/plan'
import { fetchEquipment, saveEquipment } from '@/services/profile'
import { createPlan } from '@/services/program'
import { exportMyData, deleteMyAccount } from '@/services/account'
import { getAIStatus, type AIStatus } from '@/services/coach'
import { EXPERIENCE_LABELS } from '@/services/types'
import { GOAL_OPTIONS, LIMITATION_OPTIONS } from '@/lib/profileOptions'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { generateInitialProgram } from '@shared/program/template'
import { DAY_SHORT, addDays, isoDayOfWeek, mondayOf, toISODate } from '@shared/dates'

const auth = useAuthStore()
const catalog = useCatalogStore()
const plan = usePlanStore()
const router = useRouter()
const toast = useToast()
const theme = useTheme()

const p = auth.profile!
const f = reactive({
  display_name: p.display_name ?? '',
  height_cm: p.height_cm == null ? null : Number(p.height_cm),
  goal: p.goal ?? '',
  experience_level: p.experience_level as string | null,
  sessions_per_week: p.sessions_per_week,
  available_days: [...p.available_days],
  session_duration_min: p.session_duration_min,
  training_preferences: p.training_preferences ?? '',
  preferred: [] as string[],
  avoided: [] as string[],
  limitation_tags: [...p.limitation_tags],
  limitations: p.limitations ?? '',
  recovery_notes: p.recovery_notes ?? '',
  rest_timer_default_s: p.rest_timer_default_s,
  ai_provider: (p.ai_provider ?? '') as string,
})
const equipment = ref<EquipmentItem[]>([])
const ai = ref<AIStatus | null>(null)
const saving = ref(false)
const regen = ref(false)
const exporting = ref(false)
const showDelete = ref(false)
const deleteConfirm = ref('')
const deleting = ref(false)
const newEmail = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingEmail = ref(false)
const savingPassword = ref(false)
const emailMessage = ref('')
const passwordMessage = ref('')

onMounted(async () => {
  try {
    await catalog.load()
    const slugs = (ids: string[]) => ids.map((id) => catalog.byId.get(id)?.slug).filter(Boolean) as string[]
    f.preferred = slugs(p.preferred_exercise_ids)
    f.avoided = slugs(p.avoided_exercise_ids)
    const eq = await fetchEquipment()
    equipment.value = eq.map((e) => ({ equipment_key: e.equipment_key, quantity: e.quantity, details: e.details ?? '' }))
  } catch (e) { toast.error(e) }
  ai.value = await getAIStatus().catch(() => null)
})

const exerciseOptions = computed(() => catalog.exercises.map((e) => ({ value: e.slug, label: e.name })))
const experienceOptions = Object.entries(EXPERIENCE_LABELS).map(([value, label]) => ({ value, label }))
const dayOptions = DAY_SHORT.map((label, i) => ({ value: i + 1, label }))
const providerOptions = computed(() => [
  { value: '', label: 'Par défaut', hint: ai.value?.default_provider ?? undefined },
  ...(ai.value?.providers ?? []).filter((x) => x.configured).map((x) => ({ value: x.id, label: x.id === 'openai' ? 'OpenAI' : 'Anthropic' })),
])

async function save() {
  saving.value = true
  try {
    const ids = (slugs: string[]) => slugs.map((s) => catalog.bySlug.get(s)!.id)
    await auth.saveProfile({
      display_name: f.display_name.trim() || null, height_cm: f.height_cm, goal: f.goal || null,
      experience_level: f.experience_level as never, sessions_per_week: f.sessions_per_week, available_days: f.available_days,
      session_duration_min: f.session_duration_min, training_preferences: f.training_preferences || null,
      preferred_exercise_ids: ids(f.preferred), avoided_exercise_ids: ids(f.avoided), limitation_tags: f.limitation_tags,
      limitations: f.limitations || null, recovery_notes: f.recovery_notes || null, rest_timer_default_s: f.rest_timer_default_s,
      ai_provider: (f.ai_provider || null) as never,
    })
    await saveEquipment(equipment.value.map((e) => ({ equipment_key: e.equipment_key, quantity: e.quantity || 1, details: e.details.trim() || null })))
    toast.success('Profil enregistré.')
    // Le programme n'est pas régénéré : si du matériel manque désormais, une adaptation est proposée (à valider).
    if (!plan.loaded) await plan.load()
    const input = plan.continuityInput(await fetchSets({ since: new Date(Date.now() - 30 * 86_400_000).toISOString() }), equipment.value.map((e) => e.equipment_key))
    if (input && (await proposeForEquipment(input))) toast.info('Du matériel retiré est utilisé par votre programme : une adaptation vous est proposée sur l’accueil.')
  } catch (e) { toast.error(e) } finally { saving.value = false }
}

async function regenerate() {
  if (!confirm('Créer un nouveau programme de 8 semaines à partir de votre profil ? L’actuel sera archivé (historique conservé).')) return
  regen.value = true
  try {
    await save()
    const today = toISODate(new Date())
    const start = isoDayOfWeek(today) === 1 ? today : addDays(mondayOf(today), 7)
    const r = generateInitialProgram({ exercises: catalog.infos, ownedEquipment: equipment.value.map((e) => e.equipment_key), avoidedSlugs: f.avoided, availableDays: f.available_days, experience: f.experience_level as never, goal: f.goal })
    await createPlan(r.draft, start, catalog.bySlug, 'Nouveau programme généré depuis le profil')
    await plan.load()
    toast.success(`Nouveau programme : début le ${start}.`)
    await router.push('/programme')
  } catch (e) { toast.error(e) } finally { regen.value = false }
}

async function exportData() {
  exporting.value = true
  try {
    const blob = await exportMyData()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `workoutwith-ai-export-${toISODate(new Date())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (e) { toast.error(e) } finally { exporting.value = false }
}

async function removeAccount() {
  deleting.value = true
  try {
    await deleteMyAccount()
    localStorage.clear()
    await router.replace('/connexion')
  } catch (e) { toast.error(e) } finally { deleting.value = false }
}

async function signOut() {
  await auth.signOut()
  await router.replace('/connexion')
}

async function changeEmail() {
  emailMessage.value = ''
  if (newEmail.value.trim().toLowerCase() === auth.user?.email?.toLowerCase()) {
    emailMessage.value = 'Cette adresse est déjà celle de votre compte.'
    return
  }
  savingEmail.value = true
  try {
    const changed = await auth.changeEmail(newEmail.value.trim())
    newEmail.value = ''
    toast.success(changed ? 'Adresse e-mail modifiée.' : 'Vérifiez les e-mails de confirmation pour valider la nouvelle adresse.')
  } catch (e) { emailMessage.value = (e as Error).message } finally { savingEmail.value = false }
}

async function changePassword() {
  passwordMessage.value = ''
  if (newPassword.value !== confirmPassword.value) {
    passwordMessage.value = 'Les mots de passe ne correspondent pas.'
    return
  }
  savingPassword.value = true
  try {
    await auth.changePassword(newPassword.value)
    newPassword.value = ''
    confirmPassword.value = ''
    toast.success('Mot de passe modifié.')
  } catch (e) { passwordMessage.value = (e as Error).message } finally { savingPassword.value = false }
}

const input = 'h-12 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent'
const area = 'w-full rounded-xl border border-line bg-surface p-3 outline-none focus:border-accent'
</script>

<template>
  <div>
    <PageHeader title="Profil" :subtitle="auth.user?.email" />

    <form class="flex flex-col gap-4" @submit.prevent="save">
      <section class="rounded-2xl bg-surface p-5" aria-labelledby="p-id">
        <h2 id="p-id" class="font-semibold">Profil sportif</h2>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <label class="col-span-2 flex flex-col gap-1 text-sm font-medium">Prénom<input v-model="f.display_name" :class="input" /></label>
          <label class="flex flex-col gap-1 text-sm font-medium">Taille (cm)<input v-model.number="f.height_cm" type="number" min="100" max="250" step="0.5" :class="input" /></label>
          <label class="flex flex-col gap-1 text-sm font-medium">Séances / semaine<input v-model.number="f.sessions_per_week" type="number" min="1" max="7" :class="input" /></label>
          <label class="col-span-2 flex flex-col gap-1 text-sm font-medium">Objectif principal<input v-model="f.goal" list="goals" :class="input" /></label>
          <datalist id="goals"><option v-for="g in GOAL_OPTIONS" :key="g.value" :value="g.value" /></datalist>
        </div>
        <p class="mb-2 mt-4 text-sm font-medium">Niveau</p>
        <ChipGroup v-model="f.experience_level" :options="experienceOptions" label="Niveau" />
        <p class="mb-2 mt-4 text-sm font-medium">Disponibilités</p>
        <ChipGroup v-model="f.available_days" :options="dayOptions" multiple label="Jours disponibles" />
        <label class="mt-4 flex flex-col gap-1 text-sm font-medium">Durée d’une séance (min)<input v-model.number="f.session_duration_min" type="number" min="10" max="240" step="5" :class="input" /></label>
        <p class="mt-3 text-xs text-muted">Le poids et le tour de taille se suivent dans Progression › Mesures.</p>
      </section>

      <section class="rounded-2xl bg-surface p-5" aria-labelledby="p-eq">
        <h2 id="p-eq" class="font-semibold">Matériel disponible</h2>
        <p class="mt-1 text-sm text-muted">Modifiable à tout moment : le programme n’est pas régénéré, il est adapté si besoin (avec votre accord).</p>
        <EquipmentEditor v-model="equipment" class="mt-3" :ai-enabled="Boolean(ai?.enabled)" />
      </section>

      <section class="rounded-2xl bg-surface p-5" aria-labelledby="p-pref">
        <h2 id="p-pref" class="font-semibold">Préférences</h2>
        <label class="mt-3 flex flex-col gap-1 text-sm font-medium">Préférences d’entraînement<textarea v-model="f.training_preferences" rows="2" :class="area" /></label>
        <p class="mb-2 mt-4 text-sm font-medium">Exercices préférés</p>
        <ChipGroup v-model="f.preferred" :options="exerciseOptions" multiple label="Exercices préférés" />
        <p class="mb-2 mt-4 text-sm font-medium">Exercices à éviter</p>
        <ChipGroup v-model="f.avoided" :options="exerciseOptions" multiple label="Exercices à éviter" />
      </section>

      <section class="rounded-2xl bg-surface p-5" aria-labelledby="p-lim">
        <h2 id="p-lim" class="font-semibold">Santé et récupération</h2>
        <p class="mb-2 mt-3 text-sm font-medium">Zones sensibles</p>
        <ChipGroup v-model="f.limitation_tags" :options="LIMITATION_OPTIONS" multiple label="Zones sensibles" />
        <label class="mt-4 flex flex-col gap-1 text-sm font-medium">Limitations physiques déclarées<textarea v-model="f.limitations" rows="2" :class="area" /></label>
        <label class="mt-3 flex flex-col gap-1 text-sm font-medium">Informations sur la récupération<textarea v-model="f.recovery_notes" rows="2" :class="area" /></label>
      </section>

      <section class="rounded-2xl bg-surface p-5" aria-labelledby="p-set">
        <h2 id="p-set" class="font-semibold">Paramètres</h2>
        <label class="mt-3 flex flex-col gap-1 text-sm font-medium">Repos par défaut (secondes)<input v-model.number="f.rest_timer_default_s" type="number" min="10" max="600" step="5" :class="input" /></label>
        <p class="mb-2 mt-4 text-sm font-medium">Apparence</p>
        <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thème">
          <button v-for="t in [{ v: 'auto', l: 'Système', i: Monitor }, { v: 'light', l: 'Clair', i: Sun }, { v: 'dark', l: 'Sombre', i: Moon }] as const" :key="t.v"
            type="button" role="radio" :aria-checked="theme === t.v" class="flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium"
            :class="theme === t.v ? 'border-accent bg-accent-soft text-accent' : 'border-line'" @click="theme = t.v">
            <component :is="t.i" class="size-4" aria-hidden="true" />{{ t.l }}
          </button>
        </div>
        <p class="mb-2 mt-4 text-sm font-medium">Fournisseur du coach IA</p>
        <ChipGroup v-if="ai?.enabled" v-model="f.ai_provider" :options="providerOptions" label="Fournisseur IA" />
        <p v-else class="text-sm text-muted">Aucun fournisseur configuré côté serveur.</p>
      </section>

      <AppButton type="submit" size="lg" block :loading="saving">Enregistrer le profil</AppButton>
    </form>

    <section class="mt-6 rounded-2xl border border-line p-5" aria-labelledby="account-title">
      <h2 id="account-title" class="font-semibold">Compte et sécurité</h2>
      <p class="mt-1 text-sm text-muted">Adresse actuelle : {{ auth.user?.email }}</p>

      <form class="mt-5 flex flex-col gap-3" @submit.prevent="changeEmail">
        <label class="flex flex-col gap-1 text-sm font-medium">Nouvelle adresse e-mail
          <input v-model="newEmail" type="email" autocomplete="email" required :class="input" />
        </label>
        <p v-if="emailMessage" role="alert" class="text-sm text-bad">{{ emailMessage }}</p>
        <AppButton type="submit" variant="secondary" block :loading="savingEmail">Modifier l’e-mail</AppButton>
      </form>

      <form class="mt-6 flex flex-col gap-3 border-t border-line pt-5" @submit.prevent="changePassword">
        <label class="flex flex-col gap-1 text-sm font-medium">Nouveau mot de passe
          <input v-model="newPassword" type="password" autocomplete="new-password" required minlength="8" :class="input" />
        </label>
        <label class="flex flex-col gap-1 text-sm font-medium">Confirmer le mot de passe
          <input v-model="confirmPassword" type="password" autocomplete="new-password" required minlength="8" :class="input" />
        </label>
        <p v-if="passwordMessage" role="alert" class="text-sm text-bad">{{ passwordMessage }}</p>
        <AppButton type="submit" variant="secondary" block :loading="savingPassword">Modifier le mot de passe</AppButton>
      </form>
    </section>

    <section id="programme" class="mt-6 rounded-2xl border border-line p-5">
      <h2 class="font-semibold">Programme</h2>
      <p class="mt-1 text-sm text-muted">Génère un nouveau programme de 8 semaines adapté au profil et au matériel ci-dessus.</p>
      <AppButton variant="secondary" block class="mt-3" :loading="regen" @click="regenerate">Générer un nouveau programme</AppButton>
    </section>

    <section class="mt-4 rounded-2xl border border-line p-5">
      <h2 class="font-semibold">Importer un ancien suivi</h2>
      <p class="mb-3 mt-1 text-sm text-muted">Fichier JSON au format décrit dans la documentation (profil, matériel, mesures, séances). Les séances non confirmées sont marquées « à vérifier ».</p>
      <ImportPanel @imported="plan.load()" />
    </section>

    <section class="mt-4 rounded-2xl border border-line p-5">
      <h2 class="font-semibold">Mes données</h2>
      <div class="mt-3 flex flex-col gap-2">
        <AppButton variant="secondary" block :loading="exporting" @click="exportData"><Download class="size-5" aria-hidden="true" />Exporter mes données (JSON)</AppButton>
        <AppButton variant="secondary" block @click="signOut"><LogOut class="size-5" aria-hidden="true" />Se déconnecter</AppButton>
        <AppButton variant="ghost" block class="text-bad" @click="showDelete = true">Supprimer mon compte</AppButton>
      </div>
    </section>

    <BottomSheet v-model:open="showDelete" title="Supprimer le compte" description="Toutes vos données (séances, mesures, photos, conversations) seront définitivement effacées.">
      <label class="flex flex-col gap-1 text-sm font-medium">Tapez SUPPRIMER pour confirmer<input v-model="deleteConfirm" :class="input" autocomplete="off" /></label>
      <AppButton variant="danger" size="lg" block class="mt-4" :disabled="deleteConfirm !== 'SUPPRIMER'" :loading="deleting" @click="removeAccount">Supprimer définitivement</AppButton>
    </BottomSheet>
  </div>
</template>
