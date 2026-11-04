// Propositions déterministes de continuité (sans IA), enregistrées comme recommandations « en attente ».
import { supabase, unwrap } from '@/lib/supabase'
import { checkAdjustments } from '@shared/program/adjustments'
import type { PlanDraft } from '@shared/program/types'
import { continuityProposals, equipmentProposal, type ContinuityInput, type ContinuityProposal } from '@shared/progression/continuity'

async function store(proposals: ContinuityProposal[], draft: PlanDraft, ctx: Pick<ContinuityInput, 'currentWeek' | 'exercises' | 'ownedEquipment' | 'avoidedSlugs'>) {
  const ok = proposals.filter((p) => checkAdjustments(draft, p.adjustments, ctx.exercises, {
    currentWeek: ctx.currentWeek, ownedEquipment: ctx.ownedEquipment, avoidedSlugs: ctx.avoidedSlugs,
  }).ok)
  if (!ok.length) return 0
  // Un déclencheur déjà traité (même refusé) n'est jamais reproposé grâce à la contrainte (user_id, trigger_key).
  const rows = ok.map((p) => ({
    kind: 'program_adjustment', source: 'rules', trigger_key: p.trigger_key, title: p.title, summary: p.summary,
    rationale: p.rationale, adjustments: p.adjustments as never, engine_facts: p.facts as never,
  }))
  const res = unwrap(await supabase.from('coach_recommendations').upsert(rows, { onConflict: 'user_id,trigger_key', ignoreDuplicates: true }).select('id'))
  return res.length
}

export async function refreshContinuity(input: ContinuityInput) {
  return store(continuityProposals(input), input.draft, input)
}

export async function proposeForEquipment(input: Parameters<typeof equipmentProposal>[0]) {
  const p = equipmentProposal(input)
  return p ? store([p], input.draft, input) : 0
}
