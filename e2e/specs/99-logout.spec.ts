import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

/**
 * Runs last (99- prefix) — logging out clears the shared profile's session,
 * so every other spec (00-09), which all depend on already being logged in,
 * must run before this one.
 */
test.describe.serial('Logout', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(SHARED_PROFILE_DIR))
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('logs out and returns to the Sign In screen', async () => {
    await window.locator('nav').getByRole('link', { name: /^Settings/ }).click()
    await window.getByRole('button', { name: 'Log Out' }).click()

    await expect(window.getByText('Sign In', { exact: true })).toBeVisible({ timeout: 10_000 })
    await shoot(window, '99-logged-out')
  })

  test('relaunching after logout requires signing in again', async () => {
    const { app: app2, window: window2 } = await launchApp(SHARED_PROFILE_DIR)
    try {
      await expect(window2.getByText('Sign In', { exact: true })).toBeVisible({ timeout: 10_000 })
      await shoot(window2, '99-relaunch-after-logout-still-signed-out')
    } finally {
      await app2.close()
    }
  })
})
