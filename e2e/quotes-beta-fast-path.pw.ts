import {test,expect} from '@playwright/test';

test('Beta customer and Deal details advance directly to an Area and its Review, without auto-issuing',async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Focused fast-path phone journey');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:/^\+ New(?: document)?$/}).first().click();
  const picker=page.getByRole('dialog',{name:'New Sales Document'});
  await picker.getByRole('button',{name:/^Quick Quote/}).click();
  await picker.getByRole('textbox',{name:'Quote name'}).fill('Fast path test');
  await picker.getByRole('button',{name:/Create document/}).click();
  await beta.locator('.qmb-quote-sticky').getByRole('button',{name:'Details'}).click();
  await expect(beta.getByRole('region',{name:'Quote customer and deal details'})).toBeVisible();

  // Explicit action creates exactly one Area; merely opening Details never does.
  await expect(beta.getByRole('button',{name:'+ Start first Area ›'})).toBeVisible();
  await expect(beta.getByRole('button',{name:'+ Add Area'})).toHaveCount(0);
  await beta.getByRole('button',{name:'+ Start first Area ›'}).click();
  await expect(beta.getByRole('textbox',{name:'Area name'})).toBeVisible();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen');
  await beta.getByRole('button',{name:'Review quote from Area'}).click();
  await expect(page.getByRole('dialog',{name:'Review and issue quote'})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Review and issue quote'})).toContainText('No priced work yet');
  await page.getByRole('dialog',{name:'Review and issue quote'}).getByRole('button',{name:'Close Review and Issue'}).click();

  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await beta.locator('.qmb-quote-sticky').getByRole('button',{name:'Details'}).click();
  await expect(beta.getByRole('button',{name:'Continue to Kitchen ›'})).toBeVisible();
  await beta.getByRole('button',{name:'Continue to Kitchen ›'}).click();
  await expect(beta.getByRole('textbox',{name:'Area name'})).toHaveValue('Kitchen');
  await expect(beta.locator('.qmb-desktop-frame.is-library')).toHaveCount(0);
});
