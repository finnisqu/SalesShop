import type {PricingScheduleBuilderData} from '../types/quote';
import {CONTRACT_COLUMNS,contractPublishedPrice} from './pricingScheduleContract';

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
  for(let i=0;i<(builder.contractRows??[]).length;i++){
    const row=builder.contractRows![i],n=i+5;
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
  }
  sheet.getRow(4).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(4).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF244560'}};
  sheet.getRow(4).height=34;
  [16,14,12,24,18,57,24].forEach((width,i)=>{sheet.getColumn(i+1).width=width;});
  sheet.views=[{state:'frozen',xSplit:4,ySplit:4}];
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
