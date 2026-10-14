import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';

async function library(page:Page){
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await expect(beta.getByRole('heading',{name:'Sales Documents'})).toBeVisible();
  return beta;
}
async function newTemplate(page:Page,title:string){
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New document'}).click();
  const picker=page.getByRole('dialog',{name:'New Sales Document'});
  await picker.getByRole('button',{name:new RegExp('^'+title)}).click();
  await picker.getByRole('button',{name:/Create document/}).click();
  await expect(picker).not.toBeVisible();
  return beta;
}
test('Quick Quote stays in its own shell through edit, preview, details, copy and reopen',async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Focused mobile document shell regression');
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  const beta=await library(page);
  await newTemplate(page,'Quick Quote');
  const title=beta.getByRole('textbox',{name:'Quote title'});
  await title.fill('Sample Retail Countertops');
  const toolbar=beta.getByRole('toolbar',{name:'Document actions'});
  await expect(toolbar).toContainText('Quick Quote');
  await expect(toolbar).toContainText('Saved on device');
  await expect(beta.getByRole('button',{name:/Assign a customer/})).toBeVisible();
  await toolbar.getByRole('button',{name:'View customer document'}).click();
  await expect(beta.locator('.qmb-preview')).toBeVisible();
  await toolbar.getByRole('button',{name:'Edit',exact:true}).click();
  await expect(title).toHaveValue('Sample Retail Countertops');
  await beta.getByRole('button',{name:/Assign a customer/}).click();
  await expect(beta.getByRole('region',{name:'Quote customer and project details'})).toBeVisible();
  await toolbar.getByRole('button',{name:'More document actions'}).click();
  await toolbar.getByRole('button',{name:'Make independent copy'}).click();
  await expect(title).toHaveValue('Sample Retail Countertops · Copy');
  await expect(beta.locator('.qmb-document-origin')).toContainText('Independent working copy');
  await expect(beta.locator('.qmb-document-origin')).toContainText('Sample Retail Countertops');
  await expect(toolbar).toContainText('Rev 0');
  await beta.locator('.qmb-pagehead .qmb-back').click();
  await expect(beta.getByRole('heading',{name:'Sales Documents'})).toBeVisible();
  await expect(beta.locator('.qmb-listcard').filter({hasText:'Sample Retail Countertops'})).toHaveCount(2);
  await beta.locator('.qmb-listcard').filter({hasText:'Sample Retail Countertops · Copy'}).click();
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toHaveValue('Sample Retail Countertops · Copy');
  await page.reload();
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toHaveValue('Sample Retail Countertops · Copy');
  expect(errors).toEqual([]);
});
test('Builder Rates has template-specific editor, direct customer preview and revision details',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Focused desktop document shell regression');
  const beta=await library(page);
  await newTemplate(page,'Builder Rate Schedule');
  const toolbar=beta.getByRole('toolbar',{name:'Document actions'});
  await expect(beta.getByRole('region',{name:'Builder Rate Schedule editor'})).toBeVisible();
  await expect(toolbar).toContainText('Builder Rate Schedule');
  await expect(toolbar).toContainText('Saved on device');
  await toolbar.getByRole('button',{name:'View customer document'}).click();
  await expect(beta.getByRole('region',{name:'Builder Rate Schedule editor'})).toHaveCount(0);
  await toolbar.getByRole('button',{name:'More document actions'}).click();
  await toolbar.getByRole('button',{name:'Customer, project & revisions'}).click();
  await expect(beta.getByRole('region',{name:'Quote customer and project details'})).toBeVisible();
  await expect(beta.getByRole('region',{name:'Quote document and history'})).toBeVisible();
  await expect(beta.getByRole('combobox',{name:'Document type'})).toBeDisabled();
  await toolbar.getByRole('button',{name:'Edit',exact:true}).click();
  await expect(beta.getByRole('region',{name:'Builder Rate Schedule editor'})).toBeVisible();
  await beta.locator('.qmb-pagehead .qmb-back').click();
  await expect(beta.getByRole('heading',{name:'Sales Documents'})).toBeVisible();
  await beta.locator('.qmb-listcard').filter({hasText:'Builder Rate Schedule'}).first().click();
  await expect(beta.getByRole('region',{name:'Builder Rate Schedule editor'})).toBeVisible();
});
