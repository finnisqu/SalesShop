import { test, expect } from '@playwright/test';

/**
 * This tests the opt-in presentation with the local QC workspace only.
 * No production customer, organization, Auth or Supabase state is ever read.
 */
test('phone Quotes Beta uses the same quote records and returns to Classic', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390', 'Single representative phone viewport for interactive regression');
  const errors: string[] = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await expect(beta).toBeVisible();
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toHaveValue('');
  await expect(beta.getByText('No Areas yet.')).toBeVisible();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  const length=beta.getByRole('textbox',{name:'Length (in)'});
  await length.fill('48');await length.blur();
  const width=beta.getByRole('textbox',{name:'Width (in)'});
  await width.fill('25');await width.blur();
  await expect(beta.getByText('8.33 SF measured')).toBeVisible();
  await beta.getByRole('button',{name:'Pricing'}).click();
  await beta.getByRole('spinbutton',{name:'Takeoff selling rate per square foot'}).fill('50');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await expect(beta.getByText('$416.50').first()).toBeVisible();
  await beta.getByRole('button',{name:'Preview'}).click();
  await expect(beta.locator('.qmb-preview')).toBeVisible();
  await beta.getByRole('button',{name:'Classic',exact:true}).click();
  await expect(page.locator('.quotes-workbench')).toBeVisible();
  await expect(page.locator('.qmb')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('salesshop:quotes-mobile-beta-v1'))).toBe('0');
  expect(errors).toEqual([]);
});

test('Quotes Beta never replaces desktop Quotes, even when opted in', async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1280','Desktop fallback contract');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  await expect(page.locator('.quotes-workbench')).toBeVisible();
  await expect(page.locator('.qmb')).toHaveCount(0);
});


test('Area takeoff grid keeps tabs visible and splash popover updates billable SF',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Targeted interactive mobile spreadsheet test');
  const pageErrors:string[]=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Piece 1 name'}).fill('Island');
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('72');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('24');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  await expect(beta.locator('.qmb-grid-sf-pill')).toContainText('12');
  await beta.getByRole('button',{name:'Splash options for Piece 1'}).click();
  const popover=page.getByRole('dialog',{name:'Splash options for Piece 1'});
  await expect(popover).toBeVisible();
  await popover.getByRole('checkbox',{name:'Back'}).check();
  await popover.getByRole('checkbox',{name:'Left'}).check();
  await expect(beta.locator('.qmb-grid-sf-pill')).toContainText('14.67');
  await popover.getByRole('button',{name:'Done'}).click();
  await expect(beta.getByRole('button',{name:'Splash options for Piece 1'})).toContainText('B·L');
  await beta.getByRole('button',{name:'Materials'}).click();
  await beta.getByRole('button',{name:'Measure'}).click();
  await expect(beta.getByRole('textbox',{name:'Piece 1 name'})).toHaveValue('Island');
  await expect(beta.locator('.qmb-grid-sf-pill')).toContainText('14.67');
  for(let i=0;i<12;i++)await beta.getByRole('button',{name:'+ Add piece'}).click();
  const scroll=beta.locator('.qmb-area-scroll');
  await scroll.evaluate(el=>{el.scrollTop=260;});
  const tabs=beta.getByRole('navigation',{name:'Area sections'});
  await expect(tabs).toBeVisible();
  const positions=await page.evaluate(()=>{
    const scroll=document.querySelector('.qmb-area-scroll')!.getBoundingClientRect();
    const tabs=document.querySelector('.qmb-area-editor .qmb-tabs')!.getBoundingClientRect();
    const header=document.querySelector('.qmb-area-editor .qmb-pagehead')!.getBoundingClientRect();
    return {scrollTop:scroll.top,tabsTop:tabs.top,headerBottom:header.bottom};
  });
  expect(Math.abs(positions.tabsTop-positions.scrollTop)).toBeLessThanOrEqual(3);
  expect(positions.headerBottom).toBeLessThanOrEqual(positions.scrollTop+1);
  await expect(beta.locator('.qmb-measure-row')).toHaveCount(13);
  expect(pageErrors).toEqual([]);
});


test('Materials sink rows stay compact and Rate picker pushes content instead of overlapping',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Representative touch-phone geometry');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('48');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('24');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  await beta.getByRole('button',{name:'Materials'}).click();
  await beta.getByRole('button',{name:'+ Add sink'}).click();
  const row=beta.locator('.qmb-sink-line').first();
  await expect(row).toBeVisible();
  const height=await row.evaluate(el=>el.getBoundingClientRect().height);
  expect(height).toBeLessThan(155);
  await row.getByRole('checkbox',{name:'Charge on quote'}).check();
  await expect(row.getByRole('spinbutton',{name:'Sink 1 sell price'})).toBeVisible();
  await beta.getByRole('button',{name:'Pricing'}).click();
  await beta.getByRole('button',{name:/Choose from Rates/}).click();
  const options=beta.locator('.qtl-rate-options');
  await expect(options).toBeVisible();
  const result=await page.evaluate(()=>{
    const options=document.querySelector('.qmb .qtl-rate-options')!.getBoundingClientRect();
    const customer=Array.from(document.querySelectorAll('.qmb .qmb-card'))
      .find(el=>el.textContent?.includes('Customer display'))!.getBoundingClientRect();
    return {optionsBottom:options.bottom,customerTop:customer.top};
  });
  expect(result.optionsBottom).toBeLessThanOrEqual(result.customerTop+2);
});
