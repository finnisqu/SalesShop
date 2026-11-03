import {test,expect} from '@playwright/test';

// Local-only CRM and Calendar acceptance: never accesses production accounts.
for(const device of ['phone-390','desktop-1280']){
 test('logged interaction appears in the shared Calendar and opens full Activity notes — '+device,
  async({page},info)=>{
   test.skip(info.project.name!==device,'Representative phone and desktop');
   await page.goto('/home');
   await expect(page.getByRole('heading',{name:'Today',exact:true})).toBeVisible();
   await page.locator('.sales-home-shortcut-grid')
    .getByRole('button',{name:/Log Activity/}).click();
   const log=page.getByRole('dialog',{name:'Log Activity'});
   await expect(log).toBeVisible();
   await log.getByRole('button',{name:'Email'}).click();
   await log.getByRole('textbox',{name:/Summary/}).fill('Calendar acceptance interaction');
   await log.getByRole('textbox',{name:/Notes/}).fill('Customer asked for revised sink drawings.');
   await log.getByRole('button',{name:'Save activity'}).click();
   await expect(log).toHaveCount(0);
   await expect(page.getByText('Activity recorded on this device')).toBeVisible();
   await page.getByRole('button',{name:'Dismiss follow-up suggestion'}).click();

   await page.locator('.sales-home-shortcut-grid')
    .getByRole('button',{name:/Calendar/}).click();
   const calendar=page.getByRole('dialog',{name:'SalesShop calendar'});
   await expect(calendar).toBeVisible();
   await calendar.locator('.sales-calendar-day.is-today').click();
   await expect(calendar.getByText('Calendar acceptance interaction')).toBeVisible();
   await calendar.getByRole('button',{name:/Calendar acceptance interaction/}).click();
   const detail=page.getByRole('dialog',{name:'Activity details'});
   await expect(detail).toContainText('Customer asked for revised sink drawings.');
   await expect(detail).toContainText('email');
   await detail.getByRole('button',{name:'Done'}).click();
   await expect(detail).toHaveCount(0);
 });
}
