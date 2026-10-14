import {test,expect} from '@playwright/test';

async function library(page:import('@playwright/test').Page){
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
async function create(page:import('@playwright/test').Page,template:string,starting?:string){
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New document'}).click();
  const dialog=page.getByRole('dialog',{name:'New Sales Document'});
  await dialog.getByRole('button',{name:new RegExp('^'+template)}).click();
  if(starting)await dialog.getByRole('button',{name:new RegExp(starting)}).click();
  await dialog.getByRole('button',{name:/Create document/}).click();
  await expect(dialog).not.toBeVisible();
  return beta;
}

test('document library creates independent Quick Quote and Builder Rate editors',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop new-template workflow');
  const beta=await library(page);
  await beta.getByRole('button',{name:'+ New document'}).click();
  const dialog=page.getByRole('dialog',{name:'New Sales Document'});
  await expect(dialog.getByRole('button',{name:/^Quick Quote/})).toContainText(/commercial projects/i);
  await expect(dialog.getByRole('button',{name:/^Multi-Family/})).toContainText(/wholesale/i);
  await dialog.getByRole('button',{name:/^Multi-Family/}).click();
  await expect(dialog).toContainText('cannot create a draft');
  await expect(dialog.getByRole('button',{name:/Create document/})).toHaveCount(0);
  await dialog.getByRole('button',{name:'← All templates'}).click();
  await dialog.getByRole('button',{name:/^Quick Quote/}).click();
  await dialog.getByRole('button',{name:/Create document/}).click();
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toBeVisible();
  await expect(beta.getByRole('region',{name:'Pricing Schedule workspace'})).toHaveCount(0);
  await beta.getByRole('button',{name:/Documents/}).first().click();
  await create(page,'Builder Rate Schedule','Company stock rates');
  await expect(beta.getByRole('region',{name:'Builder Rate Schedule editor'})).toBeVisible();
  await expect(beta.getByRole('region',{name:'Pricing Schedule workspace'})
    .getByText('Builder Rate Schedule')).toBeVisible();
  await expect(beta.getByRole('button',{name:/Plan Pricing|Spreadsheet/})).toHaveCount(0);
  await beta.getByRole('button',{name:/Documents/}).first().click();
  await expect(beta.getByRole('button',{name:/Builder Rate Schedule/}).first()).toBeVisible();
});

test('create new community from a previous builder rate agreement without making it live-linked',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop template copy flow');
  const beta=await library(page);
  await create(page,'Builder Rate Schedule');
  const editor=beta.getByRole('region',{name:'Builder Rate Schedule editor'});
  await editor.getByRole('button',{name:/Add material|\+ Material|material level/i}).first().click();
  await beta.getByRole('button',{name:/Documents/}).first().click();
  await beta.getByRole('button',{name:'+ New document'}).click();
  const dialog=page.getByRole('dialog',{name:'New Sales Document'});
  await dialog.getByRole('button',{name:/^Community Plan Pricing/}).click();
  await dialog.getByRole('button',{name:/Copy previous agreement/}).click();
  await dialog.getByRole('combobox',{name:'Previous agreement'}).selectOption({index:1});
  await dialog.getByRole('button',{name:/Create document/}).click();
  await expect(beta.getByRole('region',{name:'Community Plan Pricing editor'})).toBeVisible();
  await expect(beta.getByRole('navigation',{name:'Calculated builder workflow'})).toBeVisible();
  await expect(beta.getByRole('button',{name:/Spreadsheet/})).toHaveCount(0);
  await beta.getByRole('button',{name:/Documents/}).first().click();
  await beta.getByRole('button',{name:'Community Plan Pricing',exact:true}).click();
  await expect(beta.getByRole('heading',{name:'Sales Documents'})).toBeVisible();
  await expect(beta.locator('.qmb-listcard').filter({hasText:'New agreement'})).toBeVisible();
});

test('Custom Spreadsheet opens directly in isolated Univer editor',async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Mobile template selection');
  const beta=await library(page);
  await create(page,'Custom Spreadsheet');
  const wrapper=beta.getByRole('region',{name:'Custom Spreadsheet editor'});
  await expect(wrapper).toBeVisible();
  await expect(beta.getByRole('region',{name:'Pricing Schedule workspace'})).toContainText('Custom Spreadsheet');
  await expect(beta.getByRole('navigation',{name:'Calculated builder workflow'})).toHaveCount(0);
  await expect(wrapper.getByRole('button',{name:'Import .xlsx'})).toBeVisible();
});
