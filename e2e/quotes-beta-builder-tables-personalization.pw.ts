import {test,expect} from '@playwright/test';

test('Quote Builder uses dense tables and remembers personal quick-add shortcuts',async({page},info)=>{
 test.skip(info.project.name!=='phone-390','Phone-first personal Quote Builder journey');
 await page.goto('/');
 await page.evaluate(()=>{
   localStorage.setItem('salesshop-active-view-v1','quotes');
   localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
 });
 await page.reload();
 const beta=page.getByRole('main',{name:'Quotes mobile beta'});
 await beta.getByRole('button',{name:/^\+ New(?: document)?$/}).first().click();
 const chooser=page.getByRole('dialog',{name:'New Sales Document'});
 await chooser.getByRole('button',{name:/^Quick Quote/}).click();
 await chooser.getByRole('textbox',{name:'Quote name'}).fill('Dense quote table test');
 await chooser.getByRole('button',{name:/Create document/}).click();
 await beta.getByRole('button',{name:'Start with General charges ›'}).click();
 const general=beta.locator('.qmb-builder-general-table');
 await expect(general).toBeVisible();
 await expect(general.locator('.qmb-builder-general-head')).toContainText('Amount');
 await beta.getByRole('combobox',{name:'Quote Builder row density'}).selectOption('comfortable');
 await expect(general).toHaveClass(/is-comfortable/);
 await beta.getByText('More · My quick adds').click();
 await beta.getByRole('checkbox',{name:'Favorite Note'}).check();
 await beta.getByText('More · My quick adds').click();
 await beta.getByRole('button',{name:'★ Note'}).click();
 await expect(general.locator('.qmb-inline-general-row')).toHaveCount(1);
 await expect(general.locator('.qmb-builder-general-amount')).toContainText(['—']);
 await beta.getByRole('button',{name:'Area layouts'}).click();
 await page.getByRole('dialog',{name:'Choose Area starting layout'})
   .getByRole('button',{name:/^Island/}).click();
 await beta.getByRole('button',{name:'‹ Quote'}).click();
 const areas=beta.locator('.qmb-builder-area-table');
 await expect(areas.locator('.qmb-builder-area-head')).toContainText('Measured');
 await expect(areas.locator('.qmb-inline-area-row')).toHaveCount(1);
 await expect(areas.locator('.qmb-builder-area-value')).toContainText('$0.00');
 await page.reload();
 await expect(beta.getByRole('combobox',{name:'Quote Builder row density'})).toHaveValue('comfortable');
 await expect(beta.getByRole('button',{name:'★ Note'})).toBeVisible();
});
