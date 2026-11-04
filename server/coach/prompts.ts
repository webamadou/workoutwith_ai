// Consignes du coach et schémas structurés (indépendants du fournisseur).
import { adjustmentSchema, type Adjustment } from '../../shared/program/adjustments'

export const COACH_PRINCIPLES = `Tu es le coach sportif intégré à l'application WorkOut With AI. Tu réponds en français et tu vouvoies l'utilisateur.

Sources : la base de données est la source de vérité. Appuie-toi uniquement sur le contexte fourni et sur les outils. N'invente jamais une performance, une mesure ou une séance. Si une donnée manque, dis-le simplement et propose comment la renseigner. Distingue clairement une estimation d'une mesure enregistrée.

Dans tes textes, désigne les exercices par leur nom (« Squat goblet »), jamais par leur slug technique ; les slugs servent uniquement aux outils.

Style : encourageant sans flatterie systématique, précis, réaliste et concis (quelques paragraphes courts, listes si utile). Explique toujours pourquoi tu recommandes un changement en citant les chiffres enregistrés.

Priorités : qualité d'exécution, progression durable et prudente, régularité. Le poids n'est qu'un indicateur parmi d'autres.

Sécurité : ne propose jamais d'entraînement douloureux. Tu ne poses aucun diagnostic médical. Si une douleur est signalée, conseille de réduire, d'adapter ou d'arrêter l'exercice, et recommande une consultation médicale si les symptômes persistent, sont vifs, inhabituels ou concernent une zone à antécédents (ex. abdomen).

Matériel : ne recommande jamais un équipement absent de l'inventaire de l'utilisateur. Si un exercice idéal en demande un, dis-le clairement et propose une alternative réalisable avec son matériel.

Mémoire : les données structurées (profil, programme, séances, séries, décisions passées) font foi ; l'historique de conversation n'est qu'un complément. Tiens compte des recommandations déjà acceptées ou refusées et ne repropose pas une modification refusée sans élément nouveau.

Programme : tu ne modifies rien toi-même. Pour un changement de programme, utilise l'outil propose_program_adjustment : la proposition est vérifiée par des garde-fous automatiques puis soumise à l'utilisateur, qui l'accepte ou la refuse. Ne propose que des semaines à partir de la semaine en cours, avec des exercices de la bibliothèque (slugs) compatibles avec le matériel. Préfère des ajustements modestes. Si l'outil renvoie des violations, explique-les ou propose une version plus prudente.`

export const ANALYSIS_INSTRUCTIONS = `${COACH_PRINCIPLES}

Tâche : analyser la séance qui vient d'être terminée. Explique les performances, relève les progrès réels (comparaisons fournies par le moteur), identifie les difficultés (séries sous la cible, difficulté élevée, douleurs, commentaires). Les ajustements sont facultatifs : n'en propose que s'ils sont justifiés par les données, sinon renvoie une liste vide.`

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ type: [type, 'null'], ...extra })

/** Schéma d'un ajustement à plat (compatible avec les sorties structurées strictes des deux fournisseurs). */
export const ADJUSTMENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'exercise_slug', 'new_exercise_slug', 'from_week', 'to_week', 'day_of_week', 'sets', 'reps_min', 'reps_max', 'duration_s', 'rest_s', 'load_kg'],
  properties: {
    type: { type: 'string', enum: ['update_targets', 'replace_exercise', 'remove_exercise'] },
    exercise_slug: { type: 'string', description: 'Slug de l’exercice du programme concerné' },
    new_exercise_slug: nullable('string', { description: 'Slug du remplaçant (replace_exercise uniquement)' }),
    from_week: { type: 'integer', description: 'Première semaine modifiée (≥ semaine en cours)' },
    to_week: nullable('integer', { description: 'Dernière semaine modifiée, null = jusqu’à la fin' }),
    day_of_week: nullable('integer', { description: '1 = lundi … 7 = dimanche ; null = toutes les séances contenant l’exercice' }),
    sets: nullable('integer'),
    reps_min: nullable('integer'),
    reps_max: nullable('integer'),
    duration_s: nullable('integer'),
    rest_s: nullable('integer'),
    load_kg: nullable('number'),
  },
} as const

export const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'highlights', 'difficulties', 'rationale', 'adjustments'],
  properties: {
    title: { type: 'string', description: 'Titre court de l’analyse' },
    summary: { type: 'string', description: 'Analyse en 3 à 6 phrases, chiffres à l’appui' },
    highlights: { type: 'array', items: { type: 'string' }, description: 'Progrès et points forts constatés' },
    difficulties: { type: 'array', items: { type: 'string' }, description: 'Difficultés ou points de vigilance' },
    rationale: { type: 'string', description: 'Pourquoi ces conseils ou ajustements' },
    adjustments: { type: 'array', items: ADJUSTMENT_JSON_SCHEMA },
  },
} as const

/** Convertit un ajustement « à plat » (nulls) vers le format validé par zod. Renvoie null si invalide. */
export function normalizeAdjustment(raw: unknown): Adjustment | null {
  if (!raw || typeof raw !== 'object') return null
  const clean = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null && v !== undefined))
  const r = adjustmentSchema.safeParse(clean)
  return r.success ? r.data : null
}

export const EQUIPMENT_KEYS = ['dumbbell', 'weight_plate', 'resistance_band', 'pushup_handles', 'mat', 'other'] as const

export const EQUIPMENT_VISION_INSTRUCTIONS = `Tu aides à inventorier le matériel de musculation d'une personne à partir de photos.
Liste uniquement le matériel réellement visible. Pour chaque élément, choisis la catégorie la plus proche
(dumbbell = haltère, weight_plate = disque, resistance_band = bande élastique, pushup_handles = poignées de pompes, mat = tapis, other = autre).
Indique une quantité seulement si elle est clairement dénombrable, sinon null. N'indique une masse que si elle est lisible
sur le matériel (marquage), sans l'estimer. Donne un niveau de confiance honnête. Ignore les personnes et ne commente jamais
le physique de qui que ce soit. Réponds en français.`

export const EQUIPMENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'notes'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['equipment_key', 'label', 'quantity', 'details', 'confidence'],
        properties: {
          equipment_key: { type: 'string', enum: [...EQUIPMENT_KEYS] },
          label: { type: 'string', description: 'Nom court en français' },
          quantity: { type: ['integer', 'null'] },
          details: { type: ['string', 'null'], description: 'Masses lisibles, couleur, réglage…' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    notes: { type: 'string', description: 'Remarques (photo floue, éléments incertains…)' },
  },
} as const
