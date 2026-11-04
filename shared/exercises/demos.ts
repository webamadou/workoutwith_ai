// Démonstrations d'exercices : médias réels (vidéo ou photos de départ/arrivée) + consignes pédagogiques.
// Un exercice sans entrée ici n'a pas de démonstration validée. Ne jamais y mettre d'animation générée.
import type { EquipmentKey } from './library'

export type DemoMedia =
  | { kind: 'video'; sources: { src: string; type: 'video/mp4' | 'video/webm' }[]; poster: string }
  /** Deux photos (départ, arrivée) : le lecteur les enchaîne en boucle. */
  | { kind: 'frames'; start: string; end: string; poster: string }

export interface DemoAlternative {
  label: string
  note: string
  /** Matériel nécessaire ; vide = poids du corps. */
  requires: EquipmentKey[]
}

export interface ExerciseDemoDef {
  slug: string
  media: DemoMedia
  /** Angle de vue principal de la démonstration. */
  view: 'face' | 'profil' | 'trois-quarts'
  alt: string
  /** Une phrase : l'essentiel du mouvement. */
  summary: string
  keyPoints: string[]
  mistakes: string[]
  alternatives: DemoAlternative[]
  credit: { author: string; license: string; url: string }
}

const FREE_DB = { author: 'free-exercise-db', license: 'Domaine public (Unlicense)', url: 'https://github.com/yuhonas/free-exercise-db' }

const frames = (slug: string): DemoMedia => ({ kind: 'frames', start: `/demos/${slug}/0.jpg`, end: `/demos/${slug}/1.jpg`, poster: `/demos/${slug}/0.jpg` })
const alt = (label: string, requires: EquipmentKey[], note: string): DemoAlternative => ({ label, requires, note })

export const EXERCISE_DEMOS: ExerciseDemoDef[] = [
  {
    slug: 'squat-goblet',
    media: { kind: 'frames', start: '/demos/squat-goblet/0.jpg', end: '/demos/squat-goblet/1.jpg', poster: '/demos/squat-goblet/0.jpg' },
    view: 'face',
    alt: 'Squat goblet : charge tenue contre la poitrine, descente en squat puis retour debout',
    summary: 'Tenez la charge contre la poitrine, descendez hanches vers l’arrière et genoux dans l’axe des pieds, puis poussez dans le sol pour remonter.',
    keyPoints: [
      'Coudes serrés, charge collée au sternum : elle sert de contrepoids.',
      'Pieds un peu plus larges que les épaules, pointes légèrement ouvertes.',
      'Genoux dans l’axe des orteils, talons plaqués au sol.',
      'Dos gainé et poitrine haute pendant toute la descente.',
      'Descendez aussi bas que le dos reste neutre, puis remontez en expirant.',
    ],
    mistakes: [
      'Genoux qui s’effondrent vers l’intérieur.',
      'Talons qui se décollent : écartez un peu les pieds ou réduisez l’amplitude.',
      'Dos qui s’arrondit en bas du mouvement.',
      'Charge qui s’éloigne de la poitrine et fait basculer le buste.',
    ],
    alternatives: [
      { label: 'Haltère tenu à la verticale', note: 'Les photos montrent un kettlebell ; avec un haltère, prenez l’haltère à deux mains par une extrémité, contre la poitrine.', requires: ['dumbbell'] },
      { label: 'Squat au poids du corps', note: 'Bras tendus devant vous pour l’équilibre, même technique.', requires: [] },
      { label: 'Squat avec bande sous les pieds', note: 'Bande tenue aux épaules, la résistance augmente en remontant.', requires: ['resistance_band'] },
    ],
    credit: FREE_DB,
  },
  {
    slug: 'fentes-arriere',
    media: { kind: 'frames', start: '/demos/fentes-arriere/0.jpg', end: '/demos/fentes-arriere/1.jpg', poster: '/demos/fentes-arriere/0.jpg' },
    view: 'trois-quarts',
    alt: 'Fente arrière : un pas en arrière, genou arrière vers le sol, retour debout',
    summary: 'Reculez une jambe, descendez verticalement jusqu’à frôler le sol avec le genou arrière, puis poussez sur le pied avant pour revenir.',
    keyPoints: [
      'Buste droit, regard devant, haltères le long du corps.',
      'Le pas est assez long pour que le tibia avant reste presque vertical.',
      'Poids réparti sur le talon et le milieu du pied avant.',
      'Descente contrôlée, genou arrière à quelques centimètres du sol.',
      'Terminez toutes les répétitions d’un côté avant de changer de jambe.',
    ],
    mistakes: [
      'Pas trop court : le genou avant dépasse largement les orteils.',
      'Buste penché vers l’avant.',
      'Genou avant qui part vers l’intérieur.',
      'Pousser sur la jambe arrière au lieu de la jambe avant.',
    ],
    alternatives: [
      { label: 'Fentes arrière avec haltères', note: 'Un haltère dans chaque main, bras le long du corps.', requires: ['dumbbell'] },
      { label: 'Fentes arrière au poids du corps', note: 'Mains aux hanches ; appuyez-vous sur un mur si l’équilibre manque.', requires: [] },
      { label: 'Fentes arrière avec bande', note: 'Marchez sur la bande, tenez-la aux épaules.', requires: ['resistance_band'] },
    ],
    credit: FREE_DB,
  },
  {
    slug: 'dead-bug',
    media: { kind: 'frames', start: '/demos/dead-bug/0.jpg', end: '/demos/dead-bug/1.jpg', poster: '/demos/dead-bug/0.jpg' },
    view: 'profil',
    alt: 'Dead bug vu de profil : allongé sur le dos, bras tendus vers le plafond, une jambe qui s’étend puis revient',
    summary: 'Sur le dos, bras tendus vers le plafond et genoux à 90°, étendez lentement une jambe sans décoller le bas du dos, puis revenez. Les photos montrent l’extension de jambe, bras fixes.',
    keyPoints: [
      'Bas du dos plaqué au sol pendant tout le mouvement.',
      'Mouvement lent : 2 à 3 secondes pour étendre, autant pour revenir.',
      'Expirez en étendant, ventre rentré.',
      'N’étendez que jusqu’où le dos reste collé au sol.',
      'Alternez une jambe puis l’autre.',
    ],
    mistakes: [
      'Bas du dos qui se creuse quand la jambe s’allonge.',
      'Mouvement trop rapide, porté par l’élan.',
      'Retenir sa respiration.',
      'Côtes qui s’ouvrent vers le haut.',
    ],
    alternatives: [
      { label: 'Version complète : bras opposé', note: 'Descendez en même temps le bras opposé à la jambe qui s’étend, derrière la tête. Plus exigeante pour le dos.', requires: [] },
      { label: 'Version facilitée : talon qui touche le sol', note: 'Descendez le talon sans le poser, genou plié.', requires: [] },
      { label: 'Version chargée', note: 'Un petit haltère dans chaque main ; ne l’essayez que si la version simple est maîtrisée.', requires: ['dumbbell'] },
    ],
    credit: FREE_DB,
  },
  {
    slug: 'pompes', media: frames('pompes'), view: 'trois-quarts',
    alt: 'Pompe vue de trois quarts : corps gainé, poitrine qui descend vers le sol puis remonte',
    summary: 'Corps gainé de la tête aux talons, descendez la poitrine vers le sol en gardant les coudes à environ 45° du buste, puis poussez.',
    keyPoints: ['Mains un peu plus larges que les épaules, doigts vers l’avant.', 'Fessiers et ventre serrés : aucun creux dans le bas du dos.', 'Coudes à environ 45° du buste, pas écartés à l’horizontale.', 'Descente contrôlée, poitrine proche du sol, puis poussée complète bras tendus.'],
    mistakes: ['Bassin qui s’affaisse ou qui monte.', 'Coudes écartés à 90°, qui sollicitent trop les épaules.', 'Amplitude réduite : la poitrine ne descend pas.', 'Tête qui plonge vers l’avant.'],
    alternatives: [alt('Pompes sur les genoux', [], 'Même gainage, du genou à la tête, pour gagner en force.'), alt('Pompes inclinées', [], 'Mains sur un support stable : plus le support est haut, plus c’est facile.'), alt('Pompes avec poignées', ['pushup_handles'], 'Poignets neutres et plus d’amplitude vers le bas.')],
    credit: FREE_DB,
  },
  {
    slug: 'pompes-inclinees', media: frames('pompes-inclinees'), view: 'trois-quarts',
    alt: 'Pompe inclinée : mains sur un support surélevé, corps en ligne, poitrine vers le support',
    summary: 'Mains sur un support stable, corps en ligne droite, descendez la poitrine vers le bord du support puis poussez.',
    keyPoints: ['Support stable qui ne glisse pas.', 'Tête, bassin et talons alignés.', 'Coudes à environ 45° du buste.', 'Plus le support est bas, plus l’exercice est difficile.'],
    mistakes: ['Bassin qui plie, fesses en arrière.', 'Support instable ou glissant.', 'Coudes écartés au maximum.'],
    alternatives: [alt('Pompes au sol', [], 'Quand vous enchaînez toutes les répétitions proprement avec un support bas.'), alt('Pompes inclinées avec poignées', ['pushup_handles'], 'Poignets plus neutres.')],
    credit: FREE_DB,
  },
  {
    slug: 'rowing-halteres', media: frames('rowing-halteres'), view: 'trois-quarts',
    alt: 'Rowing buste penché : haltères tirés vers les côtes, dos droit',
    summary: 'Buste penché, dos droit, tirez les haltères vers le bas des côtes en gardant les coudes près du corps.',
    keyPoints: ['Charnière de hanches : le dos reste plat, genoux légèrement fléchis.', 'Regard vers le sol, nuque dans le prolongement du dos.', 'Tirez avec les coudes, pas avec les mains.', 'Serrez les omoplates en haut, redescendez lentement.'],
    mistakes: ['Dos qui s’arrondit.', 'Buste qui se redresse pour tirer avec l’élan.', 'Coudes écartés loin du corps.', 'Haltères trop lourds, mouvement raccourci.'],
    alternatives: [alt('Rowing avec haltères', ['dumbbell'], 'Version de la démonstration.'), alt('Tirage avec élastique', ['resistance_band'], 'Bande sous les pieds, mêmes repères.')],
    credit: FREE_DB,
  },
  {
    slug: 'curl-biceps', media: frames('curl-biceps'), view: 'face',
    alt: 'Curl biceps debout : haltères montés vers les épaules, coudes collés au buste',
    summary: 'Debout, coudes collés au buste, fléchissez les coudes pour monter les haltères, puis redescendez lentement.',
    keyPoints: ['Coudes fixes le long du corps.', 'Poignets neutres, paumes vers l’avant.', 'Pas de balancement du buste.', 'Descente en 2 à 3 secondes, bras presque tendus en bas.'],
    mistakes: ['Dos qui se cambre pour aider.', 'Coudes qui avancent.', 'Haltères qui retombent sans contrôle.'],
    alternatives: [alt('Curl avec bande', ['resistance_band'], 'Bande sous les pieds.'), alt('Curl en alternance', ['dumbbell'], 'Un bras après l’autre pour mieux contrôler.')],
    credit: FREE_DB,
  },
  {
    slug: 'squat-poids-corps', media: frames('squat-poids-corps'), view: 'face',
    alt: 'Squat au poids du corps vu de face : mains derrière la tête, descente puis remontée',
    summary: 'Pieds largeur d’épaules, descendez hanches vers l’arrière, genoux dans l’axe des pieds, puis poussez dans les talons.',
    keyPoints: ['Genoux dans l’axe des orteils.', 'Talons au sol, poitrine haute.', 'Descendez aussi bas que le dos reste droit.', 'Expirez en remontant.'],
    mistakes: ['Genoux qui rentrent.', 'Talons qui décollent.', 'Dos qui s’arrondit en bas.'],
    alternatives: [alt('Squat goblet', ['dumbbell'], 'Haltère contre la poitrine, même technique.'), alt('Squat avec bande', ['resistance_band'], 'Bande sous les pieds, tenue aux épaules.')],
    credit: FREE_DB,
  },
  {
    slug: 'developpe-epaules', media: frames('developpe-epaules'), view: 'trois-quarts',
    alt: 'Développé épaules assis : haltères poussés au-dessus de la tête',
    summary: 'Haltères à hauteur d’épaules, poussez-les au-dessus de la tête sans cambrer, puis redescendez lentement.',
    keyPoints: ['Gainez le ventre, serrez les fessiers.', 'Poignets au-dessus des coudes.', 'Poussez en ligne verticale, bras presque tendus en haut.', 'Redescendez jusqu’aux épaules en contrôlant.'],
    mistakes: ['Dos qui se creuse.', 'Haltères qui partent vers l’avant.', 'Haussement d’épaules vers les oreilles.'],
    alternatives: [alt('Développé debout', ['dumbbell'], 'Même geste, ventre bien gainé.'), alt('Développé avec bande', ['resistance_band'], 'Bande sous les pieds.')],
    credit: FREE_DB,
  },
  {
    slug: 'elevations-laterales', media: frames('elevations-laterales'), view: 'face',
    alt: 'Élévations latérales vues de face : bras levés sur les côtés jusqu’aux épaules',
    summary: 'Debout, haltères légers, levez les bras sur les côtés jusqu’à hauteur d’épaules, coudes très légèrement fléchis.',
    keyPoints: ['Charge légère : le contrôle prime.', 'Montez jusqu’à hauteur d’épaules, pas plus haut.', 'Coudes légèrement fléchis et fixes.', 'Descente lente.'],
    mistakes: ['Élan du buste.', 'Épaules qui montent vers les oreilles.', 'Bras levés au-dessus des épaules.'],
    alternatives: [alt('Élévations avec bande', ['resistance_band'], 'Bande sous les pieds.'), alt('Version assise', ['dumbbell'], 'Supprime l’élan du corps.')],
    credit: FREE_DB,
  },
  {
    slug: 'pont-fessier', media: frames('pont-fessier'), view: 'profil',
    alt: 'Pont fessier vu de profil : bassin qui monte jusqu’à aligner épaules, hanches et genoux',
    summary: 'Allongé, genoux fléchis, poussez dans les talons pour monter le bassin jusqu’à aligner épaules, hanches et genoux.',
    keyPoints: ['Pieds à plat, proches des fesses.', 'Poussez dans les talons.', 'Serrez les fessiers en haut, sans cambrer.', 'Redescendez lentement.'],
    mistakes: ['Bas du dos qui se creuse en haut.', 'Poussée sur la pointe des pieds.', 'Genoux qui s’écartent ou rentrent.'],
    alternatives: [alt('Pont fessier lesté', ['dumbbell'], 'Un haltère posé sur les hanches.'), alt('Pont avec bande', ['resistance_band'], 'Bande au-dessus des genoux pour garder l’alignement.')],
    credit: FREE_DB,
  },
]

export const demoFor = (slug: string) => EXERCISE_DEMOS.find((d) => d.slug === slug)
