import {test,expect,type Page} from '@playwright/test';

// Explicit local demo only. This spec uses no cloud credentials or customer data.
const targeted=(name:string)=>['phone-390','desktop-1280'].includes(name);
async function home(page:Page){
  await page.goto('/home');
  await expect(page.locator('.sales-app.view-home')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Today',exact:true})).toBeVisible();
}

test('HOME named quote opens Beta editor, supports mobile/desktop Back and resumes recent work',
  async({page},info)=>{
    test.skip(!targeted(info.project.name),'Dedicated HOME journey QC');
    await page.goto('/');
    await page.evaluate(()=>{
      localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
      localStorage.setItem('salesshop-active-view-v1','home');
    });
    await home(page);

    await page.locator('.sales-home').getByRole('button',{name:'New Quote'}).click();
    const dialog=page.getByRole('dialog',{name:'Name your new quote'});
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox',{name:'Quote name'}).fill('Batch 16G test quote');
    await dialog.getByRole('button',{name:'Create Quote'}).click();

    await expect(page).toHaveURL(/\/quotes\/quote_/);
    await expect(page.locator('.sales-app.view-quotes')).toBeVisible();
    await expect(page.locator('.qmb-desktop-frame.is-library')).toHaveCount(0);
    await expect(page.getByText('Batch 16G test quote').first()).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('.sales-home-recent')).toContainText('Batch 16G test quote');
    await page.locator('.sales-home-recent').getByRole('button',{name:/Batch 16G test quote/}).click();
    await expect(page).toHaveURL(/\/quotes\/quote_/);
    await expect(page.locator('.qmb-desktop-frame.is-library')).toHaveCount(0);

    // Library navigation must clear the quote URL, and browser Back should
    // restore the same document (not leave the library on a stale deep link).
    await page.locator('.qmb-quote-editor .qmb-back').click();
    await expect(page).toHaveURL(/\/quotes$/);
    await expect(page.locator('.qmb-desktop-frame.is-library')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/quotes\/quote_/);
    await expect(page.locator('.qmb-desktop-frame.is-library')).toHaveCount(0);

    // Quotes Beta uses its own full-screen navigation, not the ordinary
    // mobile command bar. HOME must still be reachable from within Beta.
    await page.getByRole('button',{name:'Open SalesShop navigation'}).click();
    await page.getByRole('navigation',{name:'SalesShop destinations'}).getByRole('button',{name:'Home'}).click();
    await expect(page.locator('.sales-app.view-home')).toBeVisible();
  });

test('HOME task, floating Quick Note and named deal preserve navigation and record URLs',
  async({page},info)=>{
    test.skip(!targeted(info.project.name),'Dedicated HOME journey QC');
    await home(page);

    await page.getByRole('button',{name:'+ Task'}).click();
    const taskForm=page.locator('.sales-home-task-form');
    await taskForm.getByRole('textbox',{name:'What needs doing?'}).fill('Batch 16G callback');
    await taskForm.getByRole('button',{name:'Add task'}).click();
    await expect(page.getByRole('checkbox',{name:'Complete Batch 16G callback'})).toBeVisible();
    await page.getByRole('button',{name:'Tomorrow'}).click();
    await expect(page.getByRole('checkbox',{name:'Complete Batch 16G callback'})).toHaveCount(0);

    await page.locator('.sales-home').getByRole('button',{name:'Quick Note'}).click();
    const notes=page.getByRole('region',{name:'Private Quick Notes'});
    await expect(notes).toBeVisible();
    await notes.getByRole('textbox',{name:'Private Post-it text'})
      .fill('Batch 16G note persists through navigation');
    await notes.getByRole('button',{name:'Collapse Post-its'}).click();

    await page.getByRole('button',{name:'Quick create'}).click();
    const create=page.getByRole('dialog',{name:'Create in SalesShop'});
    await create.getByRole('button',{name:/New Deal/}).click();
    await create.getByRole('textbox',{name:'Deal name'}).fill('Batch 16G project');
    await create.getByRole('button',{name:'Create & open'}).click();

    await expect(page).toHaveURL(/\/connections\/deals\//);
    await expect(page.getByRole('heading',{name:'Batch 16G project'})).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/home$/);

    await page.getByRole('button',{name:'Quick create'}).click();
    const accountCreate=page.getByRole('dialog',{name:'Create in SalesShop'});
    await accountCreate.getByRole('button',{name:/New Account/}).click();
    await accountCreate.getByRole('textbox',{name:'Account / company name'}).fill('Batch 16G customer');
    await accountCreate.getByRole('button',{name:'Create & open'}).click();
    await expect(page).toHaveURL(/\/connections\/companies\//);
    await expect(page.getByRole('heading',{name:'Batch 16G customer'})).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/home$/);

    const launcher=page.getByRole('button',{name:'Quick Note'});
    await launcher.last().click();
    await expect(page.getByRole('region',{name:'Private Quick Notes'}))
      .toContainText('Batch 16G note persists through navigation');
  });
