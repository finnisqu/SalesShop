import {test,expect} from '@playwright/test';
import ExcelJS from 'exceljs';

/** Isolated local-demo workbook; no real customer prices, credentials or cloud data. */
async function exampleXlsx(){
  const excel=new ExcelJS.Workbook();
  const sheet=excel.addWorksheet('Builder Pricing');
  sheet.addRow(['Description','Customer Price','Internal Supplier Cost']);
  sheet.addRow(['Quartz countertop',{formula:'200*4',result:800},350]);
  sheet.addRow(['Vanity tops',1500,600]);
  sheet.getRow(2).height=32;
  sheet.getColumn(1).width=31;
  const buffer=await excel.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

async function setup(page:import('@playwright/test').Page){
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ Advanced Pricing Schedule'}).click();
  await beta.getByRole('textbox',{name:'Quote title'}).fill('QC Builder Workbook');
  const workspace=beta.getByRole('region',{name:'Pricing Schedule workspace'});
  await workspace.getByRole('button',{name:/Spreadsheet/}).click();
  await expect(workspace.getByLabel('Pricing schedule workbook')).toBeVisible();
  const bytes=await exampleXlsx();
  await workspace.locator('input[type="file"]').setInputFiles({
    name:'builder-pricing.xlsx',
    mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer:Buffer.from(bytes),
  });
  await expect(workspace.getByText('Workbook imported and commercial columns auto-mapped.')).toBeVisible();
  await expect(workspace.locator('.pricing-schedule-publish-note')).toContainText('2');
  return {beta,workspace};
}

test('spreadsheet import keeps cached formulas, customer-only prices and XLSX export',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','advanced desktop workbook export test');
  const {beta,workspace}=await setup(page);
  const published=workspace.locator('.pricing-schedule-mapped-preview');
  await expect(published).toContainText('Quartz countertop');
  await expect(published).toContainText('$800.00');
  await expect(published).toContainText('$1,500.00');
  await expect(published).not.toContainText('350');
  await expect(published).not.toContainText('600');
  const downloadPromise=page.waitForEvent('download');
  await workspace.getByRole('button',{name:'Export .xlsx'}).click();
  const download=await downloadPromise;
  const output=new ExcelJS.Workbook();
  await output.xlsx.readFile(await download.path());
  const exported=output.worksheets[0];
  expect(exported.getCell('B2').value).toMatchObject({formula:'200*4',result:800});
  expect(exported.getCell('B3').value).toBe(1500);
  expect(exported.getRow(2).height).toBe(32);
  const rail=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  await rail.getByRole('button',{name:'Customer preview'}).click();
  const paper=beta.locator('.pricing-schedule-customer-preview');
  await expect(paper).toContainText('$800.00');
  await expect(paper).toContainText('$1,500.00');
  await expect(paper).not.toContainText('Internal Supplier Cost');
  await rail.getByRole('button',{name:'Pricing Schedule'}).click();
  await expect(workspace.getByText('builder-pricing.xlsx')).toBeVisible();
  await page.reload();
  const reopened=page.getByRole('main',{name:'Quotes mobile beta'});
  await expect(reopened).toBeVisible();
  // Reload may return to the library or a previously selected quote tab.
  // Explicitly reopen the saved schedule before inspecting its spreadsheet.
  const savedCard=reopened.locator('.qmb-listcard').filter({hasText:'QC Builder Workbook'});
  if(await savedCard.count())await savedCard.click();
  await reopened.getByRole('complementary',{name:'Quote workspace navigation'})
    .getByRole('button',{name:'Pricing Schedule'}).click();
  await expect(reopened.locator('.pricing-schedule-mapped-preview')).toContainText('$800.00');
});

test('mobile price mapping remains accessible without consuming the workbook viewport',async({page},info)=>{
  test.skip(info.project.name!=='phone-390','phone mapping and single-column containment');
  const {beta,workspace}=await setup(page);
  const panel=workspace.locator('.pricing-schedule-mapping-panel');
  const toggle=panel.getByRole('button',{name:/Map columns/});
  await expect(toggle).toBeVisible();
  await expect(panel.getByRole('combobox',{name:'Sheet'})).toBeHidden();
  await toggle.click();
  await expect(panel.getByRole('combobox',{name:'Sheet'})).toBeVisible();
  await panel.getByRole('button',{name:/Hide columns/}).click();
  await expect(panel.getByRole('combobox',{name:'Sheet'})).toBeHidden();
  const limits=await beta.evaluate(root=>{
    const pageRect=root.getBoundingClientRect();
    const workbook=root.querySelector('.pricing-schedule-workbook-host')!.getBoundingClientRect();
    return {pageWidth:pageRect.width,workbookRight:workbook.right,availableRight:pageRect.right};
  });
  expect(limits.workbookRight).toBeLessThanOrEqual(limits.availableRight+2);
  expect(limits.pageWidth).toBeLessThanOrEqual(390+2);
});


test('recalculation updates cached customer price and exported XLSX after stale formula import',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Univer formula result and export regression');
  const excel=new ExcelJS.Workbook();
  const sheet=excel.addWorksheet('Builder Pricing');
  sheet.addRow(['Description','Customer Price']);
  sheet.addRow(['Kitchen quartz',{formula:'250*4',result:1}]);
  const bytes=new Uint8Array(await excel.xlsx.writeBuffer() as ArrayBuffer);
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ Advanced Pricing Schedule'}).click();
  const workspace=beta.getByRole('region',{name:'Pricing Schedule workspace'});
  await workspace.getByRole('button',{name:/Spreadsheet/}).click();
  await workspace.locator('input[type="file"]').setInputFiles({
    name:'stale-builder.xlsx',
    mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer:Buffer.from(bytes),
  });
  const published=workspace.locator('.pricing-schedule-mapped-preview');
  await expect(published).toContainText('Kitchen quartz');
  // The imported cached formula result is intentionally incorrect.
  await expect(published).toContainText('$1.00');
  await workspace.getByRole('button',{name:'Recalculate formulas'}).click();
  await expect(published).toContainText('$1,000.00');
  const downloaded=page.waitForEvent('download');
  await workspace.getByRole('button',{name:'Export .xlsx'}).click();
  const exportResult=await downloaded;
  const exported=new ExcelJS.Workbook();
  await exported.xlsx.readFile(await exportResult.path());
  expect(exported.worksheets[0].getCell('B2').value).toMatchObject({
    formula:'250*4',result:1000,
  });
});
