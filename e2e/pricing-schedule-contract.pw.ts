import {test,expect} from '@playwright/test';
import ExcelJS from 'exceljs';

test('D.R. Horton contract rows import, recalculate 12 Sanford configurations, and export',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Contract authoring browser parity');
  const excel=new ExcelJS.Workbook(),sheet=excel.addWorksheet('Table 1');
  [25,175,25,32,20,40].forEach((v,i)=>{sheet.getCell(2,8+i).value=v;});
  ['Spec Series','Base / Opt.','Plan  #','Plan Name','Option','Description','Div.\nContract Pricing']
    .forEach((heading,i)=>{sheet.getCell(4,i+1).value=heading;});
  const rows=[
    ['DRH-e','Base',1183,'Sanford','R0000DRH','No kitchen backsplash',1285,null,1,30,null,14,2],
    ['Express','Base',1183,'Sanford','R0000EXP','All splashes',1435,null,1,36,null,14,2],
    ['DRH-e','Option',1183,'Sanford','R1800400','Quartz kitchen only',960,null,null,-30,30,null,null],
  ];
  rows.forEach((row,r)=>row.forEach((v,c)=>{if(v!==null)sheet.getCell(r+5,c+1).value=v;}));
  sheet.getCell('X5').value=1;
  sheet.getCell('W5').value=7;
  sheet.getCell('T6').value=6;
  const bytes=new Uint8Array(await excel.xlsx.writeBuffer() as ArrayBuffer);
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New document'}).click();
  await page.getByRole('dialog',{name:'New Sales Document'}).getByRole('button',{name:/Community Plan Pricing/}).click();
  await page.getByRole('dialog',{name:'New Sales Document'}).getByRole('textbox',{name:'Document name'}).fill('QC 4 Document');
  await page.getByRole('dialog',{name:'New Sales Document'}).getByRole('button',{name:/Create document/}).click();
  const workspace=beta.getByRole('region',{name:'Pricing Schedule workspace'});
  await workspace.getByRole('button',{name:'Contract Table'}).click();
  const contract=workspace.getByRole('region',{name:'Builder contract schedule'});
  await contract.locator('input[type="file"]').setInputFiles({
    name:'GVL-DRH-sample.xlsx',
    mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer:Buffer.from(bytes),
  });
  await expect(contract.getByRole('status')).toContainText('Imported 3 base / option rows');
  await expect(contract).toContainText('3 contract rows');
  await expect(contract.locator('.pricing-contract-table')).toContainText('$1,285.00');
  await expect(contract.locator('.pricing-contract-table')).toContainText('$960.00');
  await contract.locator('.pricing-contract-rates summary').click();
  await contract.locator('.pricing-contract-rates').getByRole('spinbutton',{name:'Quartz bathrooms / SF'}).fill('28');
  await contract.getByRole('spinbutton',{name:'Kitchen backsplash SF (when included)'}).fill('6');
  await contract.getByRole('button',{name:'Generate 12 configurations'}).click();
  await expect(contract).toContainText('15 contract rows');
  await expect(contract.locator('.pricing-contract-table')).toContainText('CFG-A1');
  await expect(contract.locator('.pricing-contract-table')).toContainText('CFG-F2');
  await expect(contract.locator('.pricing-contract-table')).toContainText('$1,799.00');
  const downloadPromise=page.waitForEvent('download');
  await contract.getByRole('button',{name:'Export contract .xlsx'}).click();
  const download=await downloadPromise;
  const exported=new ExcelJS.Workbook();
  await exported.xlsx.readFile(await download.path());
  expect(exported.worksheets[0].getCell('G5').value).toBe(1285);
  expect(exported.worksheets[0].rowCount).toBeGreaterThanOrEqual(19);
  expect(exported.worksheets[0].getCell('AL2').value).toBe(28);
});
