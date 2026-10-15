import { test, expect, type Page } from '@playwright/test';

const supported = (project: string) => ['phone-390', 'desktop-1280'].includes(project);

async function createAccount(page: Page, name: string) {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Quick create' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create in SalesShop' });
  await dialog.getByRole('button', { name: /New Account/ }).click();
  await dialog.getByRole('textbox', { name: 'Account / company name' }).fill(name);
  await dialog.getByRole('button', { name: 'Create & open' }).click();
}

test('Company record supports edit, relationships, refresh and Back on mobile and desktop', async ({ page }, info) => {
  test.skip(!supported(info.project.name), 'Dedicated Connections record QC');
  const name = 'Record QC Company ' + Date.now();
  await createAccount(page, name);
  await expect(page).toHaveURL(/\/connections\/companies\/company_/);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About this company' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Activity history/ })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quotes' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit company' }).click();
  await page.getByRole('spinbutton', { name: 'Annual units' }).fill('80');
  await page.getByRole('spinbutton', { name: 'Average revenue / unit' }).fill('3500');
  await page.getByRole('spinbutton', { name: 'Expected share (%)' }).fill('50');
  await page.getByRole('button', { name: 'Save company' }).click();
  await expect(page.getByText('$140,000', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '+ Add person' }).click();
  const contactForm = page.locator('.connections-record-related form.connections-record-edit-form');
  await contactForm.getByRole('textbox', { name: 'Name' }).fill('Record QC Estimator');
  await contactForm.getByRole('textbox', { name: 'Email' }).fill('records@example.com');
  await contactForm.getByRole('button', { name: 'Save person' }).click();
  await expect(page.getByText('Record QC Estimator')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/connections\/companies\/company_/);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('Record QC Estimator')).toBeVisible();
  await page.getByRole('button', { name: /Connections/ }).filter({ hasText: '← Connections' }).click();
  await expect(page).toHaveURL(/\/connections$/);
  await expect(page.getByRole('button', { name: name, exact: false })).toBeVisible();
});
