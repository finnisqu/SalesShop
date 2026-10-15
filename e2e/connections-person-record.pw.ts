import { test, expect } from '@playwright/test';

test('Person record links from directory and Company, edits fields, survives reload and Back',
  async ({ page }, info) => {
    test.skip(!['phone-390', 'desktop-1280'].includes(info.project.name), 'Targeted People record QC');
    const name = 'Person QC ' + Date.now();
    const companyName = 'Builder QC ' + Date.now();
    await page.goto('/connections');
    await page.getByRole('button', { name: '+ Company' }).click();
    await page.locator('.connections-add-form').getByRole('textbox', { name: 'Company name' }).fill(companyName);
    await page.locator('.connections-add-form').getByRole('button', { name: 'Save & open' }).click();
    await expect(page).toHaveURL(/\/connections\/companies\/company_/);
    await page.getByRole('button', { name: /Connections/ }).filter({ hasText: '← Connections' }).click();

    await page.getByRole('navigation', { name: 'Connections sections' }).getByRole('button', { name: /People/ }).click();
    await page.getByRole('button', { name: '+ Person' }).click();
    const form = page.locator('.connections-add-form');
    await form.getByRole('textbox', { name: 'Name' }).fill(name);
    await form.getByRole('textbox', { name: 'Email' }).fill('person-qc@example.com');
    await form.getByRole('combobox', { name: 'Company' }).selectOption({ label: companyName });
    await form.getByRole('button', { name: 'Add person' }).click();
    await expect(page).toHaveURL(/\/connections\/people\/contact_/);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Company', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Activity history/ })).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: 'Edit person' }).click();
    await page.getByRole('textbox', { name: 'Job title' }).fill('Estimator');
    await page.getByRole('textbox', { name: 'Phone' }).fill('5551230101');
    await page.getByRole('button', { name: 'Save person' }).click();
    await expect(page.getByText('Estimator', { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/connections\/people\/contact_/);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByText('Estimator', { exact: true }).first()).toBeVisible();
    await page.locator('.connections-record-center').getByRole('button', { name: new RegExp(companyName) }).click();
    await expect(page).toHaveURL(/\/connections\/companies\/company_/);
    await expect(page.getByRole('heading', { name: companyName, exact: true })).toBeVisible();
    await page.locator('.connections-record-related').getByRole('button', { name: new RegExp(name) }).click();
    await expect(page).toHaveURL(/\/connections\/people\/contact_/);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Connections/ }).filter({ hasText: '← Connections' }).click();
    await expect(page).toHaveURL(/\/connections$/);
    await expect(page.getByRole('navigation', { name: 'Connections sections' })
      .getByRole('button', { name: /People/ })).toHaveAttribute('aria-current', 'page');
  });

test('Invalid Person deep links show a safe not-found state', async ({ page }, info) => {
  test.skip(!['phone-390', 'desktop-1280'].includes(info.project.name), 'Targeted People record QC');
  await page.goto('/connections/people/contact_that_does_not_exist');
  await expect(page.getByRole('heading', { name: 'Person not available' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to People' }).click();
  await expect(page).toHaveURL(/\/connections$/);
});
