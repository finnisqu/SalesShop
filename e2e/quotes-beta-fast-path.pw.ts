import {test,expect} from '@playwright/test';

test('Quick Quote Details flows into modern Areas and Takeoffs workbook without auto-issuing',
 async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Single focused phone quote navigation');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:/^\\+ New(?: document)?$/}).first().click();
  const picker=page.getByRole('dialog',{name:'New Sales Document'});
  await picker.getByRole('button',{name:/^Quick Quote/}).click();
  await picker.getByRole('textbox',{name:'Quote name'}).fill('Unified fast path QC');
  await picker.getByRole('button',{name:/Create document/}).click();
  await expect(beta.getByRole('region',{name:'Quote customer and deal details'})).toBeVisible();
  // New guided flow: Project Details -> Areas workbook -> Takeoffs sheet.
  await beta.getByRole('button',{name:/Continue to Build Quote/}).click();
  const areas=beta.getByRole('region',{name:'Quick Quote compact Area summary'});
  await expect(areas).toBeVisible();
  await areas.locator('.qqs-inline-actions .qqs-accent').click();
  await expect(areas.locator('.qqs-grid.qqs-row')).toHaveCount(1);
  await beta.getByRole('navigation',{name:'Build Quote views'})
    .getByRole('button',{name:/Takeoffs/}).click();
  const sheet=beta.getByRole('region',{name:'Takeoffs spreadsheet'});
  await expect(sheet).toBeVisible();
  const area=sheet.locator('.qqt-area-block').first();
  await area.getByRole('button',{name:'+ Piece'}).click();
  const piece=area.locator('.qqt-row').first();
  await expect(piece).toBeVisible();
  // The compact spreadsheet intentionally edits on cell selection, not
  // through the removed first-Area wizard.
  await piece.getByRole('checkbox').check();
  await sheet.getByRole('button',{name:'Strike out selected rows'}).click();
  await expect(area.locator('.qqt-row.is-excluded')).toHaveCount(1);
  await piece.getByRole('checkbox').check();
  await sheet.getByRole('button',{name:'Restore selected rows'}).click();
  await expect(area.locator('.qqt-row.is-excluded')).toHaveCount(0);
  // Issuing remains a separate explicit approval step.
  await expect(beta.getByRole('dialog',{name:'Review and issue quote'})).toHaveCount(0);
});
