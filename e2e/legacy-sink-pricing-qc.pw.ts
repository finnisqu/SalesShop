import {test,expect,type Page} from '@playwright/test';

/**
 * Local-only browser acceptance. Synthetic saved documents; never a production
 * login, organization, customer record, or shared Supabase workspace.
 */
const quoteId='local-legacy-sink-qc';
const areaId='bath-qc';
const sinkId='legacy-undermount-qc';
const storageKey='salesshop-react-quotes-v1';
const quoteFixture=(status:'Draft'|'Sent'='Draft')=>({
  id:quoteId,quoteNumber:status==='Draft'?'DRAFT-QC':'QC-ISSUED-1',
  documentType:'quote',title:'Local legacy sink QC',
  originalQuoteDate:'2026-11-10',quoteDate:'2026-11-10',revision:0,status,
  createdAt:'2026-11-10T12:00:00.000Z',updatedAt:'2026-11-10T12:00:00.000Z',
  ...(status==='Sent'?{sentAt:'2026-11-10T12:10:00.000Z'}:{}),
  customerColumns:{quantity:true,rate:true,lineAmount:true},
  customerNotes:'',internalNotes:'',history:[],
  sections:[{id:areaId,title:'Bathroom',customerVisible:true,scope:{
    countertopSf:8,takeoffMaterial:'Quartz',takeoffSinks:[{
      id:sinkId,name:'Legacy vanity undermount',category:'vanity',count:1,unitPrice:225,
      // Intentionally no includeInPricing: historical specification-only format.
    }],
  }}],
  lines:[
    {id:'stone-qc',sectionId:areaId,kind:'material',description:'Quartz top',
      pricingMode:'quantity-rate',quantity:8,rate:60,
      customerVisible:true,includeInTotal:true},
    {id:'manual-sink-qc',sectionId:areaId,kind:'sink',
      description:'Existing builder sink allowance',pricingMode:'direct',amount:150,
      customerVisible:true,includeInTotal:true},
  ],
});
async function seedLocalOnly(page:Page,status:'Draft'|'Sent'='Draft'){
  await page.goto('/');
  await page.evaluate(({quote,status})=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
    localStorage.setItem('salesshop-react-quotes-v1',
      JSON.stringify({schemaVersion:2,quotes:[quote],activeQuoteId:quote.id}));
    sessionStorage.setItem('salesshop:quotes-mobile-beta-location-v1',JSON.stringify({
      quoteId:quote.id,page:'area',quoteTab:'build',areaTab:'materials',areaId:'bath-qc',
    }));
    // Never set a credential, real organization, or cloud source.
    void status;
  },{quote:quoteFixture(status),status});
  await page.reload();
}
async function savedQuote(page:Page){
  return page.evaluate((key:string)=>{
    const doc=JSON.parse(localStorage.getItem(key)??'{}');
    const quote=doc.quotes?.find((item:{id:string})=>item.id==='local-legacy-sink-qc');
    if(!quote)throw new Error('Synthetic legacy fixture not found in local storage');
    const amount=quote.lines.reduce((total:number,line:{
      includeInTotal:boolean;pricingMode:string;rate?:number;quantity?:number;amount?:number;
    })=>total+(line.includeInTotal
      ?line.pricingMode==='quantity-rate'?(line.quantity??0)*(line.rate??0):line.amount??0:0),0);
    return {amount,lines:quote.lines,sections:quote.sections,status:quote.status};
  },storageKey);
}
async function clickWithConfirmation(page:Page, checkbox:ReturnType<Page['getByRole']>, accept:boolean){
  let message:string|undefined;
  page.once('dialog',async dialog=>{
    message=dialog.message();
    if(accept)await dialog.accept();
    else await dialog.dismiss();
  });
  await checkbox.click();
  expect(message,'A native price-change confirmation must appear').toBeDefined();
  return message!;
}
test.beforeAll(()=>{
  // Browsers started by the Vite webServer must stay in its isolated QC mode.
  if(process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_ANON_KEY)
    throw new Error('Legacy sink browser QC must never run against a cloud Supabase workspace');
});

test('legacy sink: no auto charge; explicit cancel/approve; safe opt-out and refresh',async({page},info)=>{
  test.skip(!['phone-390','desktop-1280'].includes(info.project.name),'Focused phone and desktop QA');
  await seedLocalOnly(page);
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  const area=beta.locator('.qmb-area-editor');
  await expect(area).toBeVisible();
  await expect(area.getByRole('navigation',{name:'Area sections'})
    .getByRole('button',{name:'Materials'})).toHaveAttribute('aria-current','page');
  const inclusion=area.getByRole('checkbox',{name:'Include sink 1 in quote total'});
  await expect(inclusion).not.toBeChecked();
  await expect(inclusion).toBeEnabled();
  await expect(area.getByRole('spinbutton',{name:'Sink 1 sell price'})).toBeDisabled();
  const total=area.locator('.qmb-footer-area-total strong');
  await expect(total).toHaveText('$630.00');
  const baseline=await savedQuote(page);
  expect(baseline.amount).toBe(630);
  expect(baseline.lines).toHaveLength(2);
  expect(baseline.sections[0].scope.takeoffSinks[0].includeInPricing).toBeUndefined();

  const canceled=await clickWithConfirmation(page,inclusion,false);
  expect(canceled).toContain('Current total: $630.00');
  expect(canceled).toContain('Proposed total: $855.00');
  expect(canceled).toContain('Difference: $225.00');
  expect(canceled).toContain('Review separately priced sink lines');
  await expect(inclusion).not.toBeChecked();
  await expect(total).toHaveText('$630.00');
  expect(await savedQuote(page)).toEqual(baseline);

  const approved=await clickWithConfirmation(page,inclusion,true);
  expect(approved).toContain('Proposed total: $855.00');
  await expect(inclusion).toBeChecked();
  await expect(total).toHaveText('$855.00');
  const accepted=await savedQuote(page);
  expect(accepted.amount).toBe(855);
  expect(accepted.lines.find((line:{id:string})=>line.id==='manual-sink-qc')).toEqual(
    baseline.lines.find((line:{id:string})=>line.id==='manual-sink-qc'));
  const created=accepted.lines.filter((line:{takeoffSinkId?:string})=>line.takeoffSinkId===sinkId);
  expect(created).toHaveLength(1);
  expect(created[0].includeInTotal).toBe(true);
  const managedId=created[0].id;

  const removal=await clickWithConfirmation(page,inclusion,true);
  expect(removal).toContain('Proposed total: $630.00');
  await expect(inclusion).not.toBeChecked();
  await expect(total).toHaveText('$630.00');
  let removed=await savedQuote(page);
  expect(removed.amount).toBe(630);
  expect(removed.lines.find((line:{id:string})=>line.id===managedId)?.includeInTotal).toBe(false);

  await page.reload();
  await expect(area).toBeVisible();
  await expect(inclusion).not.toBeChecked();
  await expect(total).toHaveText('$630.00');
  removed=await savedQuote(page);
  expect(removed.lines.find((line:{id:string})=>line.id===managedId)?.includeInTotal).toBe(false);
  expect(removed.lines.find((line:{id:string})=>line.id==='manual-sink-qc')).toEqual(
    baseline.lines.find((line:{id:string})=>line.id==='manual-sink-qc'));

  await clickWithConfirmation(page,inclusion,true);
  await expect(total).toHaveText('$855.00');
  const readded=await savedQuote(page);
  expect(readded.lines.filter((line:{takeoffSinkId?:string})=>line.takeoffSinkId===sinkId))
    .toHaveLength(1);
  expect(readded.lines.find((line:{id:string})=>line.id===managedId)?.includeInTotal).toBe(true);
});

test('issued legacy quote remains read-only in the phone and desktop Materials UI',async({page},info)=>{
  test.skip(!['phone-390','desktop-1280'].includes(info.project.name),'Focused phone and desktop QA');
  await seedLocalOnly(page,'Sent');
  const area=page.getByRole('main',{name:'Quotes mobile beta'}).locator('.qmb-area-editor');
  await expect(area).toBeVisible();
  const inclusion=area.getByRole('checkbox',{name:'Include sink 1 in quote total'});
  await expect(inclusion).not.toBeChecked();
  await expect(inclusion).toBeDisabled();
  await expect(area.getByRole('spinbutton',{name:'Sink 1 sell price'})).toBeDisabled();
  const before=await savedQuote(page);
  expect(before.amount).toBe(630);
  await page.reload();
  expect(await savedQuote(page)).toEqual(before);
});
