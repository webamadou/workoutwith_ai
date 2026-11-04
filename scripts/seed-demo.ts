// Crée (ou réinitialise) le compte de démonstration à partir du jeu de données initial data/import-initial.json,
// avec le même importeur que l'interface (Profil › Importer).
// Usage : npm run seed:demo   (lit .env : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL, DEMO_PASSWORD)
// Destiné au développement local : ne pas exécuter contre un projet de production.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../shared/database.types'
import { parseImport, runImport } from '../shared/import/importer'

const url = process.env.SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.DEMO_EMAIL ?? 'demo@workoutwith.local'
const password = process.env.DEMO_PASSWORD
if (!url || !anon || !service || !password) {
  console.error('Variables manquantes : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD')
  process.exit(1)
}
if (!/127\.0\.0\.1|localhost/.test(url) && process.argv[2] !== '--force') {
  console.error(`Refus : ${url} n'est pas une instance locale (ajouter --force pour passer outre).`)
  process.exit(1)
}

const parsed = parseImport(JSON.parse(readFileSync('data/import-initial.json', 'utf8')))
if (!parsed.ok) throw new Error(parsed.errors.join('\n'))

const admin = createClient<Database>(url, service, { auth: { persistSession: false } })
const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (error) throw error
const existing = list.users.find((u) => u.email === email)
if (existing) await admin.auth.admin.deleteUser(existing.id) // cascade sur toutes ses données
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Démo' } })
if (created.error) throw created.error

const db = createClient<Database>(url, anon, { auth: { persistSession: false } })
const signin = await db.auth.signInWithPassword({ email, password })
if (signin.error) throw signin.error
const report = await runImport(db, signin.data.user.id, parsed.data)

console.log(`Compte démo prêt : ${email} (mot de passe : variable DEMO_PASSWORD du fichier .env)`)
console.log(report)
