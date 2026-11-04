// Outils de construction des démonstrations animées (silhouettes vectorielles).
// Les poses sont calculées ici puis stockées en base (exercise_media.data) ;
// le composant ExerciseDemo se contente d'interpoler les points.

export type Pt = [number, number]
export type Joints = Record<string, Pt>

export interface PoseAnimation {
  viewBox: string
  chains: { points: string[]; far?: boolean }[]
  head?: string
  frames: Joints[]
  /** durée (s) de la transition vers chaque image, puis maintien */
  timing: { move: number; hold: number }[]
  props?: {
    dumbbells?: string[]
    band?: { anchor: Pt; to: string[] }
    handles?: string[]
    box?: { x: number; y: number; w: number; h: number }
    mat?: boolean
  }
}

export const L = { torso: 50, neck: 14, upper: 26, fore: 24, thigh: 36, shin: 35, foot: 10 }
export const FLOOR = 180

const rad = (d: number) => (d * Math.PI) / 180
const r1 = (n: number) => Math.round(n * 10) / 10

/** Point à distance `len` de `o` dans la direction `deg` (0 = droite, 90 = haut). */
export function polar(o: Pt, len: number, deg: number): Pt {
  return [r1(o[0] + len * Math.cos(rad(deg))), r1(o[1] - len * Math.sin(rad(deg)))]
}

/** Cinématique inverse à deux segments : renvoie l'articulation intermédiaire. */
export function ik(root: Pt, target: Pt, l1: number, l2: number, bend: 1 | -1): Pt {
  const dx = target[0] - root[0]
  const dy = target[1] - root[1]
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01)
  const a = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))
  const base = Math.atan2(dy, dx)
  const ang = base - bend * a
  return [r1(root[0] + l1 * Math.cos(ang)), r1(root[1] + l1 * Math.sin(ang))]
}

export type Limb = { a: [number, number] } | { to: Pt; bend: 1 | -1 } | { mid: Pt; end: Pt }

function limb(root: Pt, spec: Limb, l1: number, l2: number): [Pt, Pt] {
  if ('a' in spec) {
    const m = polar(root, l1, spec.a[0])
    return [m, polar(m, l2, spec.a[1])]
  }
  if ('to' in spec) return [ik(root, spec.to, l1, l2, spec.bend), spec.to]
  return [spec.mid, spec.end]
}

export interface SideSpec {
  hip: Pt
  torso: number
  head?: Pt
  arm: Limb
  leg: Limb
  arm2?: Limb
  leg2?: Limb
  toe?: number
  toe2?: number
}

/** Silhouette de profil (tournée vers la droite). */
export function side(s: SideSpec): Joints {
  const neck = polar(s.hip, L.torso, s.torso)
  const j: Joints = { hip: s.hip, neck, head: s.head ?? polar(neck, L.neck, s.torso) }
  ;[j.elbow, j.hand] = limb(neck, s.arm, L.upper, L.fore)
  ;[j.knee, j.ankle] = limb(s.hip, s.leg, L.thigh, L.shin)
  j.toe = polar(j.ankle, L.foot, s.toe ?? 0)
  if (s.arm2) [j.elbow2, j.hand2] = limb(neck, s.arm2, L.upper, L.fore)
  if (s.leg2) {
    ;[j.knee2, j.ankle2] = limb(s.hip, s.leg2, L.thigh, L.shin)
    j.toe2 = polar(j.ankle2, L.foot, s.toe2 ?? s.toe ?? 0)
  }
  return j
}

export const SIDE_CHAINS: PoseAnimation['chains'] = [
  { points: ['neck', 'elbow2', 'hand2'], far: true },
  { points: ['hip', 'knee2', 'ankle2', 'toe2'], far: true },
  { points: ['hip', 'knee', 'ankle', 'toe'] },
  { points: ['neck', 'hip'] },
  { points: ['neck', 'elbow', 'hand'] },
]

/** Position debout de référence. */
export const STAND_HIP: Pt = [120, FLOOR - 4 - L.thigh - L.shin]

export function sideAnim(
  frames: SideSpec[],
  timing: PoseAnimation['timing'],
  opts: Partial<Pick<PoseAnimation, 'viewBox' | 'props'>> = {},
): PoseAnimation {
  return {
    viewBox: opts.viewBox ?? '0 0 240 190',
    chains: SIDE_CHAINS,
    head: 'head',
    frames: frames.map(side),
    timing,
    props: opts.props,
  }
}
