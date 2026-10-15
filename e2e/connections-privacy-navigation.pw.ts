import { test, expect, type Page } from '@playwright/test';

const supported = (name: string) => ['phone-390', 'desktop-1280'].includes(name);
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Connections sections' });

test('Connections opens directly into relationships, without a Sales Dashboard or prominent log',
  async ({ page }, info) => {
    test.skip(!supported(info.project.name), 'Privacy-first Connections QC');
    await page.goto('/connections');
    await expect(page.locator('.sales-app.view-dashboard')).toBeVisible();
    await expect(tabs(page).getByRole('button', { name: /Companies/ })).toHaveAttribute('aria-current', 'page');
    await expect(tabs(page).getByRole('button', { name: /People/ })).toBeVisible();
    await expect(tabs(page).getByRole('button', { name: /Projects/ })).toBeVisible();
    await expect(tabs(page).getByRole('button', { name: /Overview|Activity|Dashboard/ })).toHaveCount(0);
    await expect(page.locator('.connections-overview')).toHaveCount(0);
    await expect(page.locator('.leadership-dashboard')).toHaveCount(0);

    await page.locator('.connections-section-more').getByRole('button', { name: /More/ }).click();
    await page.getByRole('button', { name: 'Activity history', exact: true }).click();
    await expect(page.getByText('A reference log of existing record events.')).toBeVisible();
    await expect(tabs(page).getByRole('button', { name: /Activity/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Back to Companies/ }).click();
    await expect(tabs(page).getByRole('button', { name: /Companies/ })).toHaveAttribute('aria-current', 'page');
    await page.evaluate(() => sessionStorage.setItem('salesshop-connections-tab-v1', 'overview'));
    await page.reload();
    await expect(tabs(page).getByRole('button', { name: /Companies/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.connections-overview')).toHaveCount(0);
    await page.evaluate(() => sessionStorage.setItem('salesshop-connections-tab-v1', 'activity'));
    await page.reload();
    await expect(tabs(page).getByRole('button', { name: /Companies/ })).toHaveAttribute('aria-current', 'page');
  });
