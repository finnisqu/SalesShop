import {test,expect} from '@playwright/test';

/** Disposable local-QC fixture; no signed-in account or production data. */
test('issued customer revision remains frozen through revision and newer draft edits',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1440','Focused historical customer document desktop route');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:/^\+ New(?: document)?$/}).first().click();
  const picker=page.getByRole('dialog',{name:'New Sales Document'});
  await picker.getByRole('button',{name:/^Quick Quote/}).click();
  await picker.getByRole('textbox',{name:'Quote name'}).fill('Original Kitchen Version');
  await picker.getByRole('button',{name:/Create document/}).click();
  const rail=beta.getByRole('complementary',{name:'Quote workspace navigation'});
  await rail.getByRole('button',{name:'Add Area from navigator'}).click();
  await beta.getByRole('textbox',{name:'Area name'}).fill('Kitchen');
  await beta.getByRole('button',{name:'+ Add piece'}).click();
  await beta.getByRole('textbox',{name:'Length (in)'}).fill('48');
  await beta.getByRole('textbox',{name:'Length (in)'}).blur();
  await beta.getByRole('textbox',{name:'Width (in)'}).fill('24');
  await beta.getByRole('textbox',{name:'Width (in)'}).blur();
  await beta.getByRole('button',{name:'Resolve Area pricing issues'}).click();
  await beta.locator('.qmb-lab-selling').getByRole('spinbutton',{name:'Area selling rate per SF'}).fill('50');
  await beta.getByRole('complementary',{name:'Live quote summary'})
    .getByRole('button',{name:'Review and issue quote'}).click();
  const review=page.getByRole('dialog',{name:'Review and issue quote'});
  await review.getByRole('button',{name:'Open customer preview ›'}).click();
  await expect(beta.locator('.customer-quote-paper')).toContainText('Original Kitchen Version');
  await expect(beta.locator('.customer-quote-total')).toContainText('$400.00');
  await beta.getByRole('button',{name:'Back to Review',exact:true}).click();
  const needsAcknowledgement=review.getByRole('checkbox',{name:/I reviewed the remaining items/});
  if(await needsAcknowledgement.count())await needsAcknowledgement.check();
  await review.getByRole('checkbox',{name:'Approve customer document for issuing'}).check();
  await review.getByRole('button',{name:'Issue quote · no message sent'}).click();
  await expect(review.getByText('Issued customer revision',{exact:true})).toBeVisible();
  await expect(review.getByLabel('Step 4 share and confirm customer delivery')).toBeVisible();
  await expect(review.getByLabel('Step 4 share and confirm customer delivery'))
    .toContainText('Sharing the link is not proof of delivery');
  await review.getByRole('button',{name:'Create editable revision ›'}).click();
  await expect(beta.locator('.qmb-quote-footer .qmb-primary')).toHaveText('Review & issue ›');
  await beta.getByRole('textbox',{name:'Quote title'}).fill('New Island Draft');
  await rail.getByRole('button',{name:'Customer & deal'}).click();
  const timeline=beta.getByRole('region',{name:'Quote document and history'});
  await expect(timeline).toContainText('Revision timeline');
  await timeline.getByRole('button',{name:'View issued revision 0'}).click();
  const past=page.getByRole('dialog',{name:'Historical customer quote'});
  await expect(past).toContainText('Original Kitchen Version');
  await expect(past).not.toContainText('New Island Draft');
  await expect(past.locator('.customer-quote-total')).toContainText('$400.00');
  await past.getByRole('button',{name:'Close historical document'}).click();
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toHaveValue('New Island Draft');
  const stored=await page.evaluate(()=>{
    const doc=JSON.parse(localStorage.getItem('salesshop-react-quotes-v1')||'{}');
    const active=doc.quotes?.find((q:{id:string})=>q.id===doc.activeQuoteId);
    return {title:active?.title,revision:active?.revision,
      frozenTitle:active?.history?.[0]?.title,
      frozenTotal:active?.history?.[0]?.customerTotal};
  });
  expect(stored).toEqual({title:'New Island Draft',revision:1,frozenTitle:'Original Kitchen Version',frozenTotal:400});
});
