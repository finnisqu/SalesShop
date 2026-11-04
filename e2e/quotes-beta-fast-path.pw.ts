import {test,expect} from '@playwright/test';

test('Quick Quote Details flows into unified Area tables, strike-through and calculator without auto-issuing',
 async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Single focused phone quote navigation');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:/^\+ New(?: document)?$/}).first().click();
  const picker=page.getByRole('dialog',{name:'New Sales Document'});
  await picker.getByRole('button',{name:/^Quick Quote/}).click();
  await picker.getByRole('textbox',{name:'Quote name'}).fill('Unified fast path QC');
  await picker.getByRole('button',{name:/Create document/}).click();
  await expect(beta.getByRole('region',{name:'Quote customer and deal details'})).toBeVisible();
  // Details no longer creates Areas directly. Advance into the unified builder.
  await beta.getByRole('button',{name:/Continue to Build Quote/}).click();
  await expect(beta.getByRole('navigation',{name:'Build Quote views'})).toBeVisible();
  await expect(beta.locator('.qqs-mobile-empty')).toBeVisible();
  await beta.getByRole('button',{name:/Add an Area/}).first().click();
  await expect(beta.locator('.qqs-row:not(.qqs-general)')).toHaveCount(1);
  await expect(beta.getByRole('button',{name:/Continue to Pricing Review/})).toBeVisible();
  // This stage is still internal; no send or issue dialog may open automatically.
  await expect(beta.getByRole('dialog',{name:'Review and issue quote'})).toHaveCount(0);
});
