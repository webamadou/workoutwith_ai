# Architecture — WorkOut With AI

## 1. Principes

- **La base est la source de vérité.** Toute donnée affichée vient de PostgreSQL (Supabase). L'IA lit ces données via des outils serveur et ne peut rien modifier seule.
- **Le déterministe d'abord.** Volume, comparaisons, progression, séances manquées et garde-fous sont calculés par un moteur TypeScript pur (`shared/progression`, `shared/program`). L'IA s'appuie sur ces résultats pour formuler ses conseils.
- **Simple à maintenir.** Pas de serveur permanent : un front Vue (SPA/PWA), Supabase (Auth, Postgres + RLS, Storage) et trois fonctions Netlify pour l'IA.
- **Utilisable sans IA.** Sans clé configurée, tout fonctionne sauf le chat et l'analyse rédigée ; le bilan et les suggestions déterministes restent disponibles.

## 2. Structure du dépôt

```
shared/                 Code partagé front + serveur (TypeScript pur, testé)
  dates.ts              Dates calendaires, semaines du programme
  database.types.ts     Types générés depuis le schéma (npm run gen:types)
  exercises/            Bibliothèque d'exercices + poses des démonstrations animées
  program/              Générateur du programme 8 semaines, ajustements, garde-fous
  progression/engine.ts Moteur de progression déterministe
src/                    Application Vue 3
  pages/                Une page par écran (routes)
  components/
    ui/                 Bouton, stepper, bottom sheet, chips, toasts…
    layout/             Navigation (barre inférieure mobile, rail desktop)
    exercise/           Démonstration animée
    workout/            Saisie de série, minuteur de repos, édition du programme
    progress/           Graphiques
    coach/              Carte de recommandation (accepter / refuser)
  stores/               Pinia : auth/profil, bibliothèque, programme actif
  services/             Accès Supabase et appels aux fonctions serveur
  composables/          Minuteur, file hors ligne, thème, toasts
server/                 Code des fonctions Netlify
  ai/                   Interface AIProvider, adaptateurs OpenAI et Anthropic, configuration
  coach/                Logique coach : données, contexte compact, outils, prompts, service
  http.ts               Authentification par jeton Supabase, réponses, erreurs
netlify/functions/      ai-status, coach-chat, analyze-session
supabase/migrations/    Schéma, RLS, fonctions SQL, bibliothèque (générée)
scripts/                Génération de la bibliothèque SQL, compte de démonstration
tests/unit|integration|e2e
```

## 3. Modèle de données

Toutes les tables utilisateur ont un `user_id` (UUID, défaut `auth.uid()`), sont protégées par RLS et supprimées en cascade avec le compte.

| Table | Rôle |
|---|---|
| `profiles` | Profil sportif (1-1 avec `auth.users`, créé par trigger) : taille, objectif, niveau, fréquence, jours, préférences, exercices préférés/à éviter, limitations (texte + étiquettes), récupération, fournisseur IA préféré, repos par défaut |
| `user_equipment` | Matériel disponible (clé, quantité, détails) |
| `exercises`, `exercise_media` | Bibliothèque de référence (lecture seule) ; médias = animation vectorielle, image ou vidéo |
| `workout_plans` | Programme (un seul actif par utilisateur), pointe vers sa version courante |
| `workout_plan_versions` | Versions immuables : source (modèle, utilisateur, coach), résumé du changement, recommandation liée → traçabilité |
| `planned_sessions`, `planned_exercises` | Contenu d'une version : semaine, jour, exercices ordonnés et cibles (séries, fourchette de répétitions ou durée, repos, charge) |
| `workout_sessions` | Séance réalisée : état `planned / in_progress / completed / abandoned`, position courante, difficulté globale, commentaire. Une seule séance en cours par utilisateur |
| `performed_sets` | Série réalisée : répétitions ou durée, charge, difficulté 1-5, repos effectif, douleur + note, remarque, technique (JSON : variante, pauses, amplitude). Clé unique séance+exercice+numéro → enregistrement idempotent |
| `body_measurements` | Poids et tour de taille (une mesure par jour) |
| `progress_photos` | Métadonnées ; fichiers dans le bucket privé `progress-photos/<uid>/…` |
| `coach_conversations`, `coach_messages` | Historique du chat |
| `coach_recommendations` | Analyses et propositions : résumé, justification, détails, ajustements (JSON validé), faits du moteur, état `pending / accepted / rejected`, version appliquée |
| `ai_usage_logs` | Consommation par appel (fournisseur, modèle, tâche, jetons, latence, code d'erreur) — sans contenu ni secret, non supprimable par le client |

Fonctions SQL (transactionnelles, sous RLS) : `create_workout_plan`, `create_plan_version` (verrouille le programme, marque la recommandation acceptée), `delete_my_account`.

## 4. Flux principaux

- **Onboarding** : profil → matériel → précautions → aperçu du programme généré (substitutions selon le matériel et les exercices à éviter) → `create_workout_plan`.
- **Séance** : démarrage = ligne `in_progress`. Chaque série validée est mise en file locale puis envoyée (upsert idempotent) ; hors ligne, elle reste sur l'appareil et se synchronise au retour du réseau. Position, brouillon de saisie et minuteur (heure de fin) survivent à la fermeture de l'application. Écran maintenu allumé (Wake Lock).
- **Ajustement** : le coach appelle `propose_program_adjustment` → garde-fous (`checkAdjustments`) → recommandation `pending`. L'utilisateur accepte : les garde-fous sont revérifiés, une nouvelle version est créée ; ou refuse.

## 5. Couche IA multi-fournisseurs

```
server/ai/types.ts      AIProvider { chat(), generateStructured() }, AIError (codes communs), Usage
server/ai/anthropic.ts  Messages API (SDK officiel) : boucle d'outils, sorties structurées (output_config.format)
server/ai/openai.ts     Responses API (SDK officiel) : boucle d'outils (previous_response_id), json_schema strict
server/ai/registry.ts   Ordre des fournisseurs, secours seulement si AI_FALLBACK_PROVIDER est défini
server/ai/config.ts     Modèles et limites lus dans l'environnement
```

La logique métier (`server/coach`) ne connaît que `AIProvider`. Le front appelle `/api/*` et ignore quel fournisseur répond. Choisir OpenAI ou Anthropic = changer `AI_DEFAULT_PROVIDER` (ou la préférence dans le profil).

Garde-fous : jeton Supabase obligatoire, client Supabase au nom de l'utilisateur (RLS), quotas journaliers (requêtes, jetons), limite par minute, taille des messages, sorties IA validées par zod puis par le moteur avant enregistrement.

Optimisation des coûts : contexte compact (profil, semaine en cours, 3 dernières séances, suggestions du moteur) ; le détail passe par des outils à la demande ; 12 messages d'historique maximum ; aucun appel IA pour les minuteurs, enregistrements, totaux, statistiques ou progressions simples.

## 6. Moteur de progression (`shared/progression/engine.ts`)

`summarizeExercise`, `summarizeSession` (volume, tonnage, douleurs, durée), `exerciseHistory`, `comparePerformances` (progression / stable / régression, avec explication), `suggestNext` (double progression prudente : douleur → réduire ; toutes les séries au haut de la fourchette avec difficulté ≤ 3/5 → augmenter ; sinon consolider), `scheduleStatus` / `nextSession` (faites, manquées, aujourd'hui, à venir), `weeklyStats` (régularité), `volumeByMuscle`.

Garde-fous (`shared/program/adjustments.ts`) : pas de modification des semaines passées, +20 % de séries hebdomadaires maximum, charge +10 % ou +2 kg maximum, +3 répétitions maximum, une augmentation proposée par le coach tous les 7 jours au plus (les réductions restent possibles), matériel disponible, exercices à éviter exclus.

## 7. Mémoire sportive et continuité

**Source de vérité** : profil, matériel, programme et ses versions, séances (prévues, faites, à vérifier, non réalisées), séries (charges, repos, technique, difficulté, douleurs), recommandations et décisions sont en base. L'historique de conversation n'est qu'un complément (12 derniers messages).

**À chaque ouverture** (sans IA) : chargement du profil → programme actif → séance prévue (`scheduleStatus` / `nextSession`) → dernières performances de chaque exercice (« Dernière fois : 8 · 12 · 12 » et objectif adapté par `suggestNext`) → reprise d'une séance en cours → panneau « À traiter » :

| Situation | Réponse de l'application |
|---|---|
| Séance passée non confirmée (import) | « À vérifier » : *Elle a été faite* / *Non réalisée* |
| Séance manquée (14 derniers jours) | *La faire maintenant* / *Ne pas la faire* — le programme n'est ni décalé ni réinitialisé |
| Douleur signalée | Proposition : remplacer l'exercice par une alternative sans zone de vigilance commune, sinon une série de moins |
| Deux baisses consécutives | Proposition : une série de moins cette semaine |
| Matériel retiré du profil | Proposition : remplacer les exercices devenus irréalisables |

Les propositions (`shared/progression/continuity.ts`) passent par les mêmes garde-fous que le coach, sont enregistrées comme recommandations `source = rules` avec une clé de déclenchement unique (une proposition refusée n'est jamais reproposée) et ne s'appliquent qu'après acceptation (nouvelle version `source = rules`).

**Contexte du coach ciblé** (`server/coach/context.ts`) : toujours le profil, le matériel, la semaine en cours, la prochaine séance, les décisions passées et les douleurs récentes ; selon la demande, l'historique des exercices cités, les mesures, le volume par groupe musculaire, le détail des séances récentes. Consigne explicite : ne jamais recommander un matériel absent sans proposer d'alternative.

**Photos** : celles du matériel sont redimensionnées dans le navigateur, envoyées à `/api/analyze-equipment` (modèle multimodal du fournisseur configuré, `*_VISION_MODEL`) et ne sont pas stockées ; l'IA renvoie un inventaire structuré que l'utilisateur coche, corrige puis enregistre. Les photos du physique sont facultatives, stockées dans le bucket privé et jamais transmises à l'IA.

**Import** : voir [IMPORT.md](IMPORT.md).
