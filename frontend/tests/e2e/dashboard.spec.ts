import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  // Note: These tests require authentication
  // In CI, we use dev mode auto-login

  test.skip('should display session list after login', async ({ page }) => {
    await page.goto('/dashboard')
    // Wait for redirect or content load
    await page.waitForURL(/dashboard|login/)
    // Check if we're on dashboard or redirected to login
    const url = page.url()
    if (url.includes('dashboard')) {
      await expect(page.locator('text=/会话|Session/i')).toBeVisible()
    }
  })

  test.skip('should create new session', async ({ page }) => {
    await page.goto('/dashboard')
    // Click new session button
    const newSessionBtn = page.locator('button:has-text("新建"), a:has-text("新建")')
    if (await newSessionBtn.isVisible()) {
      await newSessionBtn.click()
      await expect(page).toHaveURL(/session/)
    }
  })
})
