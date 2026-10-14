import {expect,test} from '@playwright/test';
import ExcelJS from 'exceljs';

async function openManualMatrix(page:import('@playwright/test').Page){
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ Advanced Pricing Schedule'}).click();
  const workspace=beta.getByRole('region',{name:'Pricing Schedule workspace'});
  await workspace.getByRole('button',{name:/Plan Pricing/}).click();
  await workspace.getByRole('button',{name:'Manual Matrix'}).click();
  return workspace;
}

test('manually enter complete house matrix and per-plan add-on rates then export',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Manual authoring focused desktop workflow');
  const ws=await openManualMatrix(page);
  const matrix=ws.getByRole('region',{name:'Manual pricing matrix'});
  const planName=matrix.getByPlaceholder('Sanford');
  await planName.fill('Sanford');
  await matrix.getByRole('button',{name:'Add plan'}).click();
  await expect(matrix.getByRole('columnheader',{name:/Granite kitchen.*granite baths.*all splashes/i})).toBeVisible();
  await expect(matrix).toContainText('0 / 6');
  await matrix.getByRole('spinbutton',{name:'Price for Sanford option A'}).fill('1285');
  await matrix.getByRole('spinbutton',{name:'Price for Sanford option A'}).press('Tab');
  await matrix.getByRole('spinbutton',{name:'Price for Sanford option B'}).fill('1435');
  await matrix.getByRole('spinbutton',{name:'Price for Sanford option B'}).press('Tab');
  await expect(matrix).toContainText('2 / 6');
  await matrix.getByPlaceholder('Sanford').fill('Devon');
  await matrix.getByRole('button',{name:'Add plan'}).click();
  await expect(matrix).toContainText('2 / 12');
  await ws.getByRole('button',{name:'Add-on Rates'}).click();
  const addons=ws.getByRole('region',{name:'Manual add-on rates'});
  await addons.getByRole('button',{name:'+ Double-bowl master'}).click();
  await addons.getByRole('spinbutton',{name:'Standard rate for Master bathroom double-bowl upgrade'}).fill('180');
  await addons.getByRole('spinbutton',{name:'Standard rate for Master bathroom double-bowl upgrade'}).press('Tab');
  await expect(addons).toContainText('Using standard');
  await addons.getByRole('spinbutton',{name:'Master bathroom double-bowl upgrade override for Devon'}).fill('215');
  await addons.getByRole('spinbutton',{name:'Master bathroom double-bowl upgrade override for Devon'}).press('Tab');
  await expect(addons).toContainText('Plan override');
  await ws.getByRole('button',{name:'Contract Table'}).click();
  const contract=ws.getByRole('region',{name:'Builder contract schedule'});
  const waitForDownload=page.waitForEvent('download');
  await contract.getByRole('button',{name:'Export contract .xlsx'}).click();
  const result=await waitForDownload;
  const file=new ExcelJS.Workbook();
  await file.xlsx.readFile(await result.path());
  const schedule=file.getWorksheet('Contract Pricing')!;
  expect(schedule.getCell('G5').value).toBe(1285);
  expect(schedule.getCell('G6').value).toBe(1435);
  const allValues=Array.from({length:18},(_,index)=>String(schedule.getCell(index+5,6).value??''));
  expect(allValues.filter(x=>x.includes('double-bowl'))).toHaveLength(2);
  const rates=file.getWorksheet('Add-on Rate Book')!;
  expect(rates.getCell('E3').value).toBe(180);
  expect(rates.getCell('F3').value).toBe(180);
  expect(rates.getCell('G3').value).toBe(215);
});

test('manual price matrix fits a mobile viewport and keeps inputs accessible',async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Mobile manual matrix QC');
  const ws=await openManualMatrix(page);
  const matrix=ws.getByRole('region',{name:'Manual pricing matrix'});
  await matrix.getByPlaceholder('Sanford').fill('Sanford');
  await matrix.getByRole('button',{name:'Add plan'}).click();
  await expect(matrix.getByRole('spinbutton',{name:'Price for Sanford option A'})).toBeVisible();
  const scroll=matrix.locator('.pricing-manual-table-scroll');
  await expect(scroll).toBeVisible();
  const overflow=await scroll.evaluate(el=>({
    outer:el.clientWidth,inner:el.scrollWidth,
  }));
  expect(overflow.inner).toBeGreaterThanOrEqual(overflow.outer);
  await matrix.getByRole('spinbutton',{name:'Price for Sanford option A'}).fill('1200');
  await matrix.getByRole('spinbutton',{name:'Price for Sanford option A'}).press('Tab');
  await expect(matrix).toContainText('1 / 6');
});
