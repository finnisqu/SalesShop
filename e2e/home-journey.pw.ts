import {test,expect,type Page} from '@playwright/test';

// Local demo-only smoke tests; do not require CRM credentials or customer data.
const targeted=(name:string)=>['phone-390','desktop-1280'].includes(name);
async function home(page:Page){
 await page.goto('/home');
 await expect(page.locator('.sales-app.view-home')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Today',exact:true})).toBeVisible();
}
async function quickCreate(page:Page){
 await page.locator('.sales-home .quick-create-launcher').click();
 const menu=page.getByRole('dialog',{name:'Create in SalesShop'});
 await expect(menu).toBeVisible();
 return menu;
}

test('HOME Quick Create opens a named Quote and its recent Quote can be reopened',
 async({page},info)=>{
 test.skip(!targeted(info.project.name),'Dedicated HOME journey QC');
 await page.goto('/');
 await page.evaluate(()=>{
  localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  localStorage.setItem('salesshop-active-view-v1','home');
 });
 await home(page);
 const menu=await quickCreate(page);
 await menu.getByRole('button',{name:/New Quote/}).click();
 const picker=page.getByRole('dialog',{name:'New Sales Document'});
 await expect(picker).toBeVisible();
 await picker.getByRole('button',{name:/^Quick Quote/}).click();
 await picker.getByRole('textbox',{name:'Quote name'}).fill('Home journey quote');
 await picker.getByRole('button',{name:/Create document/}).click();
 const editor=page.getByRole('main',{name:'Quotes mobile beta'});
 await expect(page).toHaveURL(/\/quotes\/quote_/);
 await expect(editor.getByRole('textbox',{name:'Quote title'})).toHaveValue('Home journey quote');
 await home(page);
 const sidecar=page.locator('.sales-calendar-sidecar');
 await sidecar.getByRole('tab',{name:'Quotes'}).click();
 await expect(sidecar.getByRole('button',{name:/Home journey quote/})).toBeVisible();
 await sidecar.getByRole('button',{name:/Home journey quote/}).click();
 // First click is intentionally a CRM preview rather than immediate navigation.
 const preview=page.getByRole('dialog',{name:'Quote metadata preview'});
 await expect(preview).toBeVisible();
 await preview.getByRole('button',{name:'Open quote'}).click();
 await expect(page).toHaveURL(/\/quotes\/quote_/);
 await expect(editor.getByRole('textbox',{name:'Quote title'})).toHaveValue('Home journey quote');
 if(info.project.name==='phone-390')
  await page.getByRole('button',{name:'Back to Documents'}).click();
 else
  await editor.getByRole('button',{name:/Documents/}).first().click();
 await expect(editor.getByRole('heading',{name:'Sales Documents'})).toBeVisible();
});

test('HOME Quick Create saves a due Task, daily Notebook note, Deal and Account',
 async({page},info)=>{
 test.skip(!targeted(info.project.name),'Dedicated HOME journey QC');
 await home(page);
 let menu=await quickCreate(page);
 await menu.getByRole('button',{name:/New Task/}).click();
 const task=page.getByRole('dialog',{name:/Edit task/});
 await expect(task).toBeVisible();
 await task.getByRole('textbox',{name:'Task title'}).fill('Home journey callback');
 const today=await page.evaluate(()=>{
  const date=new Date();
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
    String(date.getDate()).padStart(2,'0')].join('-');
 });
 await task.getByLabel('Due date').fill(today);
 await task.getByRole('button',{name:'Save task'}).click();
 await expect(page.locator('.sales-calendar-agenda')
  .getByRole('button',{name:/Home journey callback/})).toBeVisible();

 const sidecar=page.locator('.sales-calendar-sidecar');
 await sidecar.getByRole('tab',{name:'Notes'}).click();
 await sidecar.getByRole('button',{name:'Quick create'}).click();
 await page.getByRole('menu',{name:'Quick create'})
  .getByRole('menuitem',{name:'New Note'}).click();
 const note=page.getByRole('dialog',{name:'Capture daily note'});
 await expect(note).toBeVisible();
 await note.getByRole('textbox',{name:'Add a thought'})
  .fill('Daily Notebook note survives navigation');
 await note.getByRole('button',{name:'Save note'}).click();
 await expect(sidecar).toContainText('Daily Notebook note survives navigation');

 menu=await quickCreate(page);
 await menu.getByRole('button',{name:/New Deal/}).click();
 await menu.getByRole('textbox',{name:'Deal name'}).fill('Home journey deal');
 await menu.getByRole('button',{name:'Create & open'}).click();
 await expect(page).toHaveURL(/\/connections\/deals\//);
 await expect(page.getByRole('heading',{name:'Home journey deal'})).toBeVisible();
 await home(page);
 menu=await quickCreate(page);
 await menu.getByRole('button',{name:/New Account/}).click();
 await menu.getByRole('textbox',{name:'Account / company name'})
  .fill('Home journey customer');
 await menu.getByRole('button',{name:'Create & open'}).click();
 await expect(page).toHaveURL(/\/connections\/companies\//);
 await expect(page.getByRole('heading',{name:'Home journey customer'})).toBeVisible();
});
