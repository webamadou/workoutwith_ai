# Import d'un ancien suivi

Profil › « Importer un ancien suivi » ou, à la première connexion, « Vous avez un ancien suivi ? Importer un fichier ».
Le même importeur sert au script `npm run seed:demo` (fichier `data/import-initial.json`).

## Règles

- **Complète, n'efface pas** : le profil est mis à jour champ par champ ; le matériel du fichier devient l'inventaire ; les mesures sont ajoutées (une par date).
- **Rejouable** : un même fichier importé deux fois ne crée aucun doublon (séances identifiées par `ref`, séries par numéro, mesures par date).
- **Pas de réinitialisation** : si un programme est déjà actif, il est conservé (sauf `replace_active_program: true`).
- **Pas de performance inventée** : seules les séries présentes dans le fichier sont enregistrées. Les séances passées du programme sans résultat confirmé sont créées avec le statut **« à vérifier »** (jamais « terminées ») ; l'utilisateur les confirme ou les marque « non réalisées » depuis l'accueil.
- Une date absente (`null`) est remplacée par la date d'import, et la séance porte la mention « date exacte inconnue ».

## Format (version 1)

```jsonc
{
  "format": "workoutwith-ai/import",
  "version": 1,
  "profile": {                       // tous les champs sont facultatifs
    "height_cm": 170, "goal": "…", "experience_level": "beginner|returning|intermediate|advanced",
    "sessions_per_week": 3, "available_days": [1, 3, 5], "session_duration_min": 45,
    "training_preferences": "…", "limitations": "…", "limitation_tags": ["abdominal"], "recovery_notes": "…"
  },
  "equipment": [                     // dumbbell | weight_plate | resistance_band | pushup_handles | mat
    { "equipment_key": "weight_plate", "quantity": 12, "details": "8 × 1 kg, 4 × 2 kg" }
  ],
  "measurements": [ { "measured_on": "2026-10-01", "weight_kg": 74, "waist_cm": null, "note": "…" } ],
  "program": {
    "template": "reprise-8-semaines",
    "start_date": null,              // null = lundi de la semaine d'import
    "available_days": [1, 3, 5],
    "mark_past_as_to_verify": true,
    "replace_active_program": false
  },
  "sessions": [
    {
      "ref": "identifiant-unique",   // clé d'idempotence
      "title": "Pompes avec poignées",
      "date": "2026-10-30",          // ou null
      "status": "completed",         // completed (résultat confirmé) | to_verify
      "perceived_difficulty": 6,     // 1 à 10, facultatif
      "comment": "…",
      "exercises": [
        { "exercise_slug": "pompes",  // slug de la bibliothèque (Programme › Exercices)
          "sets": [ { "reps": 8, "load_kg": null, "difficulty": 3, "rest_s": 60, "pain": false,
                      "note": "…", "technique": { "variant": "poignées", "pause_bottom_s": 2, "pause_top": true } } ] }
      ]
    }
  ]
}
```

Chaque série doit avoir `reps` ou `duration_s`. Le fichier est validé avant import ; les erreurs indiquent le champ fautif.
