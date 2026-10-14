import type {PricingScheduleBuilderData} from '../types/quote';
import {activeContractRows,CONTRACT_COLUMNS,contractPublishedPrice} from './pricingScheduleContract';
import {effectiveManualAddonRate,manualAddonOffered,manualAddonRows} from './pricingScheduleManual';

const HEADERS=[
  'Spec Series','Base / Opt.','Plan  #','Plan Name','Option','Description',
  'Div.\nContract Pricing','Corbels','Kitchen Sink','Granite Kitchen Tops - ALL',
  'Quartz Kitchen Tops - ALL','Bath Tops - ALL','Bath Bowls - ALL','',
  '.','Corbels','Kitchen Sink','Kitchen Top - Perimeter','Kitchen Top - Island','4" Back Splash',
  'Bath #1 Vanity Size','Splash Sides','Top SF','Bowls',
  'Bath #2 Vanity Size','Splash Sides','Top SF','Bowls',
  'Bath #3 Vanity Size','Splash Sides','Top SF','Bowls',
  'Bath #4 Vanity Size','Splash Sides','Top SF','Bowls',
  'Granite Bath SF','Quartz Bath SF','Kitchen Splash SF','Bath Splash SF',
];
export async function buildContractPricingXlsx(builder:PricingScheduleBuilderData){
  const ExcelJS=await import('exceljs');
  const excel=new ExcelJS.Workbook(),sheet=excel.addWorksheet('Contract Pricing');
  sheet.getCell('G1').value='CONTRACT PRICING · BASE HOUSES AND INDEPENDENT OPTIONS';
  sheet.getCell('P2').value='PLAN TAKEOFFS · CUSTOMER PRICES IN COLUMN G';
  const rates=builder.contractRates??{};
  CONTRACT_COLUMNS.forEach((key,i)=>{
    const column=i<6?i+8:i+31;
    if(rates[key]!==undefined)sheet.getCell(2,column).value=rates[key];
  });
  HEADERS.forEach((heading,i)=>{if(heading)sheet.getCell(4,i+1).value=heading;});
  sheet.getCell('AO4').value='Option Pricing Behavior';
  sheet.getCell('AP4').value='Customer Price Source';
  // A:AN retains the original contract columns; AO:AP makes replacement
  // versus additional charges explicit instead of inviting double billing.
  const entries=[...activeContractRows(builder),...manualAddonRows(builder)];
  for(let i=0;i<entries.length;i++){
    const row=entries[i],n=i+5;
    // Preserve plan-level physical details even though only seven columns
    // are published to the contractual customer pricing schedule.
    row.sourceCells?.slice(13,36).forEach((cell,k)=>{
      if(cell!==null&&cell!==undefined)sheet.getCell(n,k+14).value=cell;
    });
    const values=[
      row.series,row.itemType,row.planNumber,row.planName,row.optionCode,
      row.description,contractPublishedPrice(row,rates),
    ];
    values.forEach((v,c)=>{if(v!==undefined)sheet.getCell(n,c+1).value=v;});
    CONTRACT_COLUMNS.forEach((key,k)=>{
      const qty=row.quantities[key],column=k<6?k+8:k+31;
      if(qty!==undefined)sheet.getCell(n,column).value=qty;
    });
    sheet.getCell(n,7).numFmt='"$"#,##0.00';
    sheet.getCell(n,41).value=row.optionBehavior==='increment'?'Additional charge':'Standalone / replacement price';
    sheet.getCell(n,42).value=row.priceMode==='calculated'?'Calculated from rates':'Approved / entered';
  }
  sheet.getRow(4).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(4).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF244560'}};
  sheet.getRow(4).height=34;
  [16,14,12,24,18,57,24].forEach((width,i)=>{sheet.getColumn(i+1).width=width;});
  sheet.getColumn(41).width=29;
  sheet.getColumn(42).width=25;
  sheet.views=[{state:'frozen',xSplit:4,ySplit:4}];
  if((builder.manualAddons??[]).length){
    const addonSheet=excel.addWorksheet('Add-on Rate Book');
    const header=['Code','Add-on','Unit','Pricing behavior','Default rate',
      ...(builder.manualPlans??[]).map(p=>p.name+(p.planNumber?' · '+p.planNumber:''))];
    addonSheet.addRow(['INTERNAL ADD-ON RATE BOOK · Plan overrides win over defaults']);
    addonSheet.addRow(header);
    (builder.manualAddons??[]).forEach(addon=>{
      const values=[
        addon.code,addon.name,addon.unit,
        addon.behavior==='increment'?'Additional charge':'Standalone / replacement',
        addon.defaultRate??null,
        ...(builder.manualPlans??[]).map(plan=>
          manualAddonOffered(addon,plan.id)?(effectiveManualAddonRate(addon,plan.id)??null):'Not offered'),
      ];
      addonSheet.addRow(values);
    });
    addonSheet.getRow(2).font={bold:true,color:{argb:'FFFFFFFF'}};
    addonSheet.getRow(2).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF244560'}};
    addonSheet.getColumn(1).width=20;
    addonSheet.getColumn(2).width=34;
    addonSheet.getColumn(3).width=12;
    addonSheet.getColumn(4).width=27;
    addonSheet.getColumn(5).width=18;
    for(let i=6;i<=header.length;i++)addonSheet.getColumn(i).width=25;
    addonSheet.views=[{state:'frozen',xSplit:2,ySplit:2}];
    addonSheet.getColumn(5).numFmt='"$"#,##0.00';
    for(let i=6;i<=header.length;i++)addonSheet.getColumn(i).numFmt='"$"#,##0.00';
  }
  return excel;
}
export async function downloadContractPricingXlsx(builder:PricingScheduleBuilderData,filename='builder-contract-schedule.xlsx'){
  const workbook=await buildContractPricingXlsx(builder);
  const buffer=await workbook.xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([buffer as unknown as BlobPart],{
    type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const link=document.createElement('a');
  link.href=url;link.download=filename.replace(/\.xlsx$/i,'')+'.xlsx';link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),0);
}
