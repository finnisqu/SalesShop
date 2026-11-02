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
  await expect(beta.getByRole('button',{name:'+ Start first Area ›'})).toBeVisible();
  await beta.getByRole('button',{name:'+ Start first Area ›'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen');
  await beta.getByRole('button',{name:/Done · (Areas|Pricing)/}).click();
  const workspace=beta.getByRole('region',{name:'Takeoffs selections and pricing tables'});
  await expect(workspace).toBeVisible();
  const kitchen=workspace.getByRole('region',{name:'Area work table Kitchen'});
  await expect(kitchen).toBeVisible();
  await kitchen.getByRole('button',{name:'+ Piece'}).click();
  await kitchen.getByRole('textbox',{name:'Piece 1 name'}).fill('Kitchen counter');
  await kitchen.getByRole('textbox',{name:'Piece 1 length inches'}).fill('48');
  await kitchen.getByRole('textbox',{name:'Piece 1 length inches'}).blur();
  await kitchen.getByRole('textbox',{name:'Piece 1 width inches'}).fill('24');
  await kitchen.getByRole('textbox',{name:'Piece 1 width inches'}).blur();
  await expect(kitchen.getByText('8 SF')).toBeVisible();
  await kitchen.getByRole('checkbox',{name:'Piece 1 backsplash'}).check();
  await expect(kitchen.getByText('9.33 SF').first()).toBeVisible();
  await kitchen.getByRole('button',{name:/Exclude splash/}).click();
  await expect(kitchen.locator('.qwt-splash-line.is-excluded')).toHaveCount(1);
  await kitchen.getByRole('button',{name:/Restore splash/}).click();
  await expect(kitchen.locator('.qwt-splash-line.is-excluded')).toHaveCount(0);
  await expect(kitchen.getByRole('button',{name:'Calculator ↗'})).toBeVisible();
  await kitchen.getByRole('button',{name:'Calculator ↗'}).click();
  const calc=page.getByRole('dialog',{name:'Calculator for Kitchen'});
  await expect(calc).toBeVisible();
  await expect(calc).toContainText('30%');
  await calc.getByRole('button',{name:'Close calculator'}).click();
  await kitchen.getByRole('button',{name:/Exclude piece/}).click();
  await expect(kitchen.getByRole('button',{name:/Restore piece/})).toBeVisible();
  await expect(kitchen.locator('.qwt-line.is-excluded')).toHaveCount(1);
  await kitchen.getByRole('button',{name:/Restore piece/}).click();
  await expect(kitchen.locator('.qwt-line.is-excluded')).toHaveCount(0);
  await workspace.getByRole('button',{name:'+ Area',exact:true}).click();
  await expect(workspace.getByRole('region',{name:/Area work table/})).toHaveCount(2);
  // Nothing here sends a contract. Review remains an explicit separate step.
  await expect(beta.getByRole('dialog',{name:'Review and issue quote'})).toHaveCount(0);
});
