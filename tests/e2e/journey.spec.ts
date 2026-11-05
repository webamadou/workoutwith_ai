import { expect, test } from '@playwright/test'

const email = `e2e-${Date.now()}@test.local`
const password = `E2e-${Math.random().toString(36).slice(2)}-pass`

test('inscription, onboarding, séance reprise après rechargement, bilan', async ({ page }) => {
  // Inscription
  await page.goto('/connexion')
  await page.getByRole('button', { name: 'Créer un compte' }).click()
  await page.getByLabel('Prénom').fill('Testeur')
  await page.getByLabel('E-mail').fill(email)
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill(password)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  // Onboarding
  await expect(page.getByRole('heading', { name: 'Faisons connaissance' })).toBeVisible()
  await page.getByLabel('Taille (cm)', { exact: true }).fill('170')
  await page.getByLabel('Poids (kg)').fill('74')
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByRole('button', { name: 'Continuer' }).click() // objectif / niveau par défaut
  await page.getByRole('button', { name: 'Continuer' }).click() // lundi, mercredi, vendredi
  for (const m of ['Haltères', 'Bandes élastiques']) await page.getByRole('button', { name: m }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByRole('button', { name: 'Abdomen' }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()
  await expect(page.getByText('Programme reprise — 8 semaines')).toBeVisible()
  await page.getByRole('button', { name: 'Cette semaine' }).or(page.getByRole('button', { name: 'Aujourd’hui' })).first().click()
  await page.getByRole('button', { name: 'Créer mon programme' }).click()

  // Tableau de bord alimenté par la base
  await expect(page.getByRole('heading', { name: 'Bonjour Testeur' })).toBeVisible()
  await expect(page.getByText('74 kg')).toBeVisible()

  // Démarrer une séance
  await page.goto('/seance')
  await page.getByRole('button', { name: 'Démarrer la séance' }).click()
  await expect(page).toHaveURL(/\/seance\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('img', { name: /./ }).first()).toBeVisible() // démonstration

  // Saisir et valider une série
  const reps = page.getByRole('textbox', { name: 'Répétitions' })
  await reps.fill('9')
  await page.getByRole('button', { name: /^3\s*Modérée$/ }).click()
  await page.getByRole('button', { name: 'Valider la série' }).click()
  await expect(page.getByRole('timer')).toBeVisible() // minuteur de repos

  // Fermeture accidentelle : la séance et le minuteur sont restaurés
  await page.reload()
  await expect(page.getByRole('timer')).toBeVisible()
  await page.getByRole('button', { name: 'Passer' }).click()
  await expect(page.getByText('9 rép.')).toBeVisible()

  // Ajouter un exercice en cours de séance : il apparaît, survit au rechargement et se saisit
  await page.getByRole('button', { name: 'Exercice', exact: true }).click()
  const pick = page.getByRole('searchbox', { name: 'Rechercher un exercice' }).locator('xpath=following::button[1]')
  const name = (await pick.locator('span').first().textContent())!
  await pick.click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await page.getByRole('textbox', { name: 'Répétitions' }).fill('12')
  await page.getByRole('button', { name: 'Valider la série' }).click()
  await page.getByRole('button', { name: 'Passer' }).click()
  await expect(page.getByText('12 rép.', { exact: true })).toBeVisible()

  // Terminer et consulter le bilan
  await page.getByRole('button', { name: 'Terminer', exact: true }).click()
  await page.getByRole('button', { name: '6', exact: true }).click()
  await page.getByRole('button', { name: 'Enregistrer et voir le bilan' }).click()
  await expect(page.getByRole('heading', { name: 'Bilan' })).toBeVisible()
  await expect(page.getByText('9 rép.')).toBeVisible()
  await expect(page.getByText('6/10')).toBeVisible()

  // Progression : la séance apparaît dans le journal
  await page.goto('/progression')
  await page.getByRole('tab', { name: 'Journal' }).click()
  await expect(page.getByText('Jambes et épaules').or(page.getByText('Haut du corps')).or(page.getByText('Corps entier')).first()).toBeVisible()
})
