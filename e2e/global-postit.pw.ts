import { test, expect, type Page } from '@playwright/test';

async function openNotebookNote(page: Page) {
  const launcher = page.getByRole('button', { name: 'Quick Note' });
  await launcher.first().click();
  const panel = page.getByRole('region', { name: 'Private Quick Notes' });
  await expect(panel).toBeVisible();
  return panel;
}

test('private global Post-it survives tab navigation and a full reload', async ({ page }, info) => {
  test.skip(!['phone-390', 'desktop-1280'].includes(info.project.name), 'Focused personal notes QC');
  await page.goto('/');
  const panel = await openNotebookNote(page);
  const editor = panel.getByRole('textbox', { name: 'Private Post-it text' });
  await expect(editor).toBeVisible();
  await editor.fill('Call supplier about kitchen sink · private');
  await expect(editor).toHaveValue('Call supplier about kitchen sink · private');
  await panel.getByRole('button', { name: 'Collapse Post-its' }).click();
  await expect(panel).toHaveCount(0);

  if (info.project.name === 'phone-390') {
    await page.getByRole('button', { name: 'Open SalesShop navigation' }).click();
    await page.getByRole('dialog', { name: 'SalesShop navigation' }).getByRole('button', { name: 'Board' }).click();
  } else {
    await page.getByRole('navigation', { name: 'SalesShop sections' }).getByRole('button', { name: 'Board' }).click();
  }
  const reopened = await openNotebookNote(page);
  await expect(reopened.getByRole('textbox', { name: 'Private Post-it text' }))
    .toHaveValue('Call supplier about kitchen sink · private');

  await page.reload();
  const reloaded = await openNotebookNote(page);
  await expect(reloaded.getByRole('textbox', { name: 'Private Post-it text' }))
    .toHaveValue('Call supplier about kitchen sink · private');
  await expect(reloaded.getByText('Private · saved to Notebook')).toBeVisible();
});
