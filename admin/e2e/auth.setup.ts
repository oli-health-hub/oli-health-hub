import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD no ambiente (nunca no repositório).');
  }

  await page.goto('/login');
  await expect(page).toHaveURL(/login/);

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 15000 });
  await expect(page).toHaveURL('/');

  await page.context().storageState({ path: authFile });
  console.log('✅ Auth state saved');
});
