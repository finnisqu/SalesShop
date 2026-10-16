import {test,expect} from '@playwright/test';

/** Runs only against the existing Vite LOCAL demo (no real company credentials). */
test('new vanity quote · title → takeoff + splash → sink → pricing → preview',async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Representative phone creation workflow');
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await expect(beta).toBeVisible();
  await beta.getByRole('button',{name:/^\+ New(?: document)?$/}).first().click();
  const picker=page.getByRole('dialog',{name:'New Sales Document'});
  await picker.getByRole('button',{name:/^Quick Quote/}).click();
  await picker.getByRole('textbox',{name:'Quote name'}).fill('Guest Vanity · Beta QC');
  await picker.getByRole('button',{name:/Create document/}).click();
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toHaveValue('Guest Vanity · Beta QC');

  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Guest vanity');
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('48');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('22');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  await beta.getByRole('button',{name:'Splash options for Piece 1'}).click();
  const splash=page.getByRole('dialog',{name:'Splash options for Piece 1'});
  await splash.getByRole('checkbox',{name:'Back'}).check();
  await splash.getByRole('button',{name:'Done'}).click();
  await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Pricing'}).click();
  await beta.getByRole('spinbutton',{name:'Takeoff selling rate per square foot'}).fill('55');
  await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Materials'}).click();
  await beta.getByRole('button',{name:'+ Add sink'}).click();
  await beta.getByRole('spinbutton',{name:'Sink 1 sell price'}).fill('95');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await expect(beta.locator('.qmb-quote-total')).toHaveText('$571.85');
  await beta.getByRole('navigation',{name:'Quote views'}).getByRole('button',{name:'Preview',exact:true}).click();
  await expect(beta.locator('.qmb-preview')).toBeVisible();
  await expect(beta.locator('.qmb-preview')).toContainText('Guest vanity');
  expect(errors).toEqual([]);
});
