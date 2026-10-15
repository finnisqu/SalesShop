import {test,expect} from '@playwright/test';

test('Beta desktop selling rate can be cleared; Review flags missing price rather than stale total',
  async({page},info)=>{
    test.skip(info.project.name!=='desktop-1280','Focused desktop Area pricing regression');
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
    await picker.getByRole('textbox',{name:'Quote name'}).fill('Blank selling rate QC');
    await picker.getByRole('button',{name:/Create document/}).click();
    await beta.getByRole('button',{name:'+ Add Area'}).click();
    await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen');
    await beta.getByRole('button',{name:'+ Add piece'}).click();
    await beta.getByRole('textbox',{name:'Length (in)'}).fill('48');
    await beta.getByRole('textbox',{name:'Length (in)'}).blur();
    await beta.getByRole('textbox',{name:'Width (in)'}).fill('24');
    await beta.getByRole('textbox',{name:'Width (in)'}).blur();
    await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Materials'}).click();
    const rate=beta.locator('.qmb-lab-selling').getByRole('spinbutton',{name:'Area selling rate per SF'});
    await rate.fill('55');
    await expect(beta.locator('.qmb-desktop-grand-total')).toContainText('$440.00');
    await rate.fill('');
    await expect(rate).toHaveValue('');
    await beta.getByRole('button',{name:'Review quote from Area'}).click();
    const review=page.getByRole('dialog',{name:'Review and issue quote'});
    await expect(review).toContainText('Missing sell rate');
    await expect(review.getByRole('button',{name:'Resolve pricing issues to issue'})).toBeDisabled();
  });
