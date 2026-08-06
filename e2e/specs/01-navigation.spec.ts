import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchApp, SHARED_PROFILE_DIR, shoot } from '../fixtures/support'

const SCREENS: { link: string; heading: string; slug: string }[] = [
  { link: 'Dashboard', heading: 'Dashboard', slug: 'dashboard' },
  { link: 'Customers', heading: 'Customers', slug: 'customers' },
  { link: 'Repairs', heading: 'Repairs', slug: 'repairs' },
  { link: 'Payments', heading: 'Payments', slug: 'payments' },
  { link: 'Expenses', heading: 'Expenses', slug: 'expenses' },
  { link: 'Udhaar', heading: 'Udhaar', slug: 'udhaar' },
  { link: 'Reports', heading: 'Reports', slug: 'reports' },
  { link: 'Analytics', heading: 'Analytics', slug: 'analytics' },
  { link: 'Activity', heading: 'Activity Timeline', slug: 'activity' },
  { link: 'Settings', heading: 'Settings', slug: 'settings' }
]

test.describe.serial('Sidebar navigation', () => {
  let app: ElectronApplication
  let window: Page
  const pageErrors: string[] = []

  test.beforeAll(async () => {
    ;({ app, window } = await launchApp(SHARED_PROFILE_DIR))
    window.on('pageerror', (err) => pageErrors.push(err.message))
    window.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text())
    })
  })

  test.afterAll(async () => {
    await app.close()
  })

  for (const screen of SCREENS) {
    test(`navigates to ${screen.link} without error`, async () => {
      pageErrors.length = 0
      await window.locator('nav').getByRole('link', { name: new RegExp(`^${screen.link}`) }).click()
      await expect(window.locator('main').getByText(screen.heading, { exact: true }).first()).toBeVisible({
        timeout: 10_000
      })
      // Give any async data fetch a moment to settle before checking for thrown errors / a blank body.
      await window.waitForTimeout(400)
      const bodyText = await window.locator('main').innerText()
      expect(bodyText.trim().length, `main content on ${screen.link} should not be empty`).toBeGreaterThan(0)
      expect(pageErrors, `console/page errors while on ${screen.link}: ${pageErrors.join(' | ')}`).toEqual([])
      await shoot(window, `01-nav-${screen.slug}`)
    })
  }
})
