// Listes partagées par l'onboarding et la page profil.
export const GOAL_OPTIONS = [
  { value: 'Développement musculaire et diminution progressive du tour de taille', label: 'Muscle et tour de taille' },
  { value: 'Développement musculaire', label: 'Prise de muscle' },
  { value: 'Remise en forme générale', label: 'Remise en forme' },
  { value: 'Renforcement et santé du dos', label: 'Renforcement, posture' },
]

export const LIMITATION_OPTIONS = [
  { value: 'abdominal', label: 'Abdomen' },
  { value: 'lower_back', label: 'Bas du dos' },
  { value: 'knees', label: 'Genoux' },
  { value: 'shoulders', label: 'Épaules' },
  { value: 'wrists', label: 'Poignets' },
]

export const LIMITATION_LABELS = Object.fromEntries(LIMITATION_OPTIONS.map((o) => [o.value, o.label]))

export const EQUIPMENT_OPTIONS = [
  { value: 'dumbbell', label: 'Haltères', hint: 'réglables ou fixes' },
  { value: 'weight_plate', label: 'Disques' },
  { value: 'resistance_band', label: 'Bandes élastiques' },
  { value: 'pushup_handles', label: 'Poignées de pompes' },
  { value: 'mat', label: 'Tapis' },
]
