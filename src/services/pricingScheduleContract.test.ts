import {describe,it,expect} from 'vitest';
import ExcelJS from 'exceljs';
import {importExcelPricingWorkbook} from './pricingSchedule';
import {
  calculateContractRow,contractPublishedPrice,contractScheduleHealth,
  deriveContractCustomerItems,parseContractPricingWorkbook,
} from './pricingScheduleContract';
import {buildContractPricingXlsx} from './pricingScheduleContractXlsx';
import {generateHouseConfigurations} from './pricingScheduleCombinations';
import type {PricingScheduleBuilderData} from '../types/quote';

async function exampleContract(){
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Table 1');
  sheet.getRow(2).getCell(8).value=25;
  [175,25,32,20,40].forEach((cost,i)=>{sheet.getCell(2,i+9).value=cost;});
  ['Spec Series','Base / Opt.','Plan  #','Plan Name','Option','Description',
    'Div.\nContract Pricing'].forEach((heading,i)=>{sheet.getCell(4,i+1).value=heading;});
  const fields=[
    // Series, type, plan, name, code, description, contract price, corbels,
    // kitchen sink, granite kitchen SF, quartz kitchen SF, bath SF, vanity bowls.
    ['DRH-e','Base',1183,'Sanford','R0000DRH','No backsplash kitchen',1285,null,1,30,null,14,2],
    ['Express','Base',1183,'Sanford','R0000EXP','4 inch backsplash kitchen',1435,null,1,36,null,14,2],
    ['DRH-e','Option',1183,'Sanford','R1800400','Quartz kitchen scope',960,null,null,-30,30,null,null],
    ['DRH-e','Base',1281,'Devon','R0000DRH','Base Devon',1660,3,1,42,null,14,2],
    ['DRH-e','Option',1281,'Devon','R1300045','Double sink owners bath',180,null,null,null,null,7,1],
  ];
  fields.forEach((values,row)=>{
    values.forEach((v,col)=>{if(v!==null)sheet.getCell(row+5,col+1).value=v;});
  });
  sheet.getCell('Q5').value=1;
  sheet.getCell('R5').value=30;
  sheet.getCell('U5').value='30"';
  sheet.getCell('W5').value=7;
  sheet.getCell('X5').value=1;
  sheet.getCell('AA5').value=7;
  sheet.getCell('AB5').value=1;
  sheet.getCell('T6').value=6;
  sheet.getCell('X6').value=1;
  sheet.getCell('W6').value=7;
  sheet.getCell('AB6').value=1;
  sheet.getCell('W9').value=7;
  sheet.getCell('X9').value=1;
  const bytes=new Uint8Array(await book.xlsx.writeBuffer() as ArrayBuffer);
  return new File([bytes],'test-DR-Horton.xlsx');
}

describe('Builder contract schedules from D.R. Horton-shaped spreadsheets',()=>{
  it('imports base/option lines, rates, multiple series and detailed vanities',async()=>{
    const file=await exampleContract();
    const workbook=await importExcelPricingWorkbook(file);
    const {rows,rates}=parseContractPricingWorkbook(workbook);
    expect(rows).toHaveLength(5);
    expect(rows.map(row=>row.planName)).toEqual(['Sanford','Sanford','Sanford','Devon','Devon']);
    expect(rates).toMatchObject({corbels:25,kitchenSinks:175,graniteKitchenSf:25,
      quartzKitchenSf:32,bathSf:20,bathBowls:40});
    expect(rows[0].sourceCells?.[23]).toBe(1);
    expect(rows[1].sourceCells?.[19]).toBe(6);
    expect(rows[2].quantities).toMatchObject({graniteKitchenSf:-30,quartzKitchenSf:30});
    expect(calculateContractRow(rows[0],rates).total).toBe(1285);
    expect(calculateContractRow(rows[1],rates).total).toBe(1435);
    expect(calculateContractRow(rows[2],rates).total).toBe(960);
    expect(calculateContractRow(rows[4],rates).total).toBe(180);
    const builder:PricingScheduleBuilderData={
      rateBookName:'D.R. Horton',plans:[],options:[],takeoffs:[],rates:[],
      outputMode:'contract',contractRows:rows,contractRates:rates,
    };
    expect(deriveContractCustomerItems(builder).map(item=>item.customerPrice))
      .toEqual([1285,1435,960,1660,180]);
    expect(contractScheduleHealth(builder)).toEqual([]);
    expect(contractPublishedPrice(rows[2],rates)).toBe(960);
  });

  it('generates 12 standalone Sanford prices, including bath-only splash and double owner sink',async()=>{
    const {rows,rates}=parseContractPricingWorkbook(await importExcelPricingWorkbook(await exampleContract()));
    const combos=generateHouseConfigurations(rows[0],6);
    expect(combos).toHaveLength(12);
    expect(combos.map(c=>c.optionCode)).toEqual([
      'CFG-A1','CFG-A2','CFG-B1','CFG-B2','CFG-C1','CFG-C2',
      'CFG-D1','CFG-D2','CFG-E1','CFG-E2','CFG-F1','CFG-F2',
    ]);
    expect(combos.every(c=>c.optionBehavior==='standalone')).toBe(true);
    expect(combos[0].quantities.graniteKitchenSf).toBe(36);
    expect(combos[2].quantities.graniteKitchenSf).toBe(30);
    expect(combos[1].quantities.bathBowls).toBe(3);
    expect(combos[0].sourceCells?.[23]).toBe(1);
    expect(combos[1].sourceCells?.[23]).toBe(2);
    expect(combos[2].sourceCells?.[19]).toBeNull();
    const configured={...rates,graniteBathSf:20,quartzBathSf:28};
    expect(calculateContractRow(combos[0],configured).total).toBe(1435);
    expect(calculateContractRow(combos[1],configured).total).toBe(1475);
    expect(calculateContractRow(combos[2],configured).total).toBe(1285);
    expect(calculateContractRow(combos[8],configured).total).toBe(1799);
    expect(calculateContractRow(combos[8],rates).missing).toContain('quartzBathSf');
  });

  it('exports an editable A:AN contract workbook and imports matching customer prices back',async()=>{
    const parsed=parseContractPricingWorkbook(await importExcelPricingWorkbook(await exampleContract()));
    const builder:PricingScheduleBuilderData={rateBookName:'Contract',plans:[],options:[],takeoffs:[],rates:[],
      outputMode:'contract',contractRows:parsed.rows,contractRates:parsed.rates};
    const exported=await buildContractPricingXlsx(builder);
    expect(exported.worksheets[0].getCell('G5').value).toBe(1285);
    expect(exported.worksheets[0].getCell('G7').value).toBe(960);
    expect(exported.worksheets[0].getCell('X5').value).toBe(1);
    expect(exported.worksheets[0].getCell('T6').value).toBe(6);
    const bytes=new Uint8Array(await exported.xlsx.writeBuffer() as ArrayBuffer);
    const roundtrip=parseContractPricingWorkbook(
      await importExcelPricingWorkbook(new File([bytes],'roundtrip.xlsx')));
    expect(roundtrip.rows).toHaveLength(5);
    expect(roundtrip.rows[2].quantities.graniteKitchenSf).toBe(-30);
    expect(roundtrip.rows[0].customerPrice).toBe(1285);
    expect(roundtrip.rows[4].customerPrice).toBe(180);
  });

  it('refuses to silently invent customer prices when advanced bathroom quartz rate is missing',async()=>{
    const {rows,rates}=parseContractPricingWorkbook(await importExcelPricingWorkbook(await exampleContract()));
    const generated=generateHouseConfigurations(rows[0],6);
    const builder:PricingScheduleBuilderData={
      outputMode:'contract',rateBookName:'Contract',plans:[],options:[],rates:[],takeoffs:[],
      contractRows:generated,contractRates:rates,
    };
    expect(contractScheduleHealth(builder).some(item=>item.includes('quartzBathSf'))).toBe(true);
    expect(deriveContractCustomerItems(builder).filter(item=>item.customerPrice===undefined))
      .toHaveLength(8);
  });
});
