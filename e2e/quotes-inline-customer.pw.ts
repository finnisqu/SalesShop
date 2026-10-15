import {test,expect} from '@playwright/test';

test('Quick Quote customer chip edits name, contact and email without navigation',async({page},info)=>{
  test.skip(!['phone-390','desktop-1280'].includes(info.project.name),
    'Focused phone and desktop customer flow');
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
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
  await picker.getByRole('textbox',{name:'Quote name'}).fill('Taylor Kitchen Proposal');
  await picker.getByRole('button',{name:/Create document/}).click();
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toHaveValue('Taylor Kitchen Proposal');

  const customer=beta.getByRole('button',{name:'Quick edit quote customer'});
  await expect(customer).toContainText('Assign a customer');
  await customer.click();
  let editor=page.getByRole('dialog',{name:'Quick customer details'});
  await expect(editor).toBeVisible();
  await editor.getByRole('textbox',{name:'Company / customer'}).fill('Taylor Residence');
  await editor.getByRole('textbox',{name:'Contact person'}).fill('Taylor Customer');
  await editor.getByRole('textbox',{name:'Contact email'}).fill('taylor@example.com');
  await editor.getByRole('button',{name:'Done · Continue quote'}).click();
  await expect(editor).toHaveCount(0);
  await expect(customer).toContainText('Taylor Residence');
  await expect(customer).toContainText('Taylor Customer');
  await expect(beta.getByRole('navigation',{name:'Quote views'})
    .getByRole('button',{name:'Build'})).toHaveAttribute('aria-current','page');
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toHaveValue('Taylor Kitchen Proposal');

  await beta.getByRole('button',{name:'+ Add Area'}).click();
  await expect(beta.getByRole('textbox',{name:'Area name'})).toBeVisible();
  await beta.getByRole('button',{name:/Done · Quote/}).click();
  await expect(customer).toContainText('Taylor Residence');

  await customer.click();
  editor=page.getByRole('dialog',{name:'Quick customer details'});
  await expect(editor.getByRole('textbox',{name:'Contact email'})).toHaveValue('taylor@example.com');
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);

  await customer.click();
  await page.getByRole('dialog',{name:'Quick customer details'})
    .getByRole('button',{name:'More project details'}).click();
  await expect(beta.getByRole('navigation',{name:'Quote views'})
    .getByRole('button',{name:'Details'})).toHaveAttribute('aria-current','page');
  await expect(beta.getByRole('region',{name:'Quote customer and project details'})).toBeVisible();
  expect(errors).toEqual([]);
});
