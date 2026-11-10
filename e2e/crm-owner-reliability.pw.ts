import {test,expect,type Page} from '@playwright/test';

/** Local-only browser regression: never signs in to or mutates production.
 * Real team assignment requires a signed-in manual run (see QA checklist).
 */
const targets=(name:string)=>['phone-320','phone-390','desktop-1280'].includes(name);
async function createCompany(page:Page,name:string){
 await page.goto('/connections');
 await page.getByRole('button',{name:'+ Company'}).click();
 const dialog=page.locator('.connections-create-dialog');
 await dialog.getByRole('textbox',{name:'Company name'}).fill(name);
 await dialog.getByRole('button',{name:'Save & open'}).click();
 await expect(page).toHaveURL(/\/connections\/companies\/company_/);
}
async function selectTab(page:Page,tab:'people'|'suppliers'){
 await page.goto('/connections');
 await page.evaluate(value=>sessionStorage.setItem('salesshop-connections-tab-v1',value),tab);
 await page.reload();
}
test('Company owner row stays compact and noneditable in local demo on phone and desktop',
 async ({page},info)=>{
  test.skip(!targets(info.project.name),'Targeted local Connections reliability browser QC');
  const name='Ownership QC '+Date.now();
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await createCompany(page,name);
  const owner=page.locator('.connections-record-property.crm-owner-control');
  await expect(owner).toBeVisible();
  await expect(owner).toContainText('You · local workspace');
  await expect(owner.getByRole('button',{name:'Change'})).toHaveCount(0);
  await page.getByRole('button',{name:'Edit company'}).click();
  await expect(page.getByRole('textbox',{name:'Company name'})).toBeVisible();
  await page.getByRole('button',{name:'Save changes'}).click();
  await expect(owner).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
  await info.attach('company-owner-'+info.project.name,{
   body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
 });
test('Person owner row and record editing remain accessible without an extra sheet',
 async ({page},info)=>{
  test.skip(!targets(info.project.name),'Targeted local People reliability browser QC');
  await selectTab(page,'people');
  await expect(page.getByRole('button',{name:'+ Person'})).toBeVisible();
  await page.getByRole('button',{name:'+ Person'}).click();
  const dialog=page.locator('.connections-create-dialog');
  await dialog.getByRole('textbox',{name:'Name'}).fill('Owner QC Contact '+Date.now());
  await dialog.getByRole('button',{name:'Add person'}).click();
  await expect(page).toHaveURL(/\/connections\/people\/contact_/);
  const owner=page.locator('.connections-record-property.crm-owner-control');
  await expect(owner).toContainText('You · local workspace');
  await expect(owner.getByRole('button',{name:'Change'})).toHaveCount(0);
  await page.getByRole('button',{name:'Edit person'}).click();
  await page.getByRole('textbox',{name:'Job title'}).fill('Estimator');
  await page.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByText('Estimator',{exact:true}).first()).toBeVisible();
  await info.attach('person-owner-'+info.project.name,{
   body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
 });
test('Suppliers directory has visible content rather than a blank header on phone',
 async ({page},info)=>{
  test.skip(!targets(info.project.name),'Targeted local Suppliers reliability browser QC');
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await selectTab(page,'suppliers');
  await expect(page.locator('.supplier-directory-page')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Connections'})).toBeVisible();
  if(info.project.name.startsWith('phone')){
   await expect(page.locator('.supplier-mobile-directory-list')).toBeVisible();
  }else{
   await expect(page.locator('.connections-suppliers-host .connections-grid-shell')).toBeVisible();
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
  await info.attach('suppliers-'+info.project.name,{
   body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
 });
