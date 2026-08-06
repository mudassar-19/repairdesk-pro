import { test, expect } from '@playwright/test'
import { launchApp, freshProfileDir, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

// Provided via env so no real credential ever lands in a committed file:
//   E2E_FIREBASE_EMAIL=... E2E_FIREBASE_PASSWORD=... npx playwright test
const TEST_EMAIL = process.env.E2E_FIREBASE_EMAIL
const TEST_PASSWORD = process.env.E2E_FIREBASE_PASSWORD

test.describe.serial('Auth', () => {
  test('login form shows client-side validation for empty and malformed input', async () => {
    const { app, window } = await launchApp(freshProfileDir('auth-validation'))
    try {
      await window.getByRole('button', { name: 'Log In' }).click()
      await expect(window.getByText('Email is required')).toBeVisible()
      await expect(window.getByText('Password is required')).toBeVisible()

      await window.locator('input[type=email]').fill('not-an-email')
      await window.locator('input[type=password]').fill('x')
      await window.getByRole('button', { name: 'Log In' }).click()
      await expect(window.getByText('Enter a valid email address')).toBeVisible()

      await shoot(window, '00-auth-validation-errors')
    } finally {
      await app.close()
    }
  })

  test('shows a clear inline error for wrong credentials', async () => {
    const { app, window } = await launchApp(freshProfileDir('auth-wrong-creds'))
    try {
      await window.locator('input[type=email]').fill('nonexistent-e2e-test-user@example.com')
      await window.locator('input[type=password]').fill('definitely-wrong-password')
      await window.getByRole('button', { name: 'Log In' }).click()
      await expect(window.getByRole('alert')).toBeVisible({ timeout: 15_000 })
      await shoot(window, '00-auth-wrong-credentials')
    } finally {
      await app.close()
    }
  })

  test('logs in with real credentials and reaches the Dashboard', async () => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'E2E_FIREBASE_EMAIL / E2E_FIREBASE_PASSWORD not provided')
    const { app, window } = await launchApp(SHARED_PROFILE_DIR)
    try {
      await window.locator('input[type=email]').fill(TEST_EMAIL!)
      await window.locator('input[type=password]').fill(TEST_PASSWORD!)
      await window.getByRole('button', { name: 'Log In' }).click()
      await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 20_000 })
      await shoot(window, '00-auth-dashboard-after-login')
    } finally {
      await app.close()
    }
  })

  test('persists session across a relaunch — no re-login required', async () => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'E2E_FIREBASE_EMAIL / E2E_FIREBASE_PASSWORD not provided')
    const { app, window } = await launchApp(SHARED_PROFILE_DIR)
    try {
      await expect(window.locator('main').getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 10_000 })
      await expect(window.getByText('Sign In')).not.toBeVisible()
      await shoot(window, '00-auth-persistent-session')
    } finally {
      await app.close()
    }
  })
})
