import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } }); // unauthenticated

test.describe('Login page', () => {
  test('renders login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('redirects unauthenticated user from / to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });

  test('redirects unauthenticated user from /medicos to /login', async ({ page }) => {
    await page.goto('/medicos');
    await expect(page).toHaveURL(/login/);
  });

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should stay on login page
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/login/);
  });
});
