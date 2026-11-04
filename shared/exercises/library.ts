// Bibliothèque d'exercices de référence.
// Source unique : la migration SQL est générée par scripts/generate-exercise-library.ts.
import { FLOOR, L, STAND_HIP, polar, sideAnim, type PoseAnimation, type Pt, type SideSpec } from './poses'

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'core' | 'forearms'

export type EquipmentKey = 'dumbbell' | 'weight_plate' | 'resistance_band' | 'pushup_handles' | 'mat'

export interface ExerciseDef {
  slug: string
  name: string
  description: string
  primary_muscle: MuscleGroup
  secondary_muscles: MuscleGroup[]
  equipment: EquipmentKey[]
  difficulty: 1 | 2 | 3
  measurement: 'reps' | 'duration'
  is_unilateral?: boolean
  instructions: string[]
  safety_tips: string[]
  caution_tags?: string[]
  default_rest_s: number
  animation: PoseAnimation
  alt: string
}

const F = FLOOR
const A = STAND_HIP // hanche debout
const standLegs = { leg: { a: [-90, -90] as [number, number] } }
const hang = { a: [-84, -87] as [number, number] }
const T = (move: number, hold = 0.3) => ({ move, hold })

// --- Pompes : corps gainé pivotant autour des pieds -------------------------
function plank(ankle: Pt, theta: number, hand: Pt, toe = -60): SideSpec {
  const len = L.thigh + L.shin
  const hip = polar(ankle, len, theta) // hanches alignées chevilles → épaules
  return {
    hip, torso: theta, toe,
    leg: { a: [180 + theta, 180 + theta] },
    arm: { to: hand, bend: 1 },
  }
}
function kneePlank(knee: Pt, theta: number, hand: Pt): SideSpec {
  const hip = polar(knee, L.thigh, theta)
  return {
    hip, torso: theta, toe: 160,
    leg: { mid: knee, end: polar(knee, L.shin, 165) },
    arm: { to: hand, bend: 1 },
  }
}

const pushupAnim = (handles: boolean) =>
  sideAnim(
    [plank([40, F - 8], 22.3, [152, F - 4]), plank([40, F - 8], 6, [152, F - 4])],
    [T(1.1, 0.4), T(1.1, 0.6)],
    { viewBox: '0 70 240 120', props: { mat: true, handles: handles ? ['hand'] : undefined } },
  )

// --- Positions allongées ----------------------------------------------------
const lieY = F - 10
const supineLegs = { leg: { to: [66, F - 4] as Pt, bend: -1 as const }, toe: 0 }

export const EXERCISES: ExerciseDef[] = [
  {
    slug: 'pompes',
    name: 'Pompes',
    description: 'Mouvement de poussée au poids du corps qui développe les pectoraux, les triceps et la stabilité du tronc. Réalisable avec des poignées pour soulager les poignets et augmenter l’amplitude.',
    primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders', 'core'],
    equipment: [], difficulty: 2, measurement: 'reps', default_rest_s: 75,
    instructions: [
      'Mains (ou poignées) un peu plus larges que les épaules, bras tendus.',
      'Corps gainé de la tête aux talons : serrer les fessiers et le ventre.',
      'Descendre en contrôlant, coudes à environ 45° du buste.',
      'Marquer une courte pause en bas sans relâcher le gainage.',
      'Pousser le sol pour remonter en gardant le corps aligné.',
    ],
    safety_tips: [
      'Ne pas laisser le bassin s’affaisser ni monter.',
      'Arrêter en cas de douleur aux poignets, aux épaules ou à l’abdomen.',
      'Si la tension abdominale est inconfortable, passer aux pompes inclinées.',
    ],
    caution_tags: ['abdominal', 'wrists'],
    animation: pushupAnim(true), alt: 'Pompes : descente du corps gainé puis poussée bras tendus',
  },
  {
    slug: 'pompes-inclinees',
    name: 'Pompes inclinées',
    description: 'Variante plus accessible des pompes, mains en appui sur un support surélevé (canapé, table basse, marche).',
    primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders'],
    equipment: [], difficulty: 1, measurement: 'reps', default_rest_s: 60,
    instructions: [
      'Mains sur un support stable, à hauteur de hanches ou un peu plus bas.',
      'Reculer les pieds pour aligner tête, bassin et talons.',
      'Descendre la poitrine vers le bord du support, coudes à 45°.',
      'Pousser pour revenir bras tendus.',
    ],
    safety_tips: ['Vérifier que le support ne glisse pas.', 'Plus le support est bas, plus l’exercice est difficile.'],
    animation: sideAnim(
      [plank([50, F - 8], 46, [134, F - 45]), plank([50, F - 8], 27, [134, F - 45])],
      [T(1.1, 0.4), T(1.1, 0.5)],
      { viewBox: '0 40 240 150', props: { box: { x: 112, y: F - 45, w: 50, h: 45 } } },
    ),
    alt: 'Pompes inclinées mains sur un support surélevé',
  },
  {
    slug: 'pompes-genoux',
    name: 'Pompes sur les genoux',
    description: 'Variante de pompes en appui sur les genoux, utile pour accumuler du volume avec une bonne technique.',
    primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders'],
    equipment: [], difficulty: 1, measurement: 'reps', default_rest_s: 60,
    instructions: [
      'Genoux au sol sur un tapis, mains sous les épaules.',
      'Aligner genoux, bassin et épaules.',
      'Descendre la poitrine en contrôlant puis pousser.',
    ],
    safety_tips: ['Protéger les genoux avec un tapis ou une serviette pliée.'],
    animation: sideAnim(
      [kneePlank([60, F - 4], 35.5, [130, F - 4]), kneePlank([60, F - 4], 11, [130, F - 4])],
      [T(1, 0.4), T(1, 0.5)],
      { viewBox: '0 70 240 120', props: { mat: true } },
    ),
    alt: 'Pompes en appui sur les genoux',
  },
  {
    slug: 'rowing-halteres',
    name: 'Rowing avec haltères',
    description: 'Tirage buste penché qui renforce le haut du dos et les biceps, et équilibre le travail de poussée.',
    primary_muscle: 'back', secondary_muscles: ['biceps', 'shoulders'],
    equipment: ['dumbbell'], difficulty: 2, measurement: 'reps', default_rest_s: 90,
    instructions: [
      'Pieds largeur de hanches, genoux légèrement fléchis.',
      'Pencher le buste vers l’avant en gardant le dos droit (charnière de hanches).',
      'Tirer les haltères vers le bas des côtes, coudes près du corps.',
      'Serrer les omoplates en haut, puis redescendre lentement.',
    ],
    safety_tips: ['Garder le dos neutre, ne pas arrondir le bas du dos.', 'Choisir une charge qui permet de contrôler la descente.'],
    caution_tags: ['lower_back'],
    animation: sideAnim(
      [
        { hip: [98, 108], torso: 35, leg: { to: [118, F - 4], bend: 1 }, arm: hang },
        { hip: [98, 108], torso: 35, leg: { to: [118, F - 4], bend: 1 }, arm: { a: [-125, -90] } },
      ],
      [T(0.9, 0.5), T(1.3, 0.3)],
      { props: { dumbbells: ['hand'] } },
    ),
    alt: 'Rowing buste penché avec haltères',
  },
  {
    slug: 'rowing-unilateral',
    name: 'Rowing unilatéral',
    description: 'Tirage d’un bras en appui, qui permet de se concentrer sur chaque côté du dos.',
    primary_muscle: 'back', secondary_muscles: ['biceps', 'shoulders', 'core'],
    equipment: ['dumbbell'], difficulty: 2, measurement: 'reps', is_unilateral: true, default_rest_s: 75,
    instructions: [
      'Position fente avant, main libre posée sur la cuisse avant.',
      'Dos droit, buste incliné, haltère bras tendu sous l’épaule.',
      'Tirer le coude vers la hanche, sans tourner le buste.',
      'Redescendre lentement puis changer de côté après la série.',
    ],
    safety_tips: ['Garder les épaules parallèles au sol.', 'Ne pas tirer avec le bas du dos.'],
    animation: sideAnim(
      [
        { hip: [100, 112], torso: 32, leg: { to: [84, F - 4], bend: 1 }, leg2: { to: [142, F - 4], bend: 1 }, arm: hang, arm2: { mid: [150, 112], end: [146, 128] } },
        { hip: [100, 112], torso: 32, leg: { to: [84, F - 4], bend: 1 }, leg2: { to: [142, F - 4], bend: 1 }, arm: { a: [-128, -90] }, arm2: { mid: [150, 112], end: [146, 128] } },
      ],
      [T(0.9, 0.5), T(1.3, 0.3)],
      { props: { dumbbells: ['hand'] } },
    ),
    alt: 'Rowing unilatéral avec haltère, main libre en appui sur la cuisse',
  },
  {
    slug: 'developpe-sol',
    name: 'Développé au sol',
    description: 'Développé couché réalisé au sol avec haltères : l’amplitude limitée protège les épaules.',
    primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders'],
    equipment: ['dumbbell'], difficulty: 1, measurement: 'reps', default_rest_s: 90,
    instructions: [
      'Allongé sur le dos, genoux fléchis, pieds à plat.',
      'Haltères au-dessus de la poitrine, bras tendus.',
      'Descendre jusqu’à ce que les coudes touchent légèrement le sol, à 45° du buste.',
      'Pousser les haltères vers le plafond.',
    ],
    safety_tips: ['Ne pas faire rebondir les coudes au sol.', 'Garder les poignets alignés avec les avant-bras.'],
    animation: sideAnim(
      [
        { hip: [100, lieY], torso: 0, head: [164, lieY - 1], ...supineLegs, arm: { a: [90, 90] } },
        { hip: [100, lieY], torso: 0, head: [164, lieY - 1], ...supineLegs, arm: { a: [-158, 90] } },
      ],
      [T(1, 0.3), T(1.3, 0.4)],
      { viewBox: '0 70 240 120', props: { mat: true, dumbbells: ['hand'] } },
    ),
    alt: 'Développé au sol avec haltères, allongé sur le dos',
  },
  {
    slug: 'tirage-elastique',
    name: 'Tirage avec élastique',
    description: 'Tirage horizontal assis avec bande élastique, idéal pour renforcer le dos sans charge lourde.',
    primary_muscle: 'back', secondary_muscles: ['biceps', 'shoulders'],
    equipment: ['resistance_band'], difficulty: 1, measurement: 'reps', default_rest_s: 60,
    instructions: [
      'Assis au sol, jambes tendues, élastique passé sous les pieds.',
      'Buste droit, bras tendus devant soi.',
      'Tirer les mains vers le nombril en serrant les omoplates.',
      'Revenir lentement en contrôlant la tension.',
    ],
    safety_tips: ['Vérifier l’état de l’élastique avant usage.', 'Ne pas basculer le buste en arrière pour tirer.'],
    animation: sideAnim(
      [
        { hip: [90, F - 8], torso: 95, leg: { a: [0, 0] }, toe: 80, arm: { a: [-20, -20] } },
        { hip: [90, F - 8], torso: 95, leg: { a: [0, 0] }, toe: 80, arm: { a: [-150, 0] } },
      ],
      [T(1.1, 0.4), T(1.2, 0.3)],
      { viewBox: '0 60 240 130', props: { mat: true, band: { anchor: [161, F - 10], to: ['hand'] } } },
    ),
    alt: 'Tirage assis avec élastique passé sous les pieds',
  },
  {
    slug: 'curl-biceps',
    name: 'Curl biceps',
    description: 'Flexion des coudes avec haltères pour renforcer les biceps.',
    primary_muscle: 'biceps', secondary_muscles: ['forearms'],
    equipment: ['dumbbell'], difficulty: 1, measurement: 'reps', default_rest_s: 60,
    instructions: [
      'Debout, haltères en main, paumes vers l’avant.',
      'Coudes collés au buste, fléchir pour monter les haltères.',
      'Marquer un temps en haut puis redescendre lentement.',
    ],
    safety_tips: ['Ne pas balancer le buste.', 'Descendre jusqu’à l’extension complète sans verrouiller brutalement.'],
    animation: sideAnim(
      [{ hip: A, torso: 90, ...standLegs, arm: hang }, { hip: A, torso: 90, ...standLegs, arm: { a: [-90, 75] } }],
      [T(1.1, 0.4), T(0.9, 0.4)],
      { props: { dumbbells: ['hand'] } },
    ),
    alt: 'Curl biceps debout avec haltères',
  },
  {
    slug: 'extension-triceps',
    name: 'Extension triceps',
    description: 'Extension des coudes avec un haltère tenu au-dessus de la tête.',
    primary_muscle: 'triceps', secondary_muscles: ['shoulders'],
    equipment: ['dumbbell'], difficulty: 1, measurement: 'reps', default_rest_s: 60,
    instructions: [
      'Debout ou assis, haltère tenu à deux mains au-dessus de la tête.',
      'Garder les coudes pointés vers l’avant et proches de la tête.',
      'Descendre l’haltère derrière la tête en fléchissant les coudes.',
      'Tendre les bras pour remonter.',
    ],
    safety_tips: ['Contrôler la descente pour ne pas heurter la nuque.', 'Gainer le ventre pour ne pas cambrer.'],
    caution_tags: ['shoulders'],
    animation: sideAnim(
      [{ hip: A, torso: 90, ...standLegs, arm: { a: [95, 92] } }, { hip: A, torso: 90, ...standLegs, arm: { a: [95, -100] } }],
      [T(1, 0.3), T(1.2, 0.4)],
      { props: { dumbbells: ['hand'] } },
    ),
    alt: 'Extension triceps haltère au-dessus de la tête',
  },
  {
    slug: 'squat-goblet',
    name: 'Squat goblet',
    description: 'Squat avec un haltère tenu contre la poitrine : renforce les cuisses et les fessiers en favorisant un buste droit.',
    primary_muscle: 'quads', secondary_muscles: ['glutes', 'core'],
    equipment: ['dumbbell'], difficulty: 2, measurement: 'reps', default_rest_s: 90,
    instructions: [
      'Pieds un peu plus larges que les hanches, pointes légèrement ouvertes.',
      'Haltère tenu verticalement contre la poitrine.',
      'Descendre en poussant les hanches en arrière et les genoux vers l’extérieur.',
      'Remonter en poussant dans tout le pied.',
    ],
    safety_tips: ['Garder les talons au sol.', 'Descendre seulement aussi bas que le dos reste neutre.'],
    caution_tags: ['knees'],
    animation: sideAnim(
      [
        { hip: A, torso: 90, ...standLegs, arm: { a: [-80, 60] } },
        { hip: [102, 140], torso: 60, leg: { to: [120, F - 4], bend: 1 }, arm: { a: [-70, 78] } },
      ],
      [T(1.2, 0.3), T(1.1, 0.4)],
      { props: { dumbbells: ['hand'] } },
    ),
    alt: 'Squat goblet avec haltère contre la poitrine',
  },
  {
    slug: 'squat-pause',
    name: 'Squat avec pause',
    description: 'Squat au poids du corps (ou avec haltère) avec une pause de 2 secondes en bas, pour renforcer le contrôle et la position basse.',
    primary_muscle: 'quads', secondary_muscles: ['glutes', 'core'],
    equipment: [], difficulty: 2, measurement: 'reps', default_rest_s: 90,
    instructions: [
      'Pieds largeur d’épaules, bras tendus devant pour l’équilibre.',
      'Descendre en contrôlant jusqu’à la position basse confortable.',
      'Tenir 2 secondes sans relâcher la tension.',
      'Remonter de façon dynamique.',
    ],
    safety_tips: ['Respirer pendant la pause, ne pas bloquer longtemps la respiration.'],
    caution_tags: ['knees'],
    animation: sideAnim(
      [
        { hip: A, torso: 90, ...standLegs, arm: hang },
        { hip: [102, 140], torso: 60, leg: { to: [120, F - 4], bend: 1 }, arm: { a: [5, 5] } },
      ],
      [T(1.2, 0.3), T(1.4, 2)],
    ),
    alt: 'Squat avec pause de deux secondes en position basse',
  },
  {
    slug: 'squat-poids-corps',
    name: 'Squat au poids du corps',
    description: 'Squat sans charge, pour apprendre le mouvement ou travailler en volume.',
    primary_muscle: 'quads', secondary_muscles: ['glutes'],
    equipment: [], difficulty: 1, measurement: 'reps', default_rest_s: 60,
    instructions: ['Pieds largeur d’épaules.', 'Descendre hanches en arrière, buste fier.', 'Remonter en poussant dans les talons.'],
    safety_tips: ['Genoux dans l’axe des pieds.'],
    animation: sideAnim(
      [
        { hip: A, torso: 90, ...standLegs, arm: hang },
        { hip: [102, 140], torso: 60, leg: { to: [120, F - 4], bend: 1 }, arm: { a: [5, 5] } },
      ],
      [T(1.1, 0.3), T(1.1, 0.3)],
    ),
    alt: 'Squat au poids du corps, bras tendus devant',
  },
  {
    slug: 'fentes-arriere',
    name: 'Fentes arrière',
    description: 'Fente en reculant une jambe : travail unilatéral des cuisses et des fessiers, plus doux pour les genoux que la fente avant.',
    primary_muscle: 'quads', secondary_muscles: ['glutes', 'hamstrings'],
    equipment: [], difficulty: 2, measurement: 'reps', is_unilateral: true, default_rest_s: 75,
    instructions: [
      'Debout, pieds largeur de hanches (haltères en main en option).',
      'Reculer une jambe et descendre jusqu’à frôler le sol avec le genou arrière.',
      'Le genou avant reste au-dessus du pied.',
      'Pousser sur la jambe avant pour revenir debout.',
    ],
    safety_tips: ['Garder le buste droit.', 'Faire des pas assez grands pour que le genou avant ne dépasse pas trop les orteils.'],
    caution_tags: ['knees'],
    animation: sideAnim(
      [
        { hip: A, torso: 90, ...standLegs, leg2: { a: [-90, -90] }, arm: hang },
        { hip: [108, 138], torso: 88, leg: { to: [132, F - 4], bend: 1 }, leg2: { to: [66, F - 10], bend: 1 }, toe2: -40, arm: hang },
      ],
      [T(1.2, 0.3), T(1.1, 0.3)],
    ),
    alt: 'Fente arrière : jambe arrière reculée, genou proche du sol',
  },
  {
    slug: 'souleve-terre-roumain',
    name: 'Soulevé de terre roumain',
    description: 'Charnière de hanches avec haltères qui cible l’arrière des cuisses et les fessiers.',
    primary_muscle: 'hamstrings', secondary_muscles: ['glutes', 'back'],
    equipment: ['dumbbell'], difficulty: 2, measurement: 'reps', default_rest_s: 90,
    instructions: [
      'Debout, haltères devant les cuisses, genoux légèrement fléchis.',
      'Pousser les hanches en arrière en gardant le dos droit.',
      'Descendre les haltères le long des jambes jusqu’à mi-tibia ou à l’étirement.',
      'Revenir en serrant les fessiers.',
    ],
    safety_tips: ['Ne jamais arrondir le dos.', 'Les haltères restent proches des jambes.', 'Stopper si une douleur lombaire apparaît.'],
    caution_tags: ['lower_back'],
    animation: sideAnim(
      [
        { hip: A, torso: 90, ...standLegs, arm: hang },
        { hip: [96, 110], torso: 20, leg: { to: [120, F - 4], bend: 1 }, arm: hang },
      ],
      [T(1, 0.3), T(1.4, 0.4)],
      { props: { dumbbells: ['hand'] } },
    ),
    alt: 'Soulevé de terre roumain : hanches poussées en arrière, dos droit',
  },
  {
    slug: 'developpe-epaules',
    name: 'Développé épaules',
    description: 'Poussée verticale avec haltères pour renforcer les épaules et les triceps.',
    primary_muscle: 'shoulders', secondary_muscles: ['triceps', 'core'],
    equipment: ['dumbbell'], difficulty: 2, measurement: 'reps', default_rest_s: 90,
    instructions: [
      'Debout ou assis, haltères à hauteur d’épaules, paumes vers l’avant.',
      'Gainer le ventre et serrer les fessiers.',
      'Pousser les haltères au-dessus de la tête sans cambrer.',
      'Redescendre lentement à hauteur d’épaules.',
    ],
    safety_tips: ['Ne pas cambrer le bas du dos.', 'Réduire la charge si l’épaule pince.'],
    caution_tags: ['shoulders'],
    animation: sideAnim(
      [{ hip: A, torso: 90, ...standLegs, arm: { a: [-60, 85] } }, { hip: A, torso: 90, ...standLegs, arm: { a: [88, 88] } }],
      [T(1.2, 0.3), T(1, 0.4)],
      { props: { dumbbells: ['hand'] } },
    ),
    alt: 'Développé épaules debout avec haltères',
  },
  {
    slug: 'elevations-laterales',
    name: 'Élévations latérales',
    description: 'Élévation des bras sur les côtés pour cibler la partie moyenne des épaules.',
    primary_muscle: 'shoulders', secondary_muscles: [],
    equipment: ['dumbbell'], difficulty: 1, measurement: 'reps', default_rest_s: 60,
    instructions: [
      'Debout, haltères légers le long du corps, coudes très légèrement fléchis.',
      'Monter les bras sur les côtés jusqu’à hauteur d’épaules.',
      'Redescendre lentement.',
    ],
    safety_tips: ['Utiliser une charge légère.', 'Ne pas hausser les épaules.'],
    caution_tags: ['shoulders'],
    animation: frontRaise(),
    alt: 'Élévations latérales vues de face, bras montés à hauteur d’épaules',
  },
  {
    slug: 'dead-bug',
    name: 'Dead bug',
    description: 'Exercice de gainage allongé sur le dos qui apprend à stabiliser le bassin pendant que les membres bougent.',
    primary_muscle: 'core', secondary_muscles: [],
    equipment: [], difficulty: 1, measurement: 'reps', default_rest_s: 60,
    instructions: [
      'Allongé sur le dos, bras tendus vers le plafond, hanches et genoux à 90°.',
      'Plaquer le bas du dos au sol et expirer.',
      'Allonger lentement un bras derrière la tête et la jambe opposée.',
      'Revenir puis alterner. Une répétition = un côté.',
    ],
    safety_tips: [
      'Le bas du dos ne doit pas se décoller du sol.',
      'Réduire l’amplitude ou arrêter en cas de douleur abdominale.',
    ],
    caution_tags: ['abdominal'],
    animation: sideAnim(
      [
        { hip: [110, lieY], torso: 0, head: [174, lieY - 1], arm: { a: [90, 90] }, arm2: { a: [92, 92] }, leg: { a: [90, 180] }, leg2: { a: [92, 180] }, toe: 180 },
        { hip: [110, lieY], torso: 0, head: [174, lieY - 1], arm: { a: [12, 8] }, arm2: { a: [92, 92] }, leg: { a: [166, 176] }, leg2: { a: [92, 180] }, toe: 180 },
      ],
      [T(1.4, 0.3), T(1.4, 0.6)],
      { viewBox: '0 70 240 120', props: { mat: true } },
    ),
    alt: 'Dead bug : bras et jambe opposés allongés, dos plaqué au sol',
  },
  {
    slug: 'bird-dog',
    name: 'Bird dog',
    description: 'Gainage à quatre pattes en allongeant bras et jambe opposés : doux pour le dos et l’abdomen.',
    primary_muscle: 'core', secondary_muscles: ['glutes', 'back'],
    equipment: [], difficulty: 1, measurement: 'reps', default_rest_s: 45,
    instructions: [
      'À quatre pattes, mains sous les épaules, genoux sous les hanches.',
      'Allonger un bras devant et la jambe opposée derrière.',
      'Garder le bassin stable et le dos plat, puis revenir et alterner.',
    ],
    safety_tips: ['Ne pas cambrer en montant la jambe.'],
    animation: sideAnim(
      [
        { hip: [80, 140], torso: 0, arm: { a: [-90, -90] }, arm2: { a: [-88, -90] }, leg: { a: [-90, 180] }, leg2: { a: [-88, 180] }, toe: 180, toe2: 180 },
        { hip: [80, 140], torso: 0, arm: { a: [-90, -90] }, arm2: { a: [2, 2] }, leg: { a: [178, 180] }, leg2: { a: [-88, 180] }, toe: 180, toe2: 180 },
      ],
      [T(1.3, 0.3), T(1.3, 0.8)],
      { viewBox: '0 70 240 120', props: { mat: true } },
    ),
    alt: 'Bird dog à quatre pattes, bras et jambe opposés allongés',
  },
  {
    slug: 'pont-fessier',
    name: 'Pont fessier',
    description: 'Élévation du bassin allongé sur le dos pour renforcer les fessiers et l’arrière des cuisses.',
    primary_muscle: 'glutes', secondary_muscles: ['hamstrings', 'core'],
    equipment: [], difficulty: 1, measurement: 'reps', default_rest_s: 60,
    instructions: [
      'Allongé sur le dos, genoux fléchis, pieds à plat proches des fesses.',
      'Pousser dans les talons pour monter le bassin.',
      'Serrer les fessiers en haut, sans cambrer.',
      'Redescendre lentement.',
    ],
    safety_tips: ['L’effort doit se sentir dans les fessiers, pas dans le bas du dos.'],
    animation: sideAnim(
      [
        { hip: [100, lieY + 2], torso: 2, head: [165, lieY - 2], leg: { to: [64, F - 4], bend: -1 }, arm: { a: [182, 180] }, toe: 0 },
        { hip: [108, 142], torso: -34, head: [165, lieY - 2], leg: { to: [64, F - 4], bend: -1 }, arm: { a: [-160, 180] }, toe: 0 },
      ],
      [T(1.1, 0.3), T(1, 1)],
      { viewBox: '0 70 240 120', props: { mat: true } },
    ),
    alt: 'Pont fessier : bassin monté, épaules au sol',
  },
  {
    slug: 'face-pull-elastique',
    name: 'Face pull à l’élastique',
    description: 'Tirage de l’élastique vers le visage, coudes hauts : renforce l’arrière des épaules et améliore la posture.',
    primary_muscle: 'shoulders', secondary_muscles: ['back'],
    equipment: ['resistance_band'], difficulty: 1, measurement: 'reps', default_rest_s: 60,
    instructions: [
      'Élastique fixé à hauteur de visage (porte, poteau).',
      'Bras tendus devant, paumes vers le bas.',
      'Tirer les mains vers le front en écartant les coudes vers l’extérieur et vers le haut.',
      'Serrer les omoplates puis revenir lentement.',
    ],
    safety_tips: ['Vérifier la solidité du point d’ancrage.', 'Garder le cou détendu.'],
    animation: sideAnim(
      [
        { hip: A, torso: 90, ...standLegs, arm: { a: [5, 5] } },
        { hip: A, torso: 90, ...standLegs, arm: { mid: [110, 50], end: [130, 34] } },
      ],
      [T(1.1, 0.3), T(1, 0.5)],
      { props: { band: { anchor: [222, 52], to: ['hand'] } } },
    ),
    alt: 'Face pull : élastique tiré vers le visage, coudes hauts',
  },
  {
    slug: 'planche-laterale',
    name: 'Planche latérale',
    description: 'Gainage sur le côté en appui sur l’avant-bras, qui renforce les obliques et la stabilité du bassin.',
    primary_muscle: 'core', secondary_muscles: ['shoulders', 'glutes'],
    equipment: [], difficulty: 2, measurement: 'duration', default_rest_s: 45,
    instructions: [
      'Allongé sur le côté, coude sous l’épaule, jambes tendues.',
      'Monter le bassin pour aligner chevilles, hanches et épaules.',
      'Tenir la position en respirant calmement, puis changer de côté.',
      'Variante facile : genoux fléchis au sol.',
    ],
    safety_tips: ['Ne pas laisser le bassin s’affaisser.', 'Arrêter en cas de douleur abdominale ou à l’épaule.'],
    caution_tags: ['abdominal', 'shoulders'],
    animation: {
      viewBox: '0 70 240 120',
      chains: [
        { points: ['hip', 'knee', 'ankle'] },
        { points: ['neck', 'hip'] },
        { points: ['neck', 'elbow', 'hand'] },
        { points: ['neck', 'elbow2', 'hand2'], far: true },
      ],
      head: 'head',
      frames: [
        { ankle: [40, 174], knee: [74, 174], hip: [108, 172], neck: [165, 150], head: [178, 143], elbow: [165, 176], hand: [188, 176], elbow2: [142, 146], hand2: [120, 160] },
        { ankle: [40, 174], knee: [75, 166], hip: [111, 158], neck: [165, 147], head: [178, 140], elbow: [165, 176], hand: [188, 176], elbow2: [142, 140], hand2: [120, 152] },
      ],
      timing: [T(0.9, 0.2), T(0.9, 3)],
      props: { mat: true },
    },
    alt: 'Planche latérale en appui sur l’avant-bras',
  },
]

/** Élévations latérales : silhouette de face. */
function frontRaise(): PoseAnimation {
  const base = {
    head: [120, 40] as Pt, neck: [120, 55] as Pt, pelvis: [120, 105] as Pt,
    shoulderL: [104, 60] as Pt, shoulderR: [136, 60] as Pt, hipL: [111, 105] as Pt, hipR: [129, 105] as Pt,
    kneeL: [110, 141] as Pt, kneeR: [130, 141] as Pt, ankleL: [109, 176] as Pt, ankleR: [131, 176] as Pt,
  }
  return {
    viewBox: '0 0 240 190',
    head: 'head',
    chains: [
      { points: ['shoulderL', 'shoulderR'] },
      { points: ['neck', 'pelvis'] },
      { points: ['hipL', 'hipR'] },
      { points: ['hipL', 'kneeL', 'ankleL'] },
      { points: ['hipR', 'kneeR', 'ankleR'] },
      { points: ['shoulderL', 'elbowL', 'handL'] },
      { points: ['shoulderR', 'elbowR', 'handR'] },
    ],
    frames: [
      { ...base, elbowL: [101, 85], handL: [100, 108], elbowR: [139, 85], handR: [140, 108] },
      { ...base, elbowL: [79, 62], handL: [56, 66], elbowR: [161, 62], handR: [184, 66] },
    ],
    timing: [T(1.1, 0.3), T(1, 0.5)],
    props: { dumbbells: ['handL', 'handR'] },
  }
}

export const EXERCISE_BY_SLUG = new Map(EXERCISES.map((e) => [e.slug, e]))
