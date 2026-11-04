<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { History, Plus, Send, Sparkles, Trash2 } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import RecommendationCard from '@/components/coach/RecommendationCard.vue'
import { useCatalogStore } from '@/stores/catalog'
import {
  CoachError, deleteConversation, fetchConversations, fetchMessages, fetchRecommendations, getAIStatus, sendChat, type AIStatus,
} from '@/services/coach'
import type { Conversation, Recommendation } from '@/services/types'
import { useToast } from '@/composables/useToast'
import { formatShort } from '@/lib/format'
import { renderMarkdown } from '@/lib/markdown'

const catalog = useCatalogStore()
const toast = useToast()

interface Msg { id: string; role: 'user' | 'assistant'; content: string; recommendationIds?: string[] }

const status = ref<AIStatus | null>(null)
const statusError = ref('')
const conversations = ref<Conversation[]>([])
const conversationId = ref<string | undefined>()
const messages = ref<Msg[]>([])
const recs = ref<Recommendation[]>([])
const text = ref('')
const sending = ref(false)
const showHistory = ref(false)
const scroller = ref<HTMLElement | null>(null)

const EXAMPLES = [
  'Comment se passe ma progression ?',
  'Dois-je augmenter mes charges ?',
  'Comment améliorer mes pompes ?',
  'Quel groupe musculaire ai-je insuffisamment travaillé ?',
  'Adapte ma séance de demain.',
  'Que faire si j’ai raté une séance ?',
]

onMounted(async () => {
  catalog.load().catch(() => {})
  try {
    status.value = await getAIStatus()
  } catch (e) {
    statusError.value = e instanceof CoachError ? e.message : 'Service du coach injoignable. En local, lancez l’application avec « npm run dev » (Netlify).'
  }
  try {
    ;[conversations.value, recs.value] = await Promise.all([fetchConversations(), fetchRecommendations({ status: 'pending' })])
  } catch (e) { toast.error(e) }
})

const recById = computed(() => new Map(recs.value.map((r) => [r.id, r])))

async function openConversation(c: Conversation) {
  showHistory.value = false
  conversationId.value = c.id
  try {
    const rows = await fetchMessages(c.id)
    messages.value = rows.map((m) => ({ id: m.id, role: m.role, content: m.content, recommendationIds: (m.metadata as { recommendation_ids?: string[] })?.recommendation_ids }))
    const ids = messages.value.flatMap((m) => m.recommendationIds ?? []).filter((id) => !recById.value.has(id))
    if (ids.length) recs.value = [...recs.value, ...(await fetchRecommendations({ limit: 100 })).filter((r) => ids.includes(r.id))]
    scrollDown()
  } catch (e) { toast.error(e) }
}

function newConversation() {
  conversationId.value = undefined
  messages.value = []
  showHistory.value = false
}

async function removeConversation(c: Conversation) {
  if (!confirm('Supprimer cette conversation ?')) return
  try {
    await deleteConversation(c.id)
    conversations.value = conversations.value.filter((x) => x.id !== c.id)
    if (conversationId.value === c.id) newConversation()
  } catch (e) { toast.error(e) }
}

function scrollDown() {
  void nextTick(() => scroller.value?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
}

async function send(content = text.value) {
  const msg = content.trim()
  if (!msg || sending.value) return
  messages.value.push({ id: crypto.randomUUID(), role: 'user', content: msg })
  text.value = ''
  sending.value = true
  scrollDown()
  try {
    const r = await sendChat(msg, conversationId.value)
    if (!conversationId.value) {
      conversationId.value = r.conversation_id
      conversations.value = await fetchConversations()
    }
    recs.value = [...recs.value.filter((x) => !r.recommendations.some((n) => n.id === x.id)), ...r.recommendations]
    messages.value.push({ id: r.message.id, role: 'assistant', content: r.message.content, recommendationIds: r.recommendations.map((x) => x.id) })
  } catch (e) {
    messages.value.push({ id: crypto.randomUUID(), role: 'assistant', content: `⚠ ${e instanceof CoachError ? e.message : 'Le coach est momentanément indisponible.'}` })
  } finally {
    sending.value = false
    scrollDown()
  }
}

function updateRec(u: Recommendation) {
  recs.value = recs.value.map((r) => (r.id === u.id ? u : r))
}

const pendingOutside = computed(() => {
  const shown = new Set(messages.value.flatMap((m) => m.recommendationIds ?? []))
  return recs.value.filter((r) => r.status === 'pending' && !shown.has(r.id))
})
</script>

<template>
  <div class="flex min-h-[calc(100dvh-9rem)] flex-col lg:min-h-[calc(100dvh-4rem)]">
    <PageHeader title="Coach" subtitle="Réponses fondées sur vos données enregistrées">
      <div class="flex gap-1">
        <button type="button" class="grid size-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Nouvelle conversation" @click="newConversation"><Plus class="size-5" aria-hidden="true" /></button>
        <button type="button" class="grid size-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Conversations précédentes" @click="showHistory = true"><History class="size-5" aria-hidden="true" /></button>
      </div>
    </PageHeader>

    <div v-if="statusError || (status && !status.enabled)" class="rounded-2xl border border-dashed border-line p-5">
      <p class="font-semibold">Coach IA non disponible</p>
      <p class="mt-1 text-sm text-muted">
        {{ statusError || 'Aucun fournisseur IA n’est configuré (OPENAI_API_KEY ou ANTHROPIC_API_KEY côté serveur).' }}
        Le suivi, les bilans et les suggestions de progression fonctionnent sans IA.
      </p>
    </div>

    <section v-if="pendingOutside.length" class="mb-4 flex flex-col gap-3" aria-label="Recommandations en attente">
      <RecommendationCard v-for="r in pendingOutside" :key="r.id" :rec="r" @updated="updateRec" />
    </section>

    <div ref="scroller" class="flex flex-1 flex-col gap-3 pb-4" aria-live="polite">
      <div v-if="!messages.length && status?.enabled" class="my-auto">
        <Sparkles class="size-8 text-accent" aria-hidden="true" />
        <p class="mt-2 font-display text-3xl font-semibold leading-tight">Posez une question sur votre entraînement.</p>
        <p class="mt-1 text-sm text-muted">Le coach consulte votre profil, votre programme et votre historique réel. Il ne modifie rien sans votre accord.</p>
        <ul class="mt-5 flex flex-wrap gap-2">
          <li v-for="q in EXAMPLES" :key="q"><button type="button" class="rounded-xl bg-surface px-3.5 py-2.5 text-left text-sm font-medium hover:ring-2 hover:ring-accent/40" @click="send(q)">{{ q }}</button></li>
        </ul>
      </div>
      <template v-for="m in messages" :key="m.id">
        <div :class="m.role === 'user' ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-accent-ink' : 'max-w-[92%] rounded-2xl rounded-bl-md bg-surface px-4 py-3'">
          <p v-if="m.role === 'user'" class="whitespace-pre-line leading-relaxed">{{ m.content }}</p>
          <!-- Contenu échappé par renderMarkdown avant mise en forme -->
          <div v-else class="coach-md leading-relaxed" v-html="renderMarkdown(m.content)" />
        </div>
        <RecommendationCard v-for="rid in (m.recommendationIds ?? []).filter((id) => recById.has(id))" :key="rid" :rec="recById.get(rid)!" @updated="updateRec" />
      </template>
      <div v-if="sending" class="flex max-w-[92%] items-center gap-1.5 rounded-2xl bg-surface px-4 py-4" role="status" aria-label="Le coach rédige sa réponse">
        <span v-for="i in 3" :key="i" class="size-2 animate-bounce rounded-full bg-muted" :style="{ animationDelay: `${i * 120}ms` }" />
      </div>
    </div>

    <form v-if="status?.enabled" class="sticky bottom-20 flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-lg lg:bottom-4" @submit.prevent="send()">
      <label class="flex-1"><span class="sr-only">Votre message</span>
        <textarea v-model="text" rows="1" maxlength="2000" placeholder="Écrire au coach…" class="max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 outline-none"
          @keydown.enter.exact.prevent="send()" />
      </label>
      <button type="submit" class="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink disabled:opacity-40" :disabled="!text.trim() || sending" aria-label="Envoyer"><Send class="size-5" aria-hidden="true" /></button>
    </form>
    <p v-if="status?.enabled" class="mt-2 text-center text-xs text-muted">Le coach ne remplace pas un avis médical. Aujourd’hui : {{ status.usage_today.requests }}{{ status.usage_today.request_limit ? ` / ${status.usage_today.request_limit}` : '' }} requêtes.</p>

    <BottomSheet v-model:open="showHistory" title="Conversations">
      <ul v-if="conversations.length" class="flex flex-col gap-2">
        <li v-for="c in conversations" :key="c.id" class="flex items-center gap-2">
          <button type="button" class="flex-1 rounded-xl bg-surface-2 p-3 text-left" @click="openConversation(c)">
            <span class="block truncate font-medium">{{ c.title }}</span><span class="text-xs text-muted">{{ formatShort(c.updated_at) }}</span>
          </button>
          <button type="button" class="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Supprimer la conversation" @click="removeConversation(c)"><Trash2 class="size-4" aria-hidden="true" /></button>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">Aucune conversation.</p>
    </BottomSheet>
  </div>
</template>

<style scoped>
.coach-md :deep(p) { margin: 0 0 0.6em; }
.coach-md :deep(p:last-child) { margin-bottom: 0; }
.coach-md :deep(ul), .coach-md :deep(ol) { margin: 0 0 0.6em; padding-left: 1.25em; }
.coach-md :deep(ul) { list-style: disc; }
.coach-md :deep(ol) { list-style: decimal; }
.coach-md :deep(li) { margin: 0.15em 0; }
.coach-md :deep(strong) { font-weight: 600; }
</style>
