# WorkOut With AI

Application personnelle de coaching sportif : programme sur 8 semaines, exécution guidée des séances sur téléphone, suivi des performances et un coach IA (OpenAI ou Anthropic) qui s'appuie sur vos données réelles.

Stack : Vue 3 + TypeScript + Vite + Tailwind CSS 4 + Pinia + Vue Router + Reka UI + Chart.js (PWA) · Supabase (Auth, PostgreSQL + RLS, Storage) · Netlify Functions. Architecture détaillée : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prérequis

- Node.js 22 (`nvm use`, voir `.nvmrc`)
- Docker (pour Supabase en local)

## Installation locale

```bash
npm install
npm run db:start          # Supabase local (migrations appliquées automatiquement)
cp .env.example .env      # puis renseigner les clés affichées par : npx supabase status
npm run seed:demo         # compte de démonstration (nécessite DEMO_PASSWORD et SUPABASE_SERVICE_ROLE_KEY)
npm run dev               # application + fonctions sur http://localhost:8888
```

`npm run dev:web` lance seulement le front (port 5173) : tout fonctionne sauf le coach IA.

### Compte de démonstration

`npm run seed:demo` (re)crée `DEMO_EMAIL` avec le mot de passe `DEMO_PASSWORD` du fichier `.env`, puis importe `data/import-initial.json` avec l'importeur de l'application : profil (170 cm, 74 kg, reprise, lundi / mercredi / vendredi, vigilance abdominale), matériel (2 haltères réglables, 8 disques de 1 kg, 4 de 2 kg, bandes, poignées), programme de 8 semaines et le seul résultat confirmé — pompes 8, 12, 12 avec repos d'environ 60 s et pause basse de 2 s. Les séances passées sans résultat confirmé sont « à vérifier » ; aucune autre performance n'est inventée. Le script refuse de s'exécuter sur une instance non locale. Format d'import : [docs/IMPORT.md](docs/IMPORT.md).

## Activer le coach IA

Renseignez au moins un fournisseur dans `.env` (ou dans les variables Netlify) :

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY`, `ANTHROPIC_CHAT_MODEL`, `ANTHROPIC_ANALYSIS_MODEL` | Fournisseur Anthropic |
| `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_ANALYSIS_MODEL` | Fournisseur OpenAI |
| `AI_DEFAULT_PROVIDER` | `anthropic` ou `openai` |
| `AI_FALLBACK_PROVIDER` | Secours en cas d'indisponibilité. Vide = aucun basculement (aucune facturation chez un second fournisseur sans votre accord) |
| `AI_DAILY_REQUEST_LIMIT`, `AI_DAILY_TOKEN_LIMIT` | Quotas par utilisateur et par jour (0 = illimité) |
| `ANTHROPIC_VISION_MODEL`, `OPENAI_VISION_MODEL` | Modèle multimodal pour l'analyse des photos de matériel (par défaut : modèle conversationnel) |
| `AI_MAX_OUTPUT_TOKENS`, `AI_TIMEOUT_MS` | Taille maximale des réponses, délai par appel |

Un fournisseur est actif s'il a une clé **et** un modèle conversationnel. Les clés restent côté serveur : seules les variables préfixées `VITE_` sont exposées au navigateur.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Netlify Dev (Vite + fonctions) |
| `npm run build` | Vérification des types puis build de production (PWA) |
| `npm test` | Tests unitaires + tests de permissions RLS (Supabase local requis pour ces derniers, sinon ignorés) |
| `npm run test:e2e` | Parcours complet sur mobile avec Playwright (Supabase local requis) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run gen:exercises` | Régénère la migration de la bibliothèque depuis `shared/exercises/library.ts` |
| `npm run gen:types` | Régénère `shared/database.types.ts` depuis le schéma local |
| `npm run db:reset` | Réinitialise la base locale |

## Déploiement Netlify

1. Créer un projet Supabase, puis appliquer les migrations : `npx supabase link --project-ref <ref>` et `npx supabase db push --remote`. La CLI v3 vise la base locale par défaut ; `--remote` est nécessaire pour la base hébergée.
2. Dans Supabase › Authentication › URL Configuration, déclarer l'URL Netlify du site.
3. Créer le site Netlify depuis le dépôt (la configuration est dans `netlify.toml`) et définir les variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` et, si souhaité, les variables IA. La clé `SUPABASE_SERVICE_ROLE_KEY` n'est **pas** nécessaire en production.
4. Les appels IA à plusieurs outils peuvent dépasser le délai par défaut des fonctions synchrones : vérifier la limite de votre offre Netlify et ajuster `AI_TIMEOUT_MS`.

## Données et confidentialité

- Row Level Security sur toutes les tables : chacun ne voit et ne modifie que ses données (couvert par `tests/integration/rls.test.ts`).
- Photos de progression dans un bucket privé, accessibles par URL signée temporaire ; aucune analyse automatique des photos.
- Profil › Mes données : export JSON complet et suppression définitive du compte (photos comprises).
- Les journaux de consommation IA ne contiennent ni messages ni secrets.
