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
  // A newly named Quick Quote begins at Details: no extra Build → Details tap.
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

  await beta.getByRole('button',{name:/Done · (Areas|Pricing)/}).click();
  await beta.locator('.qmb-quote-sticky').getByRole('button',{name:'Details'}).click();
  await expect(beta.getByRole('button',{name:'Continue to Kitchen ›'})).toBeVisible();
  await beta.getByRole('button',{name:'Continue to Kitchen ›'}).click();
  // Continue from Details opens the existing Area's full editor directly.
  await expect(beta.getByRole('textbox',{name:'Area name'})).toHaveValue('Kitchen');
  await expect(beta.locator('.qmb-desktop-frame.is-library')).toHaveCount(0);

  // Leaving the last Area can explicitly create another, but returning to the
  // first Area must reopen the existing next Area instead of duplicating it.
  await beta.getByRole('button',{name:'Pricing',exact:true}).click();
  await beta.getByRole('button',{name:'Add another Area'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Bath');
  await beta.getByRole('button',{name:/Done · (Areas|Pricing)/}).click();
  await beta.getByRole('button',{name:'Quick edit Area Kitchen'}).click();
  // Returning from the Quote Builder table uses the new focused drawer.
  const quickArea=page.getByRole('dialog',{name:'Quick edit Area Kitchen'});
  await expect(quickArea).toBeVisible();
  await quickArea.getByRole('button',{name:'Open full Area ↗'}).click();
  await beta.getByRole('button',{name:'Pricing',exact:true}).click();
  await expect(beta.getByRole('button',{name:'Go to next Area: Bath'})).toBeVisible();
  await beta.getByRole('button',{name:'Go to next Area: Bath'}).click();
  await expect(beta.getByRole('textbox',{name:'Area name'})).toHaveValue('Bath');
  await beta.getByRole('button',{name:/Done · (Areas|Pricing)/}).click();
  await expect(beta.locator('.qmb-builder-area-table [data-area-sort-id]')).toHaveCount(2);
});
