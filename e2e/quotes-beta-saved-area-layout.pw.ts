import {test,expect} from '@playwright/test';

test('an Area layout can be saved and reused without carrying over pricing',async({page},info)=>{
 test.skip(info.project.name!=='phone-390','Focused local-demo phone journey');
 await page.goto('/');
 await page.evaluate(()=>{
  localStorage.setItem('salesshop-active-view-v1','quotes');
  localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
 });
 await page.reload();
 const beta=page.getByRole('main',{name:'Quotes mobile beta'});
 await beta.getByRole('button',{name:/^\+ New(?: document)?$/}).first().click();
 const create=page.getByRole('dialog',{name:'New Sales Document'});
 await create.getByRole('button',{name:/^Quick Quote/}).click();
 await create.getByRole('textbox',{name:'Quote name'}).fill('Saved layout smoke');
 await create.getByRole('button',{name:/Create document/}).click();
 await beta.getByRole('button',{name:'Choose an Area layout ›'}).click();
 await page.getByRole('dialog',{name:'Choose Area starting layout'})
  .getByRole('button',{name:/^Kitchen/}).click();
 const length=beta.getByRole('textbox',{name:'Length (in)'}).first();
 await length.fill('96');await length.press('Tab');
 await beta.getByRole('button',{name:'Save layout',exact:true}).click();
 const save=page.getByRole('dialog',{name:'Save reusable Area layout'});
 await save.getByRole('textbox',{name:'Layout name'}).fill('Standard 96 inch kitchen');
 await save.getByRole('button',{name:'Save layout'}).click();
 await expect(save).toHaveCount(0);
 await page.reload();
 // The editor restores the saved Area first; return to its quote for the gallery.
 if(await beta.getByRole('button',{name:'‹ Quote'}).count())
   await beta.getByRole('button',{name:'‹ Quote'}).click();
 await beta.getByRole('button',{name:'Area layouts'}).click();
 const picker=page.getByRole('dialog',{name:'Choose Area starting layout'});
 await expect(picker).toContainText('Standard 96 inch kitchen');
 await picker.getByRole('button',{name:/Standard 96 inch kitchen/}).click();
 await expect(beta.getByRole('textbox',{name:'Area name'})).toHaveValue('Standard 96 inch kitchen');
 await expect(beta.getByRole('textbox',{name:'Piece 1 name'})).toHaveValue('Main run');
 await expect(beta.getByRole('textbox',{name:'Length (in)'}).first()).toHaveValue('96');
 await expect(beta.getByRole('button',{name:'Resolve Area pricing issues'})).toHaveCount(0);
});
