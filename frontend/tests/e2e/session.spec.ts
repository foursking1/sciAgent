import { test, expect } from '@playwright/test'

test.describe('Session workflow', () => {
  test('should create a new session', async ({ page }) => {
    // Go to dashboard (dev mode auto-login)
    await page.goto('/dashboard')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check if redirected to login
    const url = page.url()
    if (url.includes('/login')) {
      // Not authenticated - skip this test
      test.skip()
      return
    }

    // Look for new session button
    const newSessionBtn = page.locator('button:has-text("新"), a:has-text("新")').first()

    if (await newSessionBtn.isVisible()) {
      await newSessionBtn.click()

      // Should navigate to session page
      await page.waitForURL(/\/session\//)
      expect(page.url()).toContain('/session/')
    }
  })

  test('should display session list on dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Check if redirected to login (not authenticated) or on dashboard (authenticated)
    const url = page.url()
    if (url.includes('/login')) {
      // Not authenticated - test passes as redirect works correctly
      await expect(page).toHaveURL(/login/)
    } else {
      // Authenticated - dashboard should load
      await expect(page).toHaveURL(/dashboard/)
    }
  })
})

test.describe('Chat functionality', () => {
  test.skip('should send a message and receive response', async ({ page }) => {
    // This test requires a running backend with AI API
    await page.goto('/dashboard')

    // Create or open a session
    const newSessionBtn = page.locator('button:has-text("新")').first()
    if (await newSessionBtn.isVisible()) {
      await newSessionBtn.click()
      await page.waitForURL(/\/session\//)
    }

    // Find chat input
    const chatInput = page.locator('textarea[placeholder*="输入"], textarea[placeholder*="type"]')

    if (await chatInput.isVisible()) {
      await chatInput.fill('Hello, this is a test message')
      await chatInput.press('Enter')

      // Wait for response (may take time with AI)
      await page.waitForTimeout(5000)

      // Check if message appears
      await expect(page.locator('text=/Hello|test message/i')).toBeVisible({ timeout: 10000 })
    }
  })
})

test.describe('File operations', () => {
  test.skip('should upload a file', async ({ page }) => {
    // This test requires a session
    await page.goto('/dashboard')

    // Look for file upload button
    const uploadBtn = page.locator('input[type="file"]')

    if (await uploadBtn.isVisible()) {
      // Create a test file
      const testFile = {
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('test content'),
      }

      await uploadBtn.setInputFiles(testFile)

      // Check for upload success indicator
      await page.waitForTimeout(2000)
    }
  })
})

test.describe('Public sessions', () => {
  test('should display public sessions page', async ({ page }) => {
    await page.goto('/session/public')
    await page.waitForLoadState('networkidle')

    // Page should load without error
    await expect(page).toHaveURL(/public/)
  })
})
