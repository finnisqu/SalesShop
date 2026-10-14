import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';

async function openLibrary(page:Page){
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
    sessionStorage.removeItem('salesshop:quotes-mobile-beta-location-v1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await expect(beta.getByRole('heading',{name:'Sales Documents'})).toBeVisible();
  return beta;
}
async function makeDocument(page:Page,template:string,name:string){
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:/^\+ New(?: document)?$/}).first().click();
  const picker=page.getByRole('dialog',{name:'New Sales Document'});
  await picker.getByRole('button',{name:new RegExp('^'+template)}).click();
  await picker.getByRole('textbox',{name:template==='Quick Quote'?'Quote name':'Document name'}).fill(name);
  await picker.getByRole('button',{name:/Create document/}).click();
  await expect(picker).not.toBeVisible();
  await beta.locator('.qmb-pagehead .qmb-back').click();
  await expect(beta.getByRole('heading',{name:'Sales Documents'})).toBeVisible();
}
test('mobile documents search by name/template and filter by status without losing the new action',async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Mobile document discovery and filters');
  const beta=await openLibrary(page);
  await makeDocument(page,'Quick Quote','Smith Kitchen');
  await makeDocument(page,'Community Plan Pricing','Oakwood Pricing');
  const query=beta.getByRole('textbox',{name:'Search my documents'});
  await query.fill('Smith');
  await expect(beta.locator('.qmb-library-entry')).toHaveCount(1);
  await expect(beta.locator('.qmb-library-entry')).toContainText('Smith Kitchen');
  await beta.getByRole('button',{name:'Clear document search'}).click();
  await beta.getByRole('navigation',{name:'Filter document templates'})
    .getByRole('button',{name:'Community Plan Pricing'}).click();
  await expect(beta.locator('.qmb-library-entry')).toHaveCount(1);
  await expect(beta.locator('.qmb-library-entry')).toContainText('Oakwood Pricing');
  await beta.getByRole('combobox',{name:'Document status'}).selectOption('issued');
  await expect(beta.getByRole('button',{name:'Clear filters'})).toBeVisible();
  await beta.getByRole('button',{name:'Clear filters'}).click();
  await expect(beta.locator('.qmb-library-entry').filter({hasText:'Smith Kitchen'})).toBeVisible();
  await expect(beta.locator('.qmb-library-entry').filter({hasText:'Oakwood Pricing'})).toBeVisible();
  await expect(beta.getByRole('button',{name:/^\+ New(?: document)?$/}).first()).toBeVisible();
});
test('desktop library sorts documents and safely restores an archived draft',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop document list and archive controls');
  const beta=await openLibrary(page);
  await makeDocument(page,'Quick Quote','Zulu Retail');
  await makeDocument(page,'Builder Rate Schedule','Alpha Builder');
  await beta.getByRole('combobox',{name:'Sort documents'}).selectOption('name');
  const names=await beta.locator('.qmb-listcard>strong').allTextContents();
  expect(names.indexOf('Alpha Builder')).toBeGreaterThanOrEqual(0);
  expect(names.indexOf('Alpha Builder')).toBeLessThan(names.indexOf('Zulu Retail'));
  await beta.getByRole('combobox',{name:'Document status'}).selectOption('drafts');
  await expect(beta.locator('.qmb-library-entry').filter({hasText:'Alpha Builder'})).toBeVisible();
  await expect(beta.locator('.qmb-library-entry').filter({hasText:'Zulu Retail'})).toBeVisible();
  const entry=beta.locator('.qmb-library-entry').filter({hasText:'Alpha Builder'});
  await entry.getByRole('button',{name:'Archive'}).click();
  await page.getByRole('dialog',{name:'Archive quote'}).getByRole('button',{name:'Archive quote'}).click();
  await expect(entry).toHaveCount(0);
  await beta.getByRole('combobox',{name:'Document status'}).selectOption('archived');
  const archived=beta.locator('.qmb-library-entry').filter({hasText:'Alpha Builder'});
  await expect(archived).toBeVisible();
  await archived.getByRole('button',{name:'Restore to active'}).click();
  await expect(archived).toHaveCount(0);
  await beta.getByRole('combobox',{name:'Document status'}).selectOption('active');
  await expect(beta.locator('.qmb-library-entry').filter({hasText:'Alpha Builder'})).toBeVisible();
});
