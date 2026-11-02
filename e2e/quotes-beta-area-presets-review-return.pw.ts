import {test,expect} from '@playwright/test';

/** Local-demo phone workflow, no production account or real quote data. */
test('Area starter layout creates only unpriced pieces and allows return from Review repairs',
 async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Phone-first starter and Review repair journey');
  await page.goto('/');
  await page.evaluate(()=>{
   localStorage.setItem('salesshop-active-view-v1','quotes');
   localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:/^\+ New(?: document)?$/}).first().click();
  const newDoc=page.getByRole('dialog',{name:'New Sales Document'});
  await newDoc.getByRole('button',{name:/^Quick Quote/}).click();
  await newDoc.getByRole('textbox',{name:'Quote name'}).fill('Kitchen preset beta smoke');
  await newDoc.getByRole('button',{name:/Create document/}).click();

  await beta.getByRole('button',{name:'Choose an Area layout ›'}).click();
  const picker=page.getByRole('dialog',{name:'Choose Area starting layout'});
  await expect(picker).toBeVisible();
  await picker.getByRole('button',{name:/^Kitchen/}).click();
  await expect(beta.getByRole('textbox',{name:'Area name'})).toHaveValue('Kitchen');
  await expect(beta.getByRole('textbox',{name:'Piece 1 name'})).toHaveValue('Main run');
  await expect(beta.getByRole('textbox',{name:'Piece 2 name'})).toHaveValue('Additional run');
  await expect(beta.getByRole('textbox',{name:'Length (in)'}).first()).toHaveValue('');
  await expect(beta.getByRole('button',{name:'Resolve Area pricing issues'})).toHaveCount(0);

  await beta.getByRole('button',{name:'Review quote from Area'}).click();
  const review=page.getByRole('dialog',{name:'Review and issue quote'});
  await expect(review).toBeVisible();
  await review.getByRole('button',{name:'Go to No priced work yet'}).click();
  await expect(beta.getByRole('button',{name:'Return to Review ›'})).toBeVisible();
  await beta.getByRole('button',{name:'Return to Review ›'}).click();
  await expect(review).toBeVisible();
  await expect(review).toContainText('No priced work yet');
 });
