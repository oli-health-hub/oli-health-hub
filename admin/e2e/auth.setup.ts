import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/login/);

  await page.fill('input[type="email"]', 'test-playwright@olihealthhub.com');
  await page.fill('input[type="password"]', 'Playwright#2026!');
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 15000 });
  await expect(page).toHaveURL('/');

  await page.context().storageState({ path: authFile });
  console.log('✅ Auth state saved');
});
