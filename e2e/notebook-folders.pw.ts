import { test, expect } from '@playwright/test';

test('private Notebook nested folders survive reload and never delete their pages', async ({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Focused folder safety regression');
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('salesshop-active-view-v1','notebook'));
  await page.reload();
  await expect(page.locator('.sales-app.view-notebook')).toBeVisible();
  const folders=page.getByRole('region',{name:'Notebook folders'});
  await expect(folders).toBeVisible();
  page.once('dialog',dialog=>dialog.accept('Test project folder'));
  await folders.getByTitle('New folder').click();
  const folder=folders.getByRole('button',{name:/Test project folder/});
  await expect(folder).toBeVisible();
  await expect(folder).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'New page'}).click();
  const newPage=page.locator('.page-tab').filter({hasText:'Untitled page'}).first();
  await expect(newPage).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region',{name:'Notebook folders'}).getByRole('button',{name:/Test project folder/})).toBeVisible();
  await expect(page.locator('.paper-sheet')).toBeVisible();

  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Remove Test project folder'}).click();
  await expect(page.getByRole('region',{name:'Notebook folders'}).getByRole('button',{name:/Test project folder/})).toHaveCount(0);
  await expect(page.locator('.paper-sheet')).toBeVisible();
  await expect(page.locator('.page-tab')).not.toHaveCount(0);
});
