import {test,expect} from '@playwright/test';

test('Catalog Materials shortcut opens the editable historical Stock Builder Level reference',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Representative mobile Catalog regression');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','catalog');
    localStorage.setItem('salesshop-catalog-section-v1','materials');
  });
  await page.reload();
  const catalog=page.locator('.catalog-workspace');
  await expect(catalog).toBeVisible();
  await catalog.getByRole('button',{name:/Builder Levels/}).click();
  await expect(catalog.locator('.rates-workspace')).toBeVisible();
  const pricing=catalog.getByRole('button',{name:'Material Pricing'});
  await expect(pricing).toHaveAttribute('aria-pressed','true');
  const table=catalog.locator('.rates-material-pricing-table');
  await expect(table.getByText('Level 0')).toBeVisible();
  await expect(table.getByText('Granite only')).toBeVisible();
  await expect(table.getByText('First quartz level')).toBeVisible();
  await catalog.getByRole('button',{name:'Edit pricing'}).click();
  await expect(catalog.locator('.material-level-sheet')).toBeVisible();
  await expect(catalog.locator('.material-level-sheet tbody tr')).toHaveCount(9);
});
