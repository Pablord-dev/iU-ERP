import { expect, test } from '@playwright/test'

// Requires a seeded database (npm run db:seed) and SEED_ADMIN_* in .env.
const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme'

test('redirects anonymous users to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('rejects wrong credentials', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill('wrong-password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible()
})

test('signs in and out with seeded admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Sesión iniciada como')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login/)
})
