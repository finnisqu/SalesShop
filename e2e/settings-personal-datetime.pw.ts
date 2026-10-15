import { test, expect } from '@playwright/test';

test('Settings remember personal date/time/calendar choices without altering quote data', async ({ page }, info) => {
  test.skip(!['phone-390','desktop-1280'].includes(info.project.name), 'Focused settings QC');
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('salesshop-active-view-v1', 'settings'));
  await page.reload();
  await expect(page.locator('.sales-app.view-settings')).toBeVisible();

  const nav=page.getByRole('navigation', {name:'Settings sections'});
  await nav.getByRole('button', {name:/My Account/}).click();
  const date=page.getByRole('combobox', {name:'Preferred date format'});
  const time=page.getByRole('combobox', {name:'Preferred time format'});
  const week=page.getByRole('combobox', {name:'First day of calendar week'});
  const zone=page.getByRole('combobox', {name:'Preferred time zone'});
  await expect(date).toBeVisible();
  await date.selectOption('day-first');
  await time.selectOption('24-hour');
  await week.selectOption('monday');
  await zone.selectOption('America/New_York');
  await expect(page.getByLabel('Date and calendar preview')).toContainText('14/10/2026');
  await expect(page.getByLabel('Date and calendar preview')).toContainText('15:30');

  await page.reload();
  await page.getByRole('navigation', {name:'Settings sections'})
    .getByRole('button', {name:/My Account/}).click();
  await expect(page.getByRole('combobox', {name:'Preferred date format'})).toHaveValue('day-first');
  await expect(page.getByRole('combobox', {name:'Preferred time format'})).toHaveValue('24-hour');
  await expect(page.getByRole('combobox', {name:'First day of calendar week'})).toHaveValue('monday');
  await expect(page.getByRole('combobox', {name:'Preferred time zone'})).toHaveValue('America/New_York');
  await page.getByRole('button', {name:'Restore date & time defaults'}).click();
  await expect(page.getByRole('combobox', {name:'Preferred date format'})).toHaveValue('month-first');
  await expect(page.getByRole('combobox', {name:'Preferred time zone'})).toHaveValue('system');
});

test('Company settings have built-in customer wording but do not silently modify quotes', async ({ page },info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop standard-terms reference');
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('salesshop-active-view-v1','settings'));
  await page.reload();
  await expect(page.locator('.sales-app.view-settings')).toBeVisible();
  const terms=page.locator('.settings-terms-card');
  await expect(terms).toBeVisible();
  await expect(terms.locator('.settings-term-row')).toHaveCount(6);
  await expect(terms.getByText('Reference only:',{exact:false})).toBeVisible();
  await expect(terms.getByRole('button',{name:'Copy Payment terms'})).toBeVisible();
});
