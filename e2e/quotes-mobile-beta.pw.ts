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
  await expect(beta.locator('.qmb-area-card .qmb-area-price').getByText('$416.50')).toBeVisible();
  await beta.getByRole('button',{name:'Preview'}).click();
  await expect(beta.locator('.qmb-preview')).toBeVisible();
  await beta.getByRole('button',{name:'Classic',exact:true}).click();
  await expect(page.locator('.quotes-workbench')).toBeVisible();
  await expect(page.locator('.qmb')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('salesshop:quotes-mobile-beta-v1'))).toBe('0');
  expect(errors).toEqual([]);
});

test('desktop Quotes Beta is fully opted in and Classic remains selectable', async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1280','Desktop opt-in contract');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await expect(beta).toBeVisible();
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const navigator=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  const inspector=beta.getByRole('complementary',{name:'Live quote summary'});
  await expect(navigator).toBeVisible();
  await expect(inspector).toBeVisible();
  await expect(beta.locator('.qmb-desktop-main')).toBeVisible();
  const geometry=await beta.evaluate(node=>{
    const rail=node.querySelector('.qmb-desktop-navigation')!.getBoundingClientRect();
    const main=node.querySelector('.qmb-desktop-main')!.getBoundingClientRect();
    const inspector=node.querySelector('.qmb-desktop-inspector')!.getBoundingClientRect();
    return {railRight:rail.right,mainLeft:main.left,mainRight:main.right,
      inspectorLeft:inspector.left,mainWidth:main.width,inspectorWidth:inspector.width};
  });
  expect(geometry.mainLeft).toBeGreaterThanOrEqual(geometry.railRight-2);
  expect(geometry.inspectorLeft).toBeGreaterThanOrEqual(geometry.mainRight-2);
  expect(geometry.mainWidth).toBeGreaterThan(650);
  expect(geometry.inspectorWidth).toBeLessThan(300);
  await navigator.getByRole('button',{name:'Add Area from navigator'}).click();
  await expect(beta.getByRole('textbox',{name:'Area name'})).toBeVisible();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen A');
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('48');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('24');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  await inspector.getByRole('navigation',{name:'Area workflow shortcuts'}).getByRole('button',{name:'Materials'}).click();
  const selling=beta.locator('.qmb-lab-selling');
  await expect(selling.getByRole('spinbutton',{name:'Area selling rate per SF'})).toBeVisible();
  await selling.getByRole('spinbutton',{name:'Area selling rate per SF'}).fill('50');
  await expect(inspector.locator('.qmb-desktop-grand-total > strong')).toHaveText('$400.00');
  await navigator.getByRole('button',{name:'Customer & project'}).click();
  await expect(beta.getByRole('region',{name:'Quote customer and project details'})).toBeVisible();
  await inspector.getByRole('button',{name:'Send quote'}).click();
  const review=page.getByRole('dialog',{name:'Review and issue quote'});
  await expect(review.locator('.qmb-audit-finding').first()).toBeVisible();
  await review.getByRole('button',{name:'Close Review and Issue'}).click();
  await navigator.getByRole('button',{name:'Customer preview'}).click();
  await expect(beta.locator('.qmb-preview')).toBeVisible();
  await beta.getByRole('button',{name:'Classic',exact:true}).click();
  await expect(page.locator('.quotes-workbench')).toBeVisible();
  await expect(page.locator('.qmb')).toHaveCount(0);
});

test('Classic Quotes stays available on desktop when Beta is disabled',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1280','Classic desktop fallback');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','0');
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
  expect(height).toBeLessThan(190);
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
  await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Materials'}).click();
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
  await beta.locator('.qmb-quote-footer .qmb-primary').click();
  const review=page.getByRole('dialog',{name:'Review and issue quote'});
  await expect(review.getByRole('button',{name:'Go to No priced work yet'})).toBeVisible();
  await expect(review.getByRole('button',{name:'Resolve pricing issues to issue'})).toBeDisabled();
  await review.getByRole('button',{name:'Go to No priced work yet'}).click();
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
  await beta.locator('.qmb-quote-footer .qmb-primary').click();
  await expect(review.getByText('Resolve before issuing',{exact:true})).toHaveCount(0);
  await expect(review.getByRole('checkbox',{name:/I reviewed the remaining items/})).toBeVisible();
  await expect(review.getByRole('button',{name:'Review remaining items to issue'})).toBeDisabled();
  await review.getByRole('checkbox',{name:/I reviewed the remaining items/}).check();
  await expect(review.getByRole('button',{name:'Issue quote / mark sent'})).toBeEnabled();
  await review.getByRole('button',{name:/Resolve Material not selected:/}).click();
  await expect(review.getByRole('region',{name:/Resolve Material not selected:/})).toBeVisible();
  await review.getByRole('region',{name:/Resolve Material not selected:/})
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
  await beta.locator('.qmb-quote-footer .qmb-primary').click();
  const review=page.getByRole('dialog',{name:'Review and issue quote'});
  await review.getByRole('button',{name:'Resolve Customer not selected'}).click();
  const customer=review.getByRole('region',{name:'Resolve Customer not selected'});
  await expect(customer).toBeVisible();
  await customer.getByRole('textbox',{name:'Customer / company'}).fill('Acme Builder');
  await customer.getByRole('button',{name:'Save'}).click();
  await expect(review.getByRole('button',{name:'Resolve Customer not selected'})).toHaveCount(0);
  await expect(review.getByRole('button',{name:'Close Review and Issue'})).toBeVisible();
  // Still on Review, and no navigation through Details was required.
  await review.getByRole('button',{name:'Close Review and Issue'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('button',{name:'Materials'}).click();
  await beta.getByRole('button',{name:'+ Add sink'}).click();
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await beta.locator('.qmb-quote-footer .qmb-primary').click();
  await review.getByRole('button',{name:/Resolve .*needs a selling price/}).click();
  const sink=review.getByRole('region',{name:/Resolve .*needs a selling price/});
  await sink.getByRole('spinbutton',{name:'Sink selling price / each ($)'}).fill('220');
  await sink.getByRole('button',{name:'Save'}).click();
  await expect(review.getByRole('button',{name:/Resolve .*needs a selling price/})).toHaveCount(0);
  await expect(review.getByRole('button',{name:'Close Review and Issue'})).toBeVisible();
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
  await beta.locator('.qmb-general-quick-add').getByRole('button',{name:'Material',exact:true}).click();
  const row=beta.locator('.qmb-line').first();
  await row.getByRole('button',{name:'Edit line'}).click();
  // A brand-new material has Catalog search open by default. Its outside
  // pointer-down listener must not cancel the RATE button's click.
  await expect(row.locator('.quote-catalog-popover')).toBeVisible();
  const qty=row.getByRole('spinbutton',{name:'Quantity'});
  const before=await qty.evaluate(el=>({height:el.getBoundingClientRect().height,
    top:el.getBoundingClientRect().top}));
  await row.getByRole('button',{name:'Choose rate for material line'}).click();
  await expect(row.locator('.qmb-line-rate-drawer')).toBeVisible();
  const levels=row.getByRole('group',{name:'Stock Builder pricing levels'});
  await expect(levels.getByRole('button')).toHaveCount(9);
  const after=await qty.evaluate(el=>({height:el.getBoundingClientRect().height,
    top:el.getBoundingClientRect().top}));
  expect(Math.abs(after.height-before.height)).toBeLessThanOrEqual(3);
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
  await beta.locator('.qmb-general-quick-add').getByRole('button',{name:'Material',exact:true}).click();
  const row=beta.locator('.qmb-line').first();
  await row.getByRole('button',{name:'Edit line'}).click();
  await row.getByRole('spinbutton',{name:'Quantity'}).fill('8');
  await beta.locator('.qmb-quote-footer .qmb-primary').click();
  const review=page.getByRole('dialog',{name:'Review and issue quote'});
  await review.getByRole('button',{name:/Resolve Missing sell rate/}).click();
  const editor=review.getByRole('region',{name:/Resolve Missing sell rate/});
  await editor.getByRole('button',{name:'Choose from Rates in Review'}).click();
  const choices=editor.getByRole('region',{name:'Available selling rates'});
  await expect(choices).toBeVisible();
  const levels=choices.getByRole('group',{name:'Stock Builder pricing levels'});
  await expect(levels.getByRole('button')).toHaveCount(9);
  await expect(choices.getByText('Other SF rates')).toBeVisible();
  await levels.getByRole('button',{name:/Level 2.*54\.00\/SF/}).click();
  await expect(review.getByRole('button',{name:/Resolve Missing sell rate/})).toHaveCount(0);
  await expect(review.getByRole('button',{name:'Close Review and Issue'})).toBeVisible();
});


test('Area workflow advances to Materials and Pricing, creates Next Area and safely duplicates',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Fast mobile quoting workflow');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen A');
  await expect(beta.getByRole('button',{name:'Continue to next Area step'})).toContainText('Materials');
  await beta.getByRole('button',{name:'Continue to next Area step'}).click();
  await expect(beta.locator('.qmb-area-editor .qmb-tabs')
    .getByRole('button',{name:'Materials'})).toHaveAttribute('aria-current','page');
  await expect(beta.getByRole('button',{name:'Continue to next Area step'})).toContainText('Pricing');
  await beta.getByRole('button',{name:'Continue to next Area step'}).click();
  await expect(beta.locator('.qmb-area-editor .qmb-tabs')
    .getByRole('button',{name:'Pricing'})).toHaveAttribute('aria-current','page');
  await beta.getByRole('button',{name:'Create next Area'}).click();
  await expect(beta.getByRole('textbox',{name:'Area name'})).not.toHaveValue('Kitchen A');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await expect(beta.locator('.qmb-area-card')).toHaveCount(2);
  await beta.locator('.qmb-area-card').first().click();
  await beta.getByRole('button',{name:'Duplicate this Area'}).click();
  await expect(beta.getByRole('textbox',{name:'Area name'})).toHaveValue('Kitchen A copy');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await expect(beta.locator('.qmb-area-card')).toHaveCount(3);
});


test('mobile Details are ordered, CRM links do not navigate, and Back restores the quote',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Details and tab-back regression');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.locator('.qmb-quote-sticky').getByRole('button',{name:'Details'}).click();
  const details=beta.getByRole('region',{name:'Quote customer and project details'});
  await expect(details).toBeVisible();
  const headings=await details.locator('.qmb-details-heading h3').allTextContents();
  expect(headings).toEqual(['Customer','Project','Notes']);
  await expect(details.getByRole('textbox',{name:'Project / quote title'})).toHaveCount(0);
  await expect(details.getByRole('textbox',{name:'Company / customer'})).toBeVisible();
  await expect(details.getByRole('textbox',{name:'Contact person'})).toBeVisible();
  await expect(details.getByRole('textbox',{name:'Contact email'})).toBeVisible();
  await details.getByRole('textbox',{name:'Company / customer'}).fill('Sample Builder');
  await details.getByRole('textbox',{name:'Contact person'}).fill('Contact for Sample');
  await expect(details.locator('.quote-crm-connection-grid button')).toHaveCount(0);
  await expect(page.locator('.board-workspace')).toHaveCount(0);
  const title=beta.getByRole('textbox',{name:'Quote title'});
  await title.fill('Sample Apartment Phase I');
  await beta.getByLabel('Open SalesShop navigation').click();
  await beta.getByRole('navigation',{name:'SalesShop destinations'}).getByRole('button',{name:'Board'}).click();
  await expect(beta).toHaveCount(0);
  await page.getByRole('button',{name:'Back to previous SalesShop tab'}).click();
  const restored=page.getByRole('main',{name:'Quotes mobile beta'});
  await expect(restored).toBeVisible();
  await expect(restored.locator('.qmb-quote-sticky').getByRole('button',{name:'Details'}))
    .toHaveAttribute('aria-current','page');
  await expect(restored.getByRole('textbox',{name:'Quote title'})).toHaveValue('Sample Apartment Phase I');
  await expect(restored.getByRole('textbox',{name:'Company / customer'})).toHaveValue('Sample Builder');
});

test('mobile Details CRM project link is a selection, not a Board shortcut',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','CRM quick selection safety');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.locator('.qmb-quote-sticky').getByRole('button',{name:'Details'}).click();
  await beta.locator('.qmb-details-project-lookup summary').click();
  await expect(beta.getByRole('textbox',{name:'Find existing CRM project (optional)'})).toBeVisible();
  await expect(beta.locator('.quote-crm-connections')).toHaveCount(0);
  await expect(beta.getByRole('button',{name:/View company in Board/})).toHaveCount(0);
});


test('desktop Beta selections drawer stays inside editor and preserves live quote state',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1440','Dedicated wide desktop beta experience');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const navigator=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  await navigator.getByRole('button',{name:'Add Area from navigator'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Unit Type A');
  await navigator.getByRole('button',{name:/Build quote/}).click();
  await navigator.getByRole('button',{name:/Job Selections/}).click();
  const drawer=beta.getByRole('dialog',{name:'Quote selections'});
  await expect(drawer).toBeVisible();
  const bounds=await beta.evaluate(node=>{
    const a=node.querySelector('.qmb-desktop-main')!.getBoundingClientRect();
    const b=node.querySelector('.qmb-selections-drawer')!.getBoundingClientRect();
    return {left:a.left,right:a.right,drawerLeft:b.left,drawerRight:b.right,
      top:a.top,drawerTop:b.top};
  });
  expect(bounds.drawerLeft).toBeGreaterThanOrEqual(bounds.left-2);
  expect(bounds.drawerRight).toBeLessThanOrEqual(bounds.right+2);
  expect(bounds.drawerTop).toBeGreaterThanOrEqual(bounds.top-2);
  await drawer.getByRole('button',{name:'Close selections'}).click();
  await expect(drawer).toHaveCount(0);
  await expect(navigator.getByRole('button',{name:/Unit Type A/})).toBeVisible();
});


test('desktop Beta uses full center workspace across Build, Details, Preview and Review',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1440','Desktop 3-column regression from user screenshots');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const rail=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  const inspector=beta.getByRole('complementary',{name:'Live quote summary'});
  const main=beta.locator('.qmb-desktop-main');
  await expect(main).toBeVisible();
  const base=await beta.evaluate(root=>{
    const nav=root.querySelector('.qmb-desktop-navigation')!.getBoundingClientRect();
    const work=root.querySelector('.qmb-desktop-main')!.getBoundingClientRect();
    const info=root.querySelector('.qmb-desktop-inspector')!.getBoundingClientRect();
    const frame=root.querySelector('.qmb-desktop-frame')!.getBoundingClientRect();
    return {navRight:nav.right,workLeft:work.left,workRight:work.right,
      workWidth:work.width,infoLeft:info.left,infoRight:info.right,frameRight:frame.right};
  });
  expect(base.workLeft).toBeGreaterThanOrEqual(base.navRight-2);
  expect(base.infoLeft).toBeGreaterThanOrEqual(base.workRight-2);
  expect(base.infoRight).toBeLessThanOrEqual(base.frameRight+2);
  expect(base.workWidth).toBeGreaterThan(800);
  await rail.getByRole('button',{name:'Add Area from navigator'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  const card=beta.locator('.qmb-area-card').first();
  await expect(card).toBeVisible();
  expect((await card.boundingBox())!.width).toBeGreaterThan(500);
  await rail.getByRole('button',{name:'Customer & project'}).click();
  const details=beta.getByRole('region',{name:'Quote customer and project details'});
  await expect(details).toBeVisible();
  const areas=await details.locator('.qmb-details-section').evaluateAll(nodes=>
    nodes.slice(0,2).map(node=>{const r=node.getBoundingClientRect();
      return {left:r.left,right:r.right,width:r.width};}));
  expect(areas[0].width).toBeGreaterThan(270);
  expect(areas[1].width).toBeGreaterThan(270);
  expect(areas[0].right).toBeLessThanOrEqual(areas[1].left+2);
  await rail.getByRole('button',{name:'Customer preview'}).click();
  const preview=beta.locator('.qmb-preview');
  const paper=preview.locator('.customer-quote-paper');
  await expect(paper).toBeVisible();
  expect((await preview.boundingBox())!.width).toBeGreaterThan(600);
  expect((await paper.boundingBox())!.width).toBeGreaterThan(490);
  await beta.getByRole('button',{name:'Phone quote preview'}).click();
  const phone=beta.locator('.qmb-preview.is-phone-view');
  await expect(phone).toBeVisible();
  expect((await phone.boundingBox())!.width).toBeLessThanOrEqual(400);
  await beta.getByRole('button',{name:'Desktop quote preview'}).click();
  // The right inspector now contains real findings, not just Review counters.
  await expect(inspector.getByRole('button',{name:/Resolve No priced work yet/})).toBeVisible();
  await inspector.getByRole('button',{name:/Resolve No priced work yet/}).click();
  const review=page.getByRole('dialog',{name:'Review and issue quote'});
  await expect(review.locator('.qmb-audit-overview')).toBeHidden();
  const pulled=page.locator('.qmb-review-pulled-inspector .qmb-desktop-inspector');
  await expect(pulled).toBeVisible();
  const pulledBounds=await pulled.boundingBox(),detailBounds=await review.boundingBox();
  expect(pulledBounds!.right).toBeLessThanOrEqual(detailBounds!.left+2);
  expect(detailBounds!.width).toBeLessThan(520);
  const reviewShare=review.locator('.quote-share-control.is-inline');
  await expect(reviewShare).toBeVisible();
  await reviewShare.getByRole('button',{name:/Customer link & sharing/}).click();
  await expect(reviewShare.getByRole('region',{name:'Customer quote link'})).toBeVisible();
  expect(await reviewShare.locator('.quote-share-panel').evaluate(node=>getComputedStyle(node).position)).toBe('static');
  await review.getByRole('button',{name:'Close Review and Issue'}).click();
  await expect(beta.locator('.qmb-preview')).toBeVisible();
});


test('Beta Batch A: Area visibility, order, lines, move and delete preserve total',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Phone structure parity');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen');
  await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Pricing'}).click();
  const add=beta.locator('.qmb-addcharge');
  await add.getByRole('combobox',{name:'Add a line'}).selectOption('tax');
  await add.getByRole('button',{name:'+ Add line to Area'}).click();
  await add.getByRole('combobox',{name:'Add a line'}).selectOption('warranty');
  await add.getByRole('button',{name:'+ Add line to Area'}).click();
  await add.getByRole('combobox',{name:'Add a line'}).selectOption('scope');
  await add.getByRole('button',{name:'+ Add line to Area'}).click();
  const tax=beta.locator('.qmb-line').filter({hasText:'Taxes'});
  await tax.getByRole('button',{name:'Edit line'}).click();
  await tax.getByRole('spinbutton',{name:'Amount ($)'}).fill('75');
  await expect(beta.locator('.qmb-area-footer .qmb-footer-area-total')).toContainText('$75.00');
  await tax.getByRole('button',{name:'Move line down'}).click();
  const rows=beta.locator('.qmb-area-editor .qmb-line-name strong');
  await expect(rows.first()).toHaveText('Warranty');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await beta.getByRole('button',{name:'Reorder or delete Areas'}).click();
  await beta.getByRole('button',{name:'Hide Kitchen on customer quote'}).click();
  await beta.getByRole('button',{name:'Done reordering and deleting Areas'}).click();
  await expect(beta.locator('.qmb-area-card .qmb-area-hidden-label')).toHaveText('Hidden from customer');
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Bath');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await beta.getByRole('button',{name:'Reorder or delete Areas'}).click();
  await beta.getByRole('button',{name:/Drag Bath to reorder/}).press('ArrowUp');
  await expect(beta.locator('.qmb-inline-area-list .qmb-area-text strong').first()).toHaveText('Bath');
  await beta.getByRole('button',{name:'Done reordering and deleting Areas'}).click();
  await expect(beta.locator('.qmb-area-card .qmb-area-text strong').first()).toHaveText('Bath');
  await beta.locator('.qmb-area-card').filter({hasText:'Kitchen'}).click();
  await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Pricing'}).click();
  const taxAgain=beta.locator('.qmb-area-editor .qmb-line').filter({hasText:'Taxes'});
  await taxAgain.getByRole('button',{name:'Edit line'}).click();
  await taxAgain.getByRole('combobox',{name:'Move line to Area'}).selectOption({label:'Bath'});
  await expect(beta.locator('.qmb-area-editor .qmb-line').filter({hasText:'Taxes'})).toHaveCount(0);
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await beta.locator('.qmb-area-card').filter({hasText:'Bath'}).click();
  await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Pricing'}).click();
  await expect(beta.locator('.qmb-area-editor .qmb-line').filter({hasText:'Taxes'})).toHaveCount(1);
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await beta.getByRole('button',{name:'Reorder or delete Areas'}).click();
  await beta.getByRole('button',{name:'Delete Bath Area'}).click();
  const deleteChoice=page.getByRole('dialog',{name:'Delete Area Bath'});
  await expect(deleteChoice).toBeVisible();
  await deleteChoice.getByRole('button',{name:/Delete Area only · keep contents/}).click();
  await expect(beta.locator('.qmb-area-card')).toHaveCount(1);
  await beta.locator('.qmb-line').filter({hasText:'Taxes'}).getByRole('button',{name:'Edit line'}).click();
  await expect(beta.locator('.qmb-line').filter({hasText:'Taxes'}).getByRole('combobox',{name:'Move line to Area'})).toHaveValue('');
  await expect(beta.locator('.qmb-quote-total')).toHaveText('$75.00');
  await beta.getByRole('button',{name:'Undo'}).click();
  await expect(beta.locator('.qmb-area-card')).toHaveCount(2);
});



test('Beta Area management permits deliberate delete-all without retaining prices',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Area deletion choice and undo');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Delete me');
  await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Pricing'}).click();
  await beta.locator('.qmb-addcharge').getByRole('button',{name:'+ Add line to Area'}).click();
  const charge=beta.locator('.qmb-area-editor .qmb-line').filter({hasText:'New line item'});
  await charge.getByRole('button',{name:'Edit line'}).click();
  await charge.getByRole('spinbutton',{name:'Amount ($)'}).fill('225');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await expect(beta.locator('.qmb-quote-total')).toHaveText('$225.00');
  await beta.getByRole('button',{name:'Reorder or delete Areas'}).click();
  await beta.getByRole('button',{name:'Delete Delete me Area'}).click();
  const dialog=page.getByRole('dialog',{name:'Delete Area Delete me'});
  await dialog.getByRole('button',{name:'Delete Area and its contents'}).click();
  await expect(beta.locator('.qmb-area-card')).toHaveCount(0);
  await expect(beta.locator('.qmb-quote-total')).toHaveText('$0.00');
  await beta.getByRole('button',{name:'Undo'}).click();
  await expect(beta.locator('.qmb-area-card')).toHaveCount(1);
  await expect(beta.locator('.qmb-quote-total')).toHaveText('$225.00');
});

test('Beta Preview edits live Area title and Takeoffs sell rate without leaving paper',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Preview inline quote changes');
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
  await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Pricing'}).click();
  await beta.getByRole('spinbutton',{name:'Takeoff selling rate per square foot'}).fill('50');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await beta.locator('.qmb-quote-sticky').getByRole('button',{name:'Preview'}).click();
  await beta.getByRole('button',{name:/Make edits/}).click();
  await beta.getByRole('button',{name:/Edit Area name New area/}).click();
  await beta.getByRole('textbox',{name:'Edit Area name in preview'}).fill('Kitchen');
  await beta.getByRole('button',{name:'Done editing Area name'}).click();
  await beta.getByRole('button',{name:'Edit Area price Kitchen'}).click();
  const dialog=beta.getByRole('dialog',{name:'Edit quote price from preview'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('spinbutton',{name:'Preview sell rate'}).fill('60');
  await expect(dialog.locator('.qmb-preview-edit-total')).toContainText('$480.00');
  await dialog.getByRole('button',{name:'Done',exact:true}).click();
  await expect(beta.locator('.qmb-preview .customer-quote-paper')).toContainText('Kitchen');
  await expect(beta.locator('.qmb-preview .customer-quote-total')).toContainText('$480.00');
});

test('desktop Beta toolbar and Job Selections remain accessible outside Build',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1280','Desktop toolbar and cross-view selections');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const history=beta.getByRole('toolbar',{name:'Quote history controls'});
  await expect(history.getByRole('button',{name:'Undo quote change'})).toBeVisible();
  await expect(history.getByRole('button',{name:'Redo quote change'})).toBeVisible();
  await expect(beta.getByRole('toolbar',{name:'Quote editing tools'})).toHaveCount(0);
  await beta.getByRole('complementary',{name:'Quote workspace navigation'})
    .getByRole('button',{name:/Job Selections/}).click();
  await expect(beta.getByRole('dialog',{name:'Quote selections'})).toBeVisible();
  await beta.getByRole('button',{name:'Close selections'}).click();
  await beta.getByRole('complementary',{name:'Quote workspace navigation'})
    .getByRole('button',{name:'Customer preview'}).click();
  await expect(beta.locator('.qmb-preview')).toBeVisible();
  await beta.getByRole('complementary',{name:'Quote workspace navigation'})
    .getByRole('button',{name:/Job Selections/}).click();
  await expect(beta.getByRole('dialog',{name:'Quote selections'})).toBeVisible();
});


test('Quotes Beta Review opens at a specific readiness finding and rechecks changes',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1440','Desktop always-visible Review and live recheck');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const inspector=beta.getByRole('complementary',{name:'Live quote summary'});
  const finding=inspector.getByRole('button',{name:'Resolve Customer not selected'});
  await expect(finding).toBeVisible();
  await finding.click();
  const drawer=page.getByRole('dialog',{name:'Review and issue quote'});
  await expect(drawer).toBeVisible();
  const inline=drawer.locator('.qmb-audit-finding[data-audit-id="quote:customer"]');
  await expect(inline).toHaveClass(/is-expanded/);
  // The embedded Review quick-fix changes the live quote while drawer remains open.
  await expect(drawer.locator('.qmb-audit-finding[data-audit-id="quote:customer"]')).toBeVisible();
  const customerField=inline.locator('input').first();
  await expect(customerField).toBeVisible();
  await customerField.fill('Sample Construction');
  await inline.getByRole('button',{name:'Save',exact:true}).click();
  await expect(drawer.getByRole('status').filter({hasText:'Quote changed since this review'})).toBeVisible();
  await expect(drawer.getByRole('button',{name:/Recheck now/})).toBeVisible();
  await drawer.getByRole('button',{name:/Recheck now/}).click();
  await expect(drawer.getByText('Quote changed since this review')).toHaveCount(0);
  await drawer.getByRole('button',{name:'Close Review and Issue'}).click();
  await expect(inspector.getByRole('button',{name:'Resolve Customer not selected'})).toHaveCount(0);
});

test('Area management modal stays opaque above its dimmed background',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1440','Portaled Area modal opacity');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('complementary',{name:'Quote workspace navigation'})
    .getByRole('button',{name:'Add Area from navigator'}).click();
  const rail=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  await rail.getByRole('button',{name:'Reorder or delete Areas'}).click();
  await rail.getByRole('button',{name:'Delete New area Area'}).click();
  const dialog=page.getByRole('dialog',{name:'Delete Area New area'});
  await expect(dialog).toBeVisible();
  const style=await dialog.evaluate(node=>{
    const s=getComputedStyle(node);
    return {background:s.backgroundColor,opacity:s.opacity,isolation:s.isolation};
  });
  expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(style.background).not.toBe('transparent');
  expect(style.opacity).toBe('1');
  expect(style.isolation).toBe('isolate');
  await dialog.getByRole('button',{name:'Cancel'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(rail.getByRole('button',{name:'Done reordering and deleting Areas'})).toBeVisible();
  await rail.getByRole('button',{name:'Done reordering and deleting Areas'}).click();
  await expect(rail.getByRole('button',{name:'Reorder or delete Areas'})).toBeVisible();
});


test('inline Area mode saves on Enter/outside and cancels pending order on Escape',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Inline touch and keyboard Area controls');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Bath');
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  const names=beta.locator('.qmb-inline-area-list .qmb-area-text strong');
  const mode=()=>beta.getByRole('button',{name:'Reorder or delete Areas'});
  await mode().click();
  const bath=beta.getByRole('button',{name:/Drag Bath to reorder/});
  await bath.focus();
  await bath.press('ArrowUp');
  await expect(names.first()).toHaveText('Bath');
  await page.keyboard.press('Escape');
  await expect(mode()).toBeVisible();
  await expect(names.first()).toHaveText('Kitchen');
  await mode().click();
  await beta.getByRole('button',{name:/Drag Bath to reorder/}).press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(mode()).toBeVisible();
  await expect(names.first()).toHaveText('Bath');
  await mode().click();
  await beta.getByRole('button',{name:/Drag Kitchen to reorder/}).press('ArrowUp');
  await expect(names.first()).toHaveText('Kitchen');
  // Clicking outside Area workspace saves the temporary new order.
  await beta.getByRole('textbox',{name:'Quote title'}).click();
  await expect(mode()).toBeVisible();
  await expect(names.first()).toHaveText('Kitchen');
});

test('desktop Area mode edits existing sidebar cards without opening a reorder modal',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1440','Desktop inline management parity');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const rail=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  await rail.getByRole('button',{name:'Add Area from navigator'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen');
  await rail.getByRole('button',{name:'Add Area from navigator'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Bath');
  await rail.getByRole('button',{name:'Reorder or delete Areas'}).click();
  await expect(page.getByRole('dialog',{name:'Manage quote Areas'})).toHaveCount(0);
  await expect(rail.locator('[data-area-sort-id]')).toHaveCount(2);
  await expect(rail.getByRole('button',{name:/Drag Bath to reorder/})).toBeVisible();
  await expect(rail.getByRole('button',{name:'Delete Bath Area'})).toBeVisible();
  await rail.getByRole('button',{name:/Drag Bath to reorder/}).press('ArrowUp');
  await expect(rail.locator('.qmb-desktop-area-title strong').first()).toHaveText('Bath');
  await rail.getByRole('button',{name:'Done reordering and deleting Areas'}).click();
  await expect(rail.locator('.qmb-desktop-area-title strong').first()).toHaveText('Bath');
  await expect(rail.getByRole('button',{name:'Delete Bath Area'})).toHaveCount(0);
});


test('General inline Reorder/Delete keeps its charge cards and supports Undo',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','General line structure on mobile');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.locator('.qmb-general-quick-add').getByRole('button',{name:'Custom',exact:true}).click();
  let rows=beta.locator('.qmb-inline-general-row');
  await rows.first().getByRole('button',{name:'Edit line'}).click();
  await rows.first().getByRole('textbox',{name:'Description'}).fill('Material delivery');
  await rows.first().getByRole('spinbutton',{name:'Amount ($)'}).fill('85');
  await beta.locator('.qmb-general-quick-add').getByRole('button',{name:'Custom',exact:true}).click();
  rows=beta.locator('.qmb-inline-general-row');
  await rows.nth(1).getByRole('button',{name:'Edit line'}).click();
  await rows.nth(1).getByRole('textbox',{name:'Description'}).fill('Jobsite cleanup');
  await rows.nth(1).getByRole('spinbutton',{name:'Amount ($)'}).fill('40');
  await expect(beta.locator('.qmb-quote-total')).toHaveText('$125.00');
  await beta.getByRole('button',{name:'Reorder or delete General'}).click();
  await expect(beta.getByRole('button',{name:'Delete General line Jobsite cleanup'})).toBeVisible();
  const handle=beta.getByRole('button',{name:/Drag General line Jobsite cleanup/});
  await handle.press('ArrowUp');
  await expect(rows.first()).toContainText('Jobsite cleanup');
  await beta.getByRole('button',{name:'Done reordering General'}).click();
  await expect(rows.first()).toContainText('Jobsite cleanup');
  await beta.getByRole('button',{name:'Reorder or delete General'}).click();
  await beta.getByRole('button',{name:'Delete General line Jobsite cleanup'}).click();
  const dialog=page.getByRole('dialog',{name:'Delete General line'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Keep line'}).click();
  await expect(rows).toHaveCount(2);
  await beta.getByRole('button',{name:'Delete General line Jobsite cleanup'}).click();
  await dialog.getByRole('button',{name:/Delete this line and its charge/}).click();
  await expect(beta.locator('.qmb-quote-total')).toHaveText('$85.00');
  await beta.getByRole('button',{name:'Undo'}).click();
  await expect(beta.locator('.qmb-quote-total')).toHaveText('$125.00');
});

test('Area drag lifts the full card, and compact customer document aligns text',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1440','Drag geometry and document polish');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const rail=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  await rail.getByRole('button',{name:'Add Area from navigator'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen Island');
  await rail.getByRole('button',{name:'Add Area from navigator'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Bathrooms');
  await rail.getByRole('button',{name:'Reorder or delete Areas'}).click();
  const grip=rail.getByRole('button',{name:/Drag Bathrooms to reorder/});
  const bounds=(await grip.boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  await page.mouse.down();
  await expect(page.locator('.qmb-drag-ghost')).toBeVisible();
  await expect(rail.locator('[data-qmb-sort-row].is-drag-source')).toBeVisible();
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y-14,{steps:3});
  const transform=await page.locator('.qmb-drag-ghost').evaluate(node=>getComputedStyle(node).transform);
  expect(transform).not.toBe('none');
  await page.mouse.up();
  await expect(page.locator('.qmb-drag-ghost')).toHaveCount(0);
  await rail.getByRole('button',{name:'Done reordering and deleting Areas'}).click();
  await rail.getByRole('button',{name:'Customer preview'}).click();
  const controls=beta.locator('.qmb-preview-action-group');
  const groupStyle=await controls.evaluate(node=>getComputedStyle(node).display);
  expect(groupStyle).toBe('flex');
  const previewToggle=await beta.getByRole('button',{name:'Phone quote preview'}).boundingBox();
  const makeEdits=await beta.getByRole('button',{name:'✎ Make edits'}).boundingBox();
  expect(Math.abs(previewToggle!.y-makeEdits!.y)).toBeLessThan(14);
  await beta.getByRole('button',{name:'Phone quote preview'}).click();
  const paper=beta.locator('.qmb-preview .customer-quote-paper');
  const font=await paper.locator('.customer-quote-table-head').evaluate(node=>getComputedStyle(node).fontSize);
  expect(parseFloat(font)).toBeGreaterThanOrEqual(8);
  const header=await paper.locator('.customer-quote-table-head').evaluate(node=>getComputedStyle(node).backgroundColor);
  expect(header).not.toBe('rgb(243, 243, 241)');
});


test('Desktop Batch B: paired Materials and Calculator share editable quotes and margin',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1440','Paired desktop Materials and Calculator');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const rail=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  await rail.getByRole('button',{name:'Add Area from navigator'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen');
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('120');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('60');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  const tabs=beta.locator('.qmb-area-editor .qmb-tabs');
  await tabs.getByRole('button',{name:'Materials'}).click();
  await expect(beta.locator('.qmb-commerce-segment')).toHaveCount(3);
  const selling=beta.locator('.qmb-lab-selling');
  await expect(selling).toBeVisible();
  await selling.getByRole('button',{name:'Manual',exact:true}).click();
  await selling.getByRole('spinbutton',{name:'Area manual selling price'}).fill('2500');
  await expect(beta.locator('.qmb-desktop-grand-total')).toContainText('$2,500.00');
  await tabs.getByRole('button',{name:'Calculator'}).click();
  const calculator=beta.locator('.qmb-lab-calculator');
  await expect(calculator).toBeVisible();
  await expect(calculator.getByRole('spinbutton',{name:'Area slab yield percent'})).toHaveValue('65');
  await calculator.getByRole('spinbutton',{name:'Area supplier slab area SF'}).fill('50');
  await calculator.getByRole('spinbutton',{name:'Area buying cost per slab'}).fill('700');
  await expect(calculator.locator('.qmb-private-cost')).toContainText('$1,400.00');
  await expect(calculator.locator('.qmb-private-margin')).toContainText('44.0%');
  await calculator.getByRole('spinbutton',{name:'Area manually purchased slabs'}).fill('1.25');
  await expect(calculator.locator('.qmb-private-cost')).toContainText('$875.00');
  await calculator.getByRole('spinbutton',{name:'Area shop cost'}).fill('100');
  await calculator.getByRole('spinbutton',{name:'Area installation cost'}).fill('200');
  await expect(beta.locator('.qmb-desktop-grand-total')).toContainText('$2,500.00');
  await tabs.getByRole('button',{name:'Materials'}).click();
  await selling.getByRole('button',{name:'Square feet'}).click();
  await selling.getByRole('spinbutton',{name:'Area selling rate per SF'}).fill('40');
  await expect(selling).toContainText('50.00 SF × $40.00/SF');
  await tabs.getByRole('button',{name:'Measure'}).click();
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('144');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await tabs.getByRole('button',{name:'Materials'}).click();
  await expect(selling).toContainText('60.00 SF × $40.00/SF');
  await selling.getByRole('button',{name:'Multiplier'}).click();
  await expect(selling.locator('.qmb-pricing-formula')).toContainText('$2,800.00');
  await tabs.getByRole('button',{name:'Calculator'}).click();
  await calculator.getByRole('spinbutton',{name:'Area slab yield percent'}).fill('25');
  await tabs.getByRole('button',{name:'Materials'}).click();
  await expect(selling.locator('.qmb-pricing-formula')).toContainText('$7,000.00');
  await expect(beta.locator('.qmb-lab-extras')).toBeVisible();
  const extras=beta.locator('.qmb-lab-extras');
  await extras.getByRole('button',{name:'+ Add'}).click();
  await extras.getByRole('button',{name:'Custom',exact:true}).click();
  await expect(extras.locator('.qmb-desktop-extra-row')).toHaveCount(1);
  await extras.locator('.qmb-desktop-extra-row input[aria-label$=" price"]').fill('150');
  await expect(beta.locator('.qmb-desktop-grand-total')).toContainText('$7,150.00');
});

test('Desktop Batch B: sink catalog and materials suggestions overlay instead of reflowing cards',async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1440','Desktop selector overlays');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const rail=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  await rail.getByRole('button',{name:'Add Area from navigator'}).click();
  await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Materials'}).click();
  const materials=beta.locator('.qmb-commerce-segment').first().locator('.qmb-materials-sheet');
  const color=materials.getByRole('combobox',{name:'Material: type to search Catalog'});
  await color.click();
  const materialMenu=materials.locator('.qmb-material-picker .qtl-combobox-menu');
  await expect(materialMenu).toBeVisible();
  expect(await materialMenu.evaluate(node=>getComputedStyle(node).position)).toBe('absolute');
  await page.keyboard.press('Escape');
  const sinks=beta.locator('.qmb-commerce-sink-pair');
  await sinks.getByRole('button',{name:'+ Add sink'}).click();
  const row=sinks.locator('.qmb-sink-line').first();
  const before=await row.boundingBox();
  await row.getByRole('combobox',{name:'Sink model: type to search Catalog'}).click();
  const menu=row.locator('.qmb-sink-catalog .qtl-combobox-menu');
  await expect(menu).toBeVisible();
  expect(await menu.evaluate(node=>getComputedStyle(node).position)).toBe('absolute');
  const after=await row.boundingBox();
  expect(Math.abs(after!.height-before!.height)).toBeLessThan(4);
  await page.keyboard.press('Escape');
  const prices=sinks.locator('.qmb-sink-selling-sheet');
  await prices.getByRole('spinbutton',{name:'Sink 1 quantity'}).fill('2');
  await prices.getByRole('spinbutton',{name:'Sink 1 sell price'}).fill('220');
  await expect(prices).toContainText('$440.00');
  await beta.locator('.qmb-area-editor .qmb-tabs').getByRole('button',{name:'Calculator'}).click();
  const source=beta.locator('.qmb-sink-selling-cost');
  await source.getByRole('spinbutton',{name:'Sink 1 buying cost'}).fill('85');
  await expect(source).toContainText('$170.00');
});


test('desktop General precedes Areas and inline sidebar management stays within its width',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-1440','Batch B desktop layout integrity');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  const rail=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  const g=beta.locator('.qmb-general-heading');
  const a=beta.locator('.qmb-section-head[data-area-edit-workspace]');
  await expect(g).toBeVisible();
  await expect(a).toBeVisible();
  const generalRect=await g.boundingBox(),areasRect=await a.boundingBox();
  expect(generalRect!.top).toBeLessThan(areasRect!.top);
  for(const name of ['Kitchen Island','Baths','Bathrooms']){
    await rail.getByRole('button',{name:'Add Area from navigator'}).click();
    await beta.getByRole('textbox',{name:'Area name'}).fill(name);
  }
  await rail.getByRole('button',{name:'Reorder or delete Areas'}).click();
  const overflow=await rail.evaluate(node=>({
    actual:node.scrollWidth,viewport:node.clientWidth,
  }));
  expect(overflow.actual-overflow.viewport).toBeLessThanOrEqual(3);
  const cards=rail.locator('.qmb-desktop-area-list .qmb-desktop-area-card');
  expect((await cards.first().boundingBox())!.width).toBeGreaterThan(80);
  await expect(rail.getByRole('button',{name:'Hide Kitchen Island on customer quote'})).toBeVisible();
  await expect(rail.getByRole('button',{name:'Delete Kitchen Island Area'})).toBeVisible();
  await rail.getByRole('button',{name:'Done reordering and deleting Areas'}).click();
  await expect(rail.getByRole('button',{name:'Hide Kitchen Island on customer quote'})).toHaveCount(0);
});

test('new measured Areas keep itemized presentation instead of becoming lump sum',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-390','Quote presentation defaults after first measurement');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New quote'}).click();
  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen');
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('48');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('24');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await expect(beta.locator('.qmb-area-card')).toContainText('Itemized');
  await beta.locator('.qmb-general-quick-add').getByRole('button',{name:'General takeoffs'}).click();
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await expect(beta.locator('.qmb-general-takeoff-ref')).toBeVisible();
});
