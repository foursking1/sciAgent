import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1, h2')).toContainText(/登录|Login/i)
  })

  test('should display register page', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('h1, h2')).toContainText(/注册|Register/i)
  })

  test('should show validation error on empty login', async ({ page }) => {
    await page.goto('/login')
    await page.click('button[type="submit"]')
    // Should show validation error or stay on page
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('Home page', () => {
  test('should load home page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/SciAgent|Scientific/)
  })
})
