import {test,expect} from '@playwright/test';

/** A plain fee estimate should not require a fabricated countertop Area. */
test('Quick Quote supports an explicit General-only start',async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Phone-first General-only fast path');
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
  await picker.getByRole('textbox',{name:'Quote name'}).fill('General-only trip fee');
  await picker.getByRole('button',{name:/Create document/}).click();
  await expect(beta.getByRole('region',{name:'Quote customer and deal details'})).toBeVisible();
  await beta.getByRole('button',{name:'Start with General charges ›'}).click();
  await expect(beta.getByRole('heading',{name:'General'})).toBeVisible();
  await expect(beta.locator('[data-area-sort-id]')).toHaveCount(0);
  await expect(beta.getByRole('button',{name:'Custom',exact:true})).toBeVisible();
  await expect(beta.getByText('No Areas yet.')).toBeVisible();
});
