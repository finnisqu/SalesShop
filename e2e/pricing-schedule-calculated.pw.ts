import {test,expect} from '@playwright/test';

async function openBuilder(page:import('@playwright/test').Page){
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New document'}).click();
  await page.getByRole('dialog',{name:'New Sales Document'}).getByRole('button',{name:/Community Plan Pricing/}).click();
  await page.getByRole('dialog',{name:'New Sales Document'}).getByRole('textbox',{name:'Document name'}).fill('QC 6 Document');
  await page.getByRole('dialog',{name:'New Sales Document'}).getByRole('button',{name:/Create document/}).click();
  const workspace=beta.getByRole('region',{name:'Pricing Schedule workspace'});
  return workspace;
}
test('calculate Sanford configurations with shared material rates and replacement vanity takeoffs',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1280','Desktop authoring workflow');
  const ws=await openBuilder(page);
  await ws.getByRole('button',{name:/1 · Rates/}).click();
  await ws.getByRole('button',{name:/Add example.*materials/}).click();
  await expect(ws.getByRole('spinbutton',{name:'Granite per SF'})).toHaveValue('25');
  await ws.getByRole('button',{name:'+ Vanity bowl'}).click();
  await ws.getByRole('spinbutton',{name:'Vanity Sink sell rate'}).fill('70');
  await ws.getByRole('button',{name:'+ Kitchen sink'}).click();
  await ws.getByRole('spinbutton',{name:'Kitchen Sink sell rate'}).fill('200');
  await ws.getByRole('button',{name:/2 · Plan Takeoffs/}).click();
  await ws.getByRole('button',{name:'+ Plan',exact:true}).click();
  await ws.getByRole('textbox',{name:'Plan name'}).fill('Sanford');
  await ws.getByRole('button',{name:'+ Master Vanity BASE / DOUBLE'}).click();
  const list=ws.locator('.pricing-builder-takeoff-scroller .pricing-builder-takeoff-row:not(.is-head)');
  await expect(list).toHaveCount(2);
  await list.nth(0).locator('input[type=number]').nth(1).fill('22');
  await list.nth(1).locator('input[type=number]').nth(1).fill('22');
  await ws.getByRole('button',{name:'+ Component'}).click();
  await list.nth(2).locator('input[type=number]').nth(2).fill('30');
  await list.nth(2).locator('input[type=number]').nth(3).fill('1');
  await ws.getByRole('button',{name:'+ Splash'}).click();
  await list.nth(3).locator('input[type=number]').nth(2).fill('6');
  await ws.getByRole('button',{name:'+ Component'}).click();
  await list.nth(4).locator('input').nth(0).fill('Hall Bathroom');
  await list.nth(4).locator('input[type=number]').nth(2).fill('12');
  await list.nth(4).locator('input[type=number]').nth(4).fill('1');
  await ws.getByRole('button',{name:/3 · Options & Scope/}).click();
  await ws.getByRole('button',{name:'Create six stone/splash packages'}).click();
  await expect(ws.getByRole('combobox',{name:'B Master Vanity variant'})).toBeVisible();
  await ws.getByRole('combobox',{name:'B Master Vanity variant'}).selectOption('DOUBLE');
  await ws.getByRole('button',{name:/4 · Calculated Matrix/}).click();
  const cells=ws.locator('.pricing-builder-matrix-cell:not(.is-not-offered)');
  await expect(cells).toHaveCount(6);
  await expect(cells.nth(0)).not.toContainText('Review');
  await expect(cells.nth(1)).not.toContainText('Review');
  await cells.nth(1).click();
  await expect(ws.locator('.pricing-builder-audit')).toContainText('Master Bathroom');
  await expect(ws.locator('.pricing-builder-audit')).toContainText('Calculated price');
  await expect(ws.locator('.pricing-builder-mode-indicator')).toContainText('Calculated');
});
test('calculated builder stages stay accessible on mobile',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Mobile navigation QC');
  const ws=await openBuilder(page);
  await expect(ws.getByRole('navigation',{name:'Calculated builder workflow'})).toBeVisible();
  await ws.getByRole('button',{name:/2 · Plan Takeoffs/}).click();
  await expect(ws.getByRole('button',{name:'+ Plan',exact:true})).toBeVisible();
  await ws.getByRole('button',{name:/3 · Options & Scope/}).click();
  await expect(ws.getByRole('button',{name:'+ Option package'})).toBeVisible();
  await expect(ws.locator('.pricing-builder-workflow')).toBeVisible();
});
