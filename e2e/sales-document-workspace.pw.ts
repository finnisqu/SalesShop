import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';

async function library(page:Page){
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
async function newTemplate(page:Page,title:string,name:string){
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New document'}).click();
  const picker=page.getByRole('dialog',{name:'New Sales Document'});
  await picker.getByRole('button',{name:new RegExp('^'+title)}).click();
  const input=picker.getByRole('textbox',{name:title==='Quick Quote'?'Quote name':'Document name'});
  await expect(picker.getByRole('button',{name:/Create document/})).toHaveCount(0);
  await input.fill(name);
  await picker.getByRole('button',{name:/Create document/}).click();
  await expect(picker).not.toBeVisible();
  return beta;
}
async function openOptions(page:Page){
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  const desktop=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  const controls=(await desktop.isVisible())?desktop:beta.locator('.qmb-history');
  await controls.getByRole('button',{name:'Document options'}).click();
  return controls;
}
test('mobile Quick Quote requires a name; defended copy retains original and restores on refresh',async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Focused mobile document QC');
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  const beta=await library(page);
  await newTemplate(page,'Quick Quote','Smith Residence');
  const title=beta.getByRole('textbox',{name:'Quote title'});
  await expect(title).toHaveValue('Smith Residence');
  await expect(beta.getByText('Saved on device').first()).toBeVisible();
  await beta.getByRole('navigation',{name:'Quote views'}).getByRole('button',{name:'Preview',exact:true}).click();
  await expect(beta.locator('.qmb-preview')).toBeVisible();
  await beta.getByRole('navigation',{name:'Quote views'}).getByRole('button',{name:'Build',exact:true}).click();
  await expect(title).toHaveValue('Smith Residence');
  const options=await openOptions(page);
  await options.getByRole('button',{name:/Make independent copy/}).click();
  const dialog=page.getByRole('dialog',{name:'Copy document'});
  await expect(dialog).toContainText('Nothing will be copied until you confirm');
  await expect(dialog.getByRole('textbox',{name:'New document name'})).toHaveValue('Smith Residence · Copy');
  await dialog.getByRole('textbox',{name:'New document name'}).fill('Smith Residence Revision Candidate');
  // No new quote exists yet: title in current editor remains unchanged.
  await expect(title).toHaveValue('Smith Residence');
  await dialog.getByRole('button',{name:'Cancel'}).click();
  await expect(title).toHaveValue('Smith Residence');
  const optionsAgain=await openOptions(page);
  await optionsAgain.getByRole('button',{name:/Make independent copy/}).click();
  const confirm=page.getByRole('dialog',{name:'Copy document'});
  await confirm.getByRole('textbox',{name:'New document name'}).fill('Smith Residence Copy A');
  await confirm.getByRole('button',{name:'Create independent copy'}).click();
  await expect(title).toHaveValue('Smith Residence Copy A');
  await expect(beta.locator('.qmb-document-origin')).toContainText('Independent working copy');
  await beta.locator('.qmb-pagehead .qmb-back').click();
  await expect(beta.getByRole('heading',{name:'Sales Documents'})).toBeVisible();
  await expect(beta.locator('.qmb-listcard').filter({hasText:'Smith Residence'})).toHaveCount(2);
  await beta.locator('.qmb-listcard').filter({hasText:'Smith Residence Copy A'}).click();
  await page.reload();
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toHaveValue('Smith Residence Copy A');
  expect(errors).toEqual([]);
});
test('desktop document options appear beside Undo/Redo, with typed delete safeguard',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Focused desktop document QC');
  const beta=await library(page);
  await newTemplate(page,'Builder Rate Schedule','Builder Levels 2027');
  const rail=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  const toolbar=rail.getByRole('toolbar',{name:'Quote history controls'});
  await expect(toolbar.getByRole('button',{name:'Undo quote change'})).toBeVisible();
  await expect(toolbar.getByRole('button',{name:'Redo quote change'})).toBeVisible();
  await expect(toolbar.getByRole('button',{name:'Document options'})).toBeVisible();
  await expect(beta.getByRole('button',{name:'View customer document'})).toHaveCount(0);
  await toolbar.getByRole('button',{name:'Document options'}).click();
  await toolbar.getByRole('button',{name:/Delete draft/}).click();
  const dialog=page.getByRole('dialog',{name:'Delete draft quote'});
  await expect(dialog.getByRole('button',{name:'Permanently delete draft'})).toBeDisabled();
  await dialog.getByRole('textbox',{name:'Type DELETE to confirm'}).fill('DELET');
  await expect(dialog.getByRole('button',{name:'Permanently delete draft'})).toBeDisabled();
  await dialog.getByRole('button',{name:'Keep quote'}).click();
  await expect(beta.getByRole('region',{name:'Builder Rate Schedule editor'})).toBeVisible();
  await rail.getByRole('button',{name:'Customer preview'}).click();
  await expect(beta.locator('.pricing-schedule-customer-preview')).toBeVisible();
  await rail.getByRole('button',{name:/Edit Builder Rate Schedule/}).click();
  await expect(beta.getByRole('region',{name:'Builder Rate Schedule editor'})).toBeVisible();
});
test('dark Community Plan Pricing panels follow theme; inspector status cards cannot overlap',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Focused desktop dark theme QC');
  const beta=await library(page);
  await page.evaluate(()=>document.documentElement.setAttribute('data-sales-theme','dark'));
  await newTemplate(page,'Community Plan Pricing','Oakwood Community Plan');
  const editor=beta.getByRole('region',{name:'Community Plan Pricing editor'});
  await expect(editor).toBeVisible();
  const panel=editor.locator('.pricing-builder-workflow');
  const input=editor.locator('.pricing-builder-name-field input').first();
  await expect(panel).toBeVisible();
  const colors=await panel.evaluate(el=>{
    const c=getComputedStyle(el);
    return {background:c.backgroundColor,color:c.color};
  });
  expect(colors.background).not.toBe('rgb(255, 255, 255)');
  const inputColors=await input.evaluate(el=>({background:getComputedStyle(el).backgroundColor,
    color:getComputedStyle(el).color}));
  expect(inputColors.background).not.toBe('rgb(255, 255, 255)');
  const inspector=beta.getByRole('complementary',{name:'Live quote summary'});
  const statuses=inspector.locator('.qmb-desktop-stat-grid>div');
  await expect(statuses).toHaveCount(2);
  const boxes=await statuses.evaluateAll(nodes=>nodes.map(n=>{
    const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};
  }));
  expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].y+boxes[0].h-1);
  expect(boxes.every(b=>b.w>120)).toBe(true);
});
