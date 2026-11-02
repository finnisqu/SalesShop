import {test,expect} from '@playwright/test';

for(const device of ['phone-390','desktop-1280']){
  test('Quick Quote Details is a slim keyboard-accessible 3-section form — '+device,
    async({page},info)=>{
    test.skip(info.project.name!==device,'Run on representative phone and desktop');
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
    await picker.getByRole('textbox',{name:'Quote name'}).fill('Slim Details QC');
    await picker.getByRole('button',{name:/Create document/}).click();
    const form=beta.getByRole('region',{name:'Quote customer and deal details'});
    const cards=form.locator(':scope > .qmb-details-section');
    await expect(cards).toHaveCount(3);
    const boxes=await cards.evaluateAll(cards=>cards.map(card=>{
      const r=card.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,bottom:r.bottom};
    }));
    expect(boxes.every(b=>b.width<=432)).toBe(true);
    expect(boxes[1].y).toBeGreaterThan(boxes[0].bottom-1);
    expect(boxes[2].y).toBeGreaterThan(boxes[1].bottom-1);
    await expect(form.locator('.qmb-details-next')).toHaveCount(0);
    await expect(form.getByRole('region',{name:'Quote document and history'})).toHaveCount(0);
    await form.getByText('Advanced',{exact:false}).first().click();
    await expect(form.getByRole('region',{name:'Quote document and history'})).toBeVisible();
    await expect(form.getByRole('textbox',{name:'Find existing CRM deal (optional)'})).toBeVisible();
    const address=form.getByRole('textbox',{name:'Job address'});
    await address.fill('Example jobsite');
    await address.press('Enter');
    await expect(form.getByRole('combobox',{name:'Division / pricing'})).toBeFocused();
    await expect(beta.getByRole('button',{name:'Classic',exact:true})).toHaveCount(0);
    await expect(beta.getByRole('button',{name:/Start first Area/})).toBeVisible();
  });
}
