import { test, expect } from '@playwright/test';

/**
 * This tests the opt-in presentation with the local QC workspace only.
 * No production customer, organization, Auth or Supabase state is ever read.
 */
test('phone Quotes Beta uses the same quote records and returns to Classic', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-390', 'Single representative phone viewport for interactive regression');
  const errors: string[] = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await expect(beta).toBeVisible();
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toHaveValue('');
  await expect(beta.getByText('No Areas yet.')).toBeVisible();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  const length=beta.getByRole('textbox',{name:'Length (in)'});
  await length.fill('48');await length.blur();
  const width=beta.getByRole('textbox',{name:'Width (in)'});
  await width.fill('25');await width.blur();
  await expect(beta.getByText('8.33 SF measured')).toBeVisible();
  await beta.getByRole('button',{name:'Pricing'}).click();
  await beta.getByRole('spinbutton',{name:'Takeoff selling rate per square foot'}).fill('50');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await expect(beta.getByText('$416.50').first()).toBeVisible();
  await beta.getByRole('button',{name:'Preview'}).click();
  await expect(beta.locator('.qmb-preview')).toBeVisible();
  await beta.getByRole('button',{name:'Classic',exact:true}).click();
  await expect(page.locator('.quotes-workbench')).toBeVisible();
  await expect(page.locator('.qmb')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('salesshop:quotes-mobile-beta-v1'))).toBe('0');
  expect(errors).toEqual([]);
});

test('Quotes Beta never replaces desktop Quotes, even when opted in', async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1280','Desktop fallback contract');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  await expect(page.locator('.quotes-workbench')).toBeVisible();
  await expect(page.locator('.qmb')).toHaveCount(0);
});


test('Area takeoff grid keeps tabs visible and splash popover updates billable SF',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Targeted interactive mobile spreadsheet test');
  const pageErrors:string[]=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Piece 1 name'}).fill('Island');
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('72');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('24');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  await expect(beta.locator('.qmb-grid-sf-pill')).toContainText('12');
  await beta.getByRole('button',{name:'Splash options for Piece 1'}).click();
  const popover=page.getByRole('dialog',{name:'Splash options for Piece 1'});
  await expect(popover).toBeVisible();
  await popover.getByRole('checkbox',{name:'Back'}).check();
  await popover.getByRole('checkbox',{name:'Left'}).check();
  await expect(beta.locator('.qmb-grid-sf-pill')).toContainText('14.67');
  await popover.getByRole('button',{name:'Done'}).click();
  await expect(beta.getByRole('button',{name:'Splash options for Piece 1'})).toContainText('B·L');
  await beta.getByRole('button',{name:'Materials'}).click();
  await beta.getByRole('button',{name:'Measure'}).click();
  await expect(beta.getByRole('textbox',{name:'Piece 1 name'})).toHaveValue('Island');
  await expect(beta.locator('.qmb-grid-sf-pill')).toContainText('14.67');
  for(let i=0;i<12;i++)await beta.getByRole('button',{name:'+ Add piece'}).click();
  const scroll=beta.locator('.qmb-area-scroll');
  await scroll.evaluate(el=>{el.scrollTop=260;});
  const tabs=beta.getByRole('navigation',{name:'Area sections'});
  await expect(tabs).toBeVisible();
  const positions=await page.evaluate(()=>{
    const scroll=document.querySelector('.qmb-area-scroll')!.getBoundingClientRect();
    const tabs=document.querySelector('.qmb-area-editor .qmb-tabs')!.getBoundingClientRect();
    const header=document.querySelector('.qmb-area-editor .qmb-pagehead')!.getBoundingClientRect();
    return {scrollTop:scroll.top,tabsTop:tabs.top,headerBottom:header.bottom};
  });
  expect(Math.abs(positions.tabsTop-positions.scrollTop)).toBeLessThanOrEqual(3);
  expect(positions.headerBottom).toBeLessThanOrEqual(positions.scrollTop+1);
  await expect(beta.locator('.qmb-measure-row')).toHaveCount(13);
  expect(pageErrors).toEqual([]);
});


test('Materials sink rows stay compact and Rate picker pushes content instead of overlapping',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Representative touch-phone geometry');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('48');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('24');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  await beta.getByRole('button',{name:'Materials'}).click();
  await beta.getByRole('button',{name:'+ Add sink'}).click();
  const row=beta.locator('.qmb-sink-line').first();
  await expect(row).toBeVisible();
  const height=await row.evaluate(el=>el.getBoundingClientRect().height);
  expect(height).toBeLessThan(155);
  await expect(row.getByRole('checkbox',{name:'Charge on quote'})).toHaveCount(0);
  await expect(row.getByRole('spinbutton',{name:'Sink 1 sell price'})).toBeVisible();
  await beta.getByRole('button',{name:'Pricing'}).click();
  await expect(beta.getByLabel('Selected material cost reference')).toBeVisible();
  await beta.getByRole('button',{name:/Choose from Rates/}).click();
  await expect(beta.getByLabel('Buying cost comparison')).toBeVisible();
  const options=beta.locator('.qtl-rate-options');
  await expect(options).toBeVisible();
  const result=await page.evaluate(()=>{
    const options=document.querySelector('.qmb .qtl-rate-options')!.getBoundingClientRect();
    const customer=Array.from(document.querySelectorAll('.qmb .qmb-card'))
      .find(el=>el.textContent?.includes('Customer display'))!.getBoundingClientRect();
    return {optionsBottom:options.bottom,customerTop:customer.top};
  });
  expect(result.optionsBottom).toBeLessThanOrEqual(result.customerTop+2);
});


test('mobile quote fabrication options persist while zero quantity stays editable',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Run mobile fabrication regression on phone');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  const qty=beta.getByRole('textbox',{name:'Piece 1 quantity'});
  await qty.fill('');
  await qty.blur();
  await expect(qty).toHaveValue('0');
  await qty.fill('2');
  await qty.blur();
  await expect(qty).toHaveValue('2');
  await beta.getByRole('button',{name:'Area fabrication defaults'}).click();
  const defaults=page.getByRole('dialog',{name:'Area fabrication defaults'});
  await defaults.getByRole('spinbutton',{name:'Default backsplash height (in)'}).fill('6');
  await defaults.getByRole('combobox',{name:'Default edge profile'}).selectOption('Eased');
  await defaults.getByRole('button',{name:'Apply all'}).click();
  await beta.getByRole('button',{name:'Actions for Piece 1'}).click();
  const piece=page.getByRole('dialog',{name:'Actions for Piece 1'});
  await expect(piece.getByRole('spinbutton',{name:'Piece 1 backsplash height (in)'})).toHaveValue('6');
  await expect(piece.getByRole('combobox',{name:'Piece 1 edge profile'})).toHaveValue('Eased');
  await piece.getByRole('combobox',{name:'Piece 1 edge profile'}).selectOption('Flat');
  await page.keyboard.press('Escape');
  await beta.getByRole('button',{name:'Materials'}).click();
  await beta.getByRole('button',{name:'+ Add sink'}).click();
  await beta.getByRole('spinbutton',{name:'Sink 1 sell price'}).fill('220');
  await beta.getByRole('button',{name:'Faucet holes for Sink 1'}).click();
  const holes=page.getByRole('dialog',{name:'Faucet holes for Sink 1'});
  await expect(holes.getByRole('checkbox',{name:'Center hole'})).toBeChecked();
  await holes.getByRole('button',{name:'4″ spread'}).click();
  await expect(holes.getByRole('checkbox',{name:'2 inches left'})).toBeChecked();
  await expect(holes.getByRole('checkbox',{name:'2 inches right'})).toBeChecked();
  await holes.getByRole('button',{name:'Done'}).click();
  await beta.getByRole('button',{name:'Pricing'}).click();
  await expect(beta.getByText('Sink ·', {exact:false}).first()).toBeVisible();
  await beta.getByRole('button',{name:'Materials'}).click();
  await beta.getByRole('button',{name:'Faucet holes for Sink 1'}).click();
  const persisted=page.getByRole('dialog',{name:'Faucet holes for Sink 1'});
  await expect(persisted.getByRole('checkbox',{name:'2 inches left'})).toBeChecked();
});


test('mobile quote scroll retains title, total and tabs while hiding larger heading', async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Mobile quote chrome contract');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const sticky=beta.locator('.qmb-quote-sticky');
  await expect(sticky.getByRole('textbox',{name:'Quote title'})).toBeVisible();
  await expect(sticky.getByRole('navigation',{name:'Quote views'})).toBeVisible();
  await expect(sticky.getByLabel('Current quote total')).toBeVisible();
  await expect(beta.getByText('Current quote total',{exact:true})).toHaveCount(0);
  await beta.getByRole('button',{name:'Open quote selections'}).click();
  const selections=beta.getByRole('dialog',{name:'Quote selections'});
  await selections.getByRole('button',{name:'+ Add material'}).click();
  await expect(selections.getByRole('textbox',{name:'Material to pin'})).toBeVisible();
  await expect(selections.getByRole('spinbutton',{name:'Job backsplash height in inches'})).toHaveValue('4');
  await expect(selections.getByRole('combobox',{name:'Job default edge profile'})).toHaveValue('Flat');
  await selections.locator('.qmb-selections-foot').getByRole('button',{name:'Done'}).click();
  const scroll=beta.locator('.qmb-quote-scroll');
  // Enough content to prove the heading moves away and identity remains sticky.
  for(let i=0;i<8;i++){
    await beta.getByRole('button',{name:'+ Add Area'}).click();
    await beta.getByRole('button',{name:/Done · Quote/}).click();
  }
  await scroll.evaluate(el=>{el.scrollTop=170;});
  await expect(sticky).toBeInViewport();
  const layout=await page.evaluate(()=>{
    const scrolling=document.querySelector('.qmb-quote-scroll')!.getBoundingClientRect();
    const sticky=document.querySelector('.qmb-quote-sticky')!.getBoundingClientRect();
    const head=document.querySelector('.qmb-quote-editor .qmb-pagehead')!.getBoundingClientRect();
    return {top:scrolling.top,stickyTop:sticky.top,headBottom:head.bottom};
  });
  expect(Math.abs(layout.top-layout.stickyTop)).toBeLessThanOrEqual(2);
  expect(layout.headBottom).toBeLessThanOrEqual(layout.top+1);
});

test('mobile Accounts has a complete stage picker below the persistent app nav',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Mobile Accounts header contract');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','board');
    sessionStorage.setItem('salesshop-board-mode-v1','accounts');
  });
  await page.reload();
  const board=page.locator('.accounts-view');
  await expect(board).toBeVisible();
  const picker=board.locator('.mobile-board-stage-picker');
  await expect(picker).toBeVisible();
  await expect(board.locator('.accounts-header-panel')).toBeHidden();
  const positions=await page.evaluate(()=>{
    const nav=document.querySelector('.mobile-app-commandbar')!.getBoundingClientRect();
    const picker=document.querySelector('.accounts-view .mobile-board-stage-picker')!.getBoundingClientRect();
    return {navBottom:nav.bottom,pickerTop:picker.top};
  });
  expect(positions.pickerTop).toBeGreaterThanOrEqual(positions.navBottom-2);
  await expect(picker.getByRole('button',{name:'Open CRM cleanup'})).toBeVisible();
});


test('mobile Quote RATE picker shows Stock Builder Level 0–8 and records selected SF price',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Phone material-level chooser contract');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('48');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('24');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  await beta.getByRole('button',{name:'Pricing'}).click();
  await beta.getByRole('button',{name:/Choose from Rates/}).click();
  const levels=beta.getByRole('group',{name:'Stock Builder pricing levels'});
  await expect(levels.getByRole('button')).toHaveCount(9);
  await levels.getByRole('button',{name:/Level 0.*34\.00\/SF/}).click();
  await expect(beta.getByRole('spinbutton',{name:'Takeoff selling rate per square foot'})).toHaveValue('34');
  await beta.getByRole('button',{name:/Choose from Rates/}).click();
  await levels.getByRole('button',{name:/Level 2.*54\.00\/SF/}).click();
  await expect(beta.getByRole('spinbutton',{name:'Takeoff selling rate per square foot'})).toHaveValue('54');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await expect(beta.getByLabel('Current quote total')).toContainText('$432.00');
});


test('mobile quote Review highlights blockers, deep-links to fixes and never blocks draft edits',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Focused mobile audit navigation');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:/^Review /}).click();
  await expect(beta.getByRole('button',{name:'Go to No priced work yet'})).toBeVisible();
  await expect(beta.getByRole('button',{name:'Resolve pricing issues to issue'})).toBeDisabled();
  await beta.getByRole('button',{name:'Go to No priced work yet'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('48');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('24');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  await beta.getByRole('button',{name:'Pricing'}).click();
  await beta.getByRole('button',{name:/Choose from Rates/}).click();
  await beta.getByRole('group',{name:'Stock Builder pricing levels'})
    .getByRole('button',{name:/Level 1.*44\.00\/SF/}).click();
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await beta.getByRole('button',{name:/Review quote/}).click();
  await expect(beta.getByText('Resolve before issuing',{exact:true})).toHaveCount(0);
  await expect(beta.getByRole('checkbox',{name:/I reviewed the remaining items/})).toBeVisible();
  await expect(beta.getByRole('button',{name:'Review remaining items to issue'})).toBeDisabled();
  await beta.getByRole('checkbox',{name:/I reviewed the remaining items/}).check();
  await expect(beta.getByRole('button',{name:'Issue quote / mark sent'})).toBeEnabled();
  await beta.getByRole('button',{name:/Resolve Material not selected:/}).click();
  await expect(beta.getByRole('region',{name:/Resolve Material not selected:/})).toBeVisible();
  await beta.getByRole('region',{name:/Resolve Material not selected:/})
    .getByRole('button',{name:'Full editor ›'}).click();
  await expect(beta.getByRole('button',{name:'Materials'})).toHaveAttribute('aria-current','page');
});


test('Review resolves customer name and sink price inline without leaving Review',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Mobile quick fix workflow');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:/^Review /}).click();
  await beta.getByRole('button',{name:'Resolve Customer not selected'}).click();
  const customer=beta.getByRole('region',{name:'Resolve Customer not selected'});
  await expect(customer).toBeVisible();
  await customer.getByRole('textbox',{name:'Customer / company'}).fill('Acme Builder');
  await customer.getByRole('button',{name:'Save'}).click();
  await expect(beta.getByRole('button',{name:'Resolve Customer not selected'})).toHaveCount(0);
  await expect(beta.getByRole('button',{name:'Back to draft'})).toBeVisible();
  // Still on Review, and no navigation through Details was required.
  await beta.getByRole('button',{name:'Back to draft'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'Materials'}).click();
  await beta.getByRole('button',{name:'+ Add sink'}).click();
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await beta.getByRole('button',{name:/^Review /}).click();
  await beta.getByRole('button',{name:/Resolve .*needs a selling price/}).click();
  const sink=beta.getByRole('region',{name:/Resolve .*needs a selling price/});
  await sink.getByRole('spinbutton',{name:'Sink selling price / each ($)'}).fill('220');
  await sink.getByRole('button',{name:'Save'}).click();
  await expect(beta.getByRole('button',{name:/Resolve .*needs a selling price/})).toHaveCount(0);
  await expect(beta.getByRole('button',{name:'Back to draft'})).toBeVisible();
});


test('mobile material RATE dropdown never stretches Quantity or overlays following controls',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Regression for reported material line geometry');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('combobox',{name:'General line type'}).selectOption('material');
  await beta.getByRole('button',{name:'+ Add line'}).click();
  const row=beta.locator('.qmb-line').first();
  await row.getByRole('button',{name:'Edit line'}).click();
  const qty=row.getByRole('spinbutton',{name:'Quantity'});
  const before=await qty.evaluate(el=>({height:el.getBoundingClientRect().height,
    top:el.getBoundingClientRect().top}));
  await row.getByRole('button',{name:'Choose rate for material line'}).click();
  await expect(row.getByRole('region',{name:'Available selling rates'})).toBeVisible();
  const levels=row.getByRole('group',{name:'Stock Builder pricing levels'});
  await expect(levels.getByRole('button')).toHaveCount(9);
  const after=await qty.evaluate(el=>({height:el.getBoundingClientRect().height,
    top:el.getBoundingClientRect().top}));
  expect(Math.abs(after.height-before.height)).toBeLessThanOrEqual(3);
  expect(Math.abs(after.top-before.top)).toBeLessThanOrEqual(3);
  const layout=await row.evaluate(el=>{
    const cell=el.querySelector('.qmb-material-rate-cell')!;
    const ratePanel=el.querySelector('.qmb-line-rate-drawer')!.getBoundingClientRect();
    const two=cell.closest('.qmb-two')!.getBoundingClientRect();
    const checkbox=el.querySelector('.qmb-check')!.getBoundingClientRect();
    return {panelTop:ratePanel.top,inputsBottom:two.bottom,
      panelBottom:ratePanel.bottom,checkboxTop:checkbox.top,
      panelHeight:ratePanel.height};
  });
  expect(layout.panelTop).toBeGreaterThanOrEqual(layout.inputsBottom-2);
  expect(layout.checkboxTop).toBeGreaterThanOrEqual(layout.panelBottom-2);
  expect(layout.panelHeight).toBeLessThanOrEqual(405);
  await levels.getByRole('button',{name:/Level 2.*54\.00\/SF/}).click();
  await expect(row.getByRole('spinbutton',{name:'Sell rate ($/SF)'})).toHaveValue('54');
  await expect(row.locator('.qmb-line-rate-drawer')).toHaveCount(0);
});

test('Review missing material rate offers same Builder Levels and other SF rates inline',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Rate quick-fix regression');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('combobox',{name:'General line type'}).selectOption('material');
  await beta.getByRole('button',{name:'+ Add line'}).click();
  const row=beta.locator('.qmb-line').first();
  await row.getByRole('button',{name:'Edit line'}).click();
  await row.getByRole('spinbutton',{name:'Quantity'}).fill('8');
  await beta.getByRole('button',{name:/^Review /}).click();
  await beta.getByRole('button',{name:/Resolve Missing sell rate/}).click();
  const editor=beta.getByRole('region',{name:/Resolve Missing sell rate/});
  await editor.getByRole('button',{name:'Choose from Rates in Review'}).click();
  const choices=editor.getByRole('region',{name:'Available selling rates'});
  await expect(choices).toBeVisible();
  const levels=choices.getByRole('group',{name:'Stock Builder pricing levels'});
  await expect(levels.getByRole('button')).toHaveCount(9);
  await expect(choices.getByText('Other SF rates')).toBeVisible();
  await levels.getByRole('button',{name:/Level 2.*54\.00\/SF/}).click();
  await expect(beta.getByRole('button',{name:/Resolve Missing sell rate/})).toHaveCount(0);
  await expect(beta.getByRole('button',{name:'Back to draft'})).toBeVisible();
});
