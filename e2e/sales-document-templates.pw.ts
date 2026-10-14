import {test,expect} from '@playwright/test';

async function library(page:import('@playwright/test').Page){
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-active-view-v1','quotes');
    localStorage.setItem('salesshop:quotes-mobile-beta-v1','1');
  });
  await page.reload();
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await expect(beta.getByRole('heading',{name:'Sales Documents'})).toBeVisible();
  return beta;
}
async function create(page:import('@playwright/test').Page,template:string,starting?:string){
  const beta=page.getByRole('main',{name:'Quotes mobile beta'});
  await beta.getByRole('button',{name:'+ New document'}).click();
  const dialog=page.getByRole('dialog',{name:'New Sales Document'});
  await dialog.getByRole('button',{name:new RegExp('^'+template)}).click();
  if(starting)await dialog.getByRole('button',{name:new RegExp(starting)}).click();
  await dialog.getByRole('button',{name:/Create document/}).click();
  await expect(dialog).not.toBeVisible();
  return beta;
}

test('document library creates independent Quick Quote and Builder Rate editors',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop new-template workflow');
  const beta=await library(page);
  await beta.getByRole('button',{name:'+ New document'}).click();
  const dialog=page.getByRole('dialog',{name:'New Sales Document'});
  await expect(dialog.getByRole('button',{name:/^Quick Quote/})).toContainText(/commercial projects/i);
  await expect(dialog.getByRole('button',{name:/^Multi-Family/})).toContainText(/wholesale/i);
  await dialog.getByRole('button',{name:/^Multi-Family/}).click();
  await expect(dialog).toContainText('cannot create a draft');
  await expect(dialog.getByRole('button',{name:/Create document/})).toHaveCount(0);
  await dialog.getByRole('button',{name:'← All templates'}).click();
  await dialog.getByRole('button',{name:/^Quick Quote/}).click();
  await dialog.getByRole('button',{name:/Create document/}).click();
  await expect(beta.getByRole('textbox',{name:'Quote title'})).toBeVisible();
  await expect(beta.getByRole('region',{name:'Pricing Schedule workspace'})).toHaveCount(0);
  await beta.getByRole('button',{name:/Documents/}).first().click();
  await create(page,'Builder Rate Schedule');
  await expect(beta.getByRole('region',{name:'Builder Rate Schedule editor'})).toBeVisible();
  await expect(beta.getByRole('region',{name:'Pricing Schedule workspace'})
    .getByText('Builder Rate Schedule')).toBeVisible();
  await expect(beta.getByRole('button',{name:/Plan Pricing|Spreadsheet/})).toHaveCount(0);
  await beta.getByRole('button',{name:/Documents/}).first().click();
  await expect(beta.getByRole('button',{name:/Builder Rate Schedule/}).first()).toBeVisible();
});

test('create new community from a previous builder rate agreement without making it live-linked',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop template copy flow');
  const beta=await library(page);
  await create(page,'Builder Rate Schedule');
  const editor=beta.getByRole('region',{name:'Builder Rate Schedule editor'});
  await editor.getByRole('button',{name:/Add material|\+ Material|material level/i}).first().click();
  await beta.getByRole('button',{name:/Documents/}).first().click();
  await beta.getByRole('button',{name:'+ New document'}).click();
  const dialog=page.getByRole('dialog',{name:'New Sales Document'});
  await dialog.getByRole('button',{name:/^Community Plan Pricing/}).click();
  await dialog.getByRole('button',{name:/Copy previous agreement/}).click();
  await dialog.getByRole('combobox',{name:'Previous agreement'}).selectOption({index:1});
  await dialog.getByRole('button',{name:/Create document/}).click();
  await expect(beta.getByRole('region',{name:'Community Plan Pricing editor'})).toBeVisible();
  await expect(beta.getByRole('navigation',{name:'Calculated builder workflow'})).toBeVisible();
  await expect(beta.getByRole('button',{name:/Spreadsheet/})).toHaveCount(0);
  await beta.getByRole('button',{name:/Documents/}).first().click();
  await beta.getByRole('button',{name:'Community Plan Pricing',exact:true}).click();
  await expect(beta.getByRole('heading',{name:'Sales Documents'})).toBeVisible();
  await expect(beta.locator('.qmb-listcard').filter({hasText:'New agreement'})).toBeVisible();
});

test('Custom Spreadsheet opens directly in isolated Univer editor',async({page},info)=>{
  test.skip(info.project.name!=='phone-390','Mobile template selection');
  const beta=await library(page);
  await create(page,'Custom Spreadsheet');
  const wrapper=beta.getByRole('region',{name:'Custom Spreadsheet editor'});
  await expect(wrapper).toBeVisible();
  await expect(beta.getByRole('region',{name:'Pricing Schedule workspace'})).toContainText('Custom Spreadsheet');
  await expect(beta.getByRole('navigation',{name:'Calculated builder workflow'})).toHaveCount(0);
  await expect(wrapper.getByRole('button',{name:'Import .xlsx'})).toBeVisible();
});

test('Builder Rate company template snapshots stock colors and approved level sell pricing',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Stock-level agreement creation');
  await page.goto('/');
  await page.evaluate(()=>{
    localStorage.setItem('salesshop-company-settings-v1',JSON.stringify({
      organizationName:'Test Company',
      stockMaterials:[
        {id:'granite-blue',name:'Azul Plata',materialType:'Granite',
          stockProgram:true,active:true,unit:'sf',internalCost:8},
        {id:'quartz-white',name:'Bright White',materialType:'Quartz',
          stockProgram:true,active:true,unit:'sf',internalCost:10},
        {id:'inactive',name:'Inactive color',materialType:'Granite',
          stockProgram:true,active:false,unit:'sf',internalCost:6},
      ],
    }));
    localStorage.setItem('salesshop-material-level-guide-v1',JSON.stringify({
      schemaVersion:3,id:'test-approved-levels',name:'Company Level Guide',
      updatedAt:'2026-10-14T00:00:00Z',
      slabPricingThresholdCostPerSf:23,slabPricingMultiplier:2.2,
      history:[],rules:[
        {id:'L0',label:'Level 0',maxMaterialCost:9,customerRate:34,
          active:true,graniteOnly:true},
        {id:'L1',label:'Level 1',maxMaterialCost:12,customerRate:44,active:true},
      ],
    }));
  });
  const beta=await library(page);
  await beta.getByRole('button',{name:'+ New document'}).click();
  const picker=page.getByRole('dialog',{name:'New Sales Document'});
  await picker.getByRole('button',{name:/^Builder Rate Schedule/}).click();
  const company=picker.getByRole('button',{name:/Company stock levels/});
  await expect(company).toBeEnabled();
  await expect(company).toContainText('2 stock colors');
  await expect(company).toContainText('2 priced level groups');
  await company.click();
  await picker.getByRole('button',{name:/Create document/}).click();
  const editor=beta.getByRole('region',{name:'Builder Rate Schedule editor'});
  const cards=editor.locator('.pricing-rate-level-card');
  await expect(cards).toHaveCount(2);
  await expect(editor.getByRole('region',{name:'Company stock level import summary'}))
    .toContainText('2 of 2 stocked colors');
  await expect(cards.nth(0)).toContainText('Level 0 Granite');
  await expect(cards.nth(0)).toContainText('$34.00 / SF');
  await expect(cards.nth(1)).toContainText('Level 1 Quartz');
  await expect(cards.nth(1)).toContainText('$44.00 / SF');
  await expect(cards.nth(0).locator('textarea')).toHaveValue('Azul Plata');
  await expect(cards.nth(1).locator('textarea')).toHaveValue('Bright White');
  await beta.getByRole('button',{name:/Documents/}).first().click();
  await expect(beta.locator('.qmb-listcard').filter({hasText:'Builder Rate Schedule'})).toBeVisible();
});
