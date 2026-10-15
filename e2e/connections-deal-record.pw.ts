import { test, expect } from '@playwright/test';

test('Deal page creates, edits, links quotes, returns to directory and reloads',
  async ({ page }, info) => {
    test.skip(!['phone-390','desktop-1280'].includes(info.project.name), 'Deal record QC');
    const deal = 'Deal QC ' + Date.now();
    await page.goto('/connections');
    const tabs = page.getByRole('navigation', { name: 'Connections sections' });
    await tabs.getByRole('button', { name: /Deals/ }).click();
    await page.getByRole('button', { name: '+ Deal' }).click();
    const form = page.locator('.connections-add-form');
    await form.getByRole('textbox', { name: 'Deal name' }).fill(deal);
    await form.getByRole('button', { name: 'Create & open' }).click();
    await expect(page).toHaveURL(/\/connections\/deals\/project_/);
    await expect(page.getByRole('heading', { name: deal, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'About this deal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quotes' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Activity history/ })).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: 'Edit deal' }).click();
    await page.getByRole('combobox', { name: 'Stage' }).selectOption('Bid Development');
    await page.getByRole('spinbutton', { name: 'Amount' }).fill('120000');
    await page.getByRole('textbox', { name: 'Next action' }).fill('Estimate counters');
    await page.getByRole('button', { name: 'Save deal' }).click();
    await expect(page.getByText('$120,000', { exact: true })).toBeVisible();
    await expect(page.getByText('Estimate counters')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/connections\/deals\/project_/);
    await expect(page.getByRole('heading', { name: deal, exact: true })).toBeVisible();
    await expect(page.getByText('Estimate counters')).toBeVisible();
    await page.getByRole('button', { name: /Connections/ }).filter({ hasText: '← Connections' }).click();
    await expect(page).toHaveURL(/\/connections$/);
    await expect(tabs.getByRole('button', { name: /Deals/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.connections-directory').getByRole('button', { name: new RegExp(deal) })).toBeVisible();
  });

test('Unknown Deal ID stays on a safe record fallback; legacy Board project URLs are recognized',
  async ({ page }, info) => {
    test.skip(!['phone-390','desktop-1280'].includes(info.project.name), 'Deal record QC');
    await page.goto('/connections/deals/project_unknown');
    await expect(page.getByRole('heading', { name: 'Deal not available' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Deals' }).click();
    await expect(page).toHaveURL(/\/connections$/);
    await page.goto('/board/projects/project_unknown');
    await expect(page.locator('.sales-app.view-board')).toBeVisible();
  });
