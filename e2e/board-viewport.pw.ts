import {test,expect,type Page} from '@playwright/test';

// A missing or zero-sized Board is a release blocker, even when build and
// navigation pass. These checks use only Vite's disposable local QC store.
async function board(page:Page) {
 await page.goto('/board');
 await expect(page.locator('.sales-app.view-board')).toBeVisible();
 await expect(page.locator('.board-view')).toBeVisible();
 await expect(page.locator('.project-board')).toBeVisible();
}

async function hasUsableBoardViewport(page:Page,label:string) {
 const dimensions=await page.locator('.board-view').evaluate(element=>{
  const view=element.getBoundingClientRect();
  const stage=element.querySelector('.project-board')?.getBoundingClientRect();
  const column=element.querySelector('.board-column')?.getBoundingClientRect();
  const stack=element.querySelector('.board-card-stack')?.getBoundingClientRect();
  return {
   viewHeight:view.height,stageHeight:stage?.height??0,
   columnHeight:column?.height??0,stackHeight:stack?.height??0,
   viewWidth:view.width,
  };
 });
 expect(dimensions.viewWidth,label+' view width').toBeGreaterThan(300);
 expect(dimensions.viewHeight,label+' view must not collapse').toBeGreaterThan(210);
 expect(dimensions.stageHeight,label+' stage rail must be visible').toBeGreaterThan(120);
 expect(dimensions.columnHeight,label+' stage background must be visible').toBeGreaterThan(120);
 expect(dimensions.stackHeight,label+' card list must be visible').toBeGreaterThan(30);
}

test('Deals and Accounts both render visible, nonzero-height boards',async({page})=>{
 await board(page);
 await hasUsableBoardViewport(page,'Deals');
 await page.getByRole('button',{name:'Accounts',exact:true}).click();
 await expect(page.locator('.accounts-view')).toBeVisible();
 await hasUsableBoardViewport(page,'Accounts');
 // Phone deliberately hides the desktop Board type toggle. It lives inside
 // the app's navigation drawer; exercise that real user path instead.
 if((page.viewportSize()?.width??0)<=700){
  await page.getByRole('button',{name:'Open SalesShop navigation'}).click();
  const drawer=page.getByRole('dialog',{name:'SalesShop navigation'});
  await expect(drawer).toBeVisible();
  await drawer.locator('.mobile-board-mode-list')
   .getByRole('button',{name:/^Deals/}).click();
 }else{
  await page.getByRole('button',{name:'Deals',exact:true}).click();
 }
 await hasUsableBoardViewport(page,'Deals after switch');
});

test('Board name-only create is an in-place sheet, not a navigation action',async({page})=>{
 await board(page);
 await page.getByRole('button',{name:'+ Deal'}).click();
 const dialog=page.getByRole('dialog',{name:'Quick create deal'});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('textbox',{name:'Deal name'})).toBeVisible();
 await dialog.getByRole('button',{name:'Cancel'}).click();
 await expect(page.locator('.board-view')).toBeVisible();
 await expect(page).toHaveURL(/\/board/);
});
