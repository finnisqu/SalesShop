import {describe,expect,it} from 'vitest';
import {
  autoDetectPricingScheduleMapping,
  buildExcelPricingWorkbook,
  createBlankPricingScheduleWorkbook,
  derivePricingScheduleItems,
  importExcelPricingWorkbook,
  mergePricingScheduleData,
  pricingScheduleSheets,
  uncalculatedPricingFormulaRows,
  validatePricingScheduleForSend,
} from './pricingSchedule';

type TestCell={v?:unknown;f?:string};
type TestSheet={
  cellData:Record<string,Record<string,TestCell>>;
  columnData:Record<string,{w?:number}>;
  rowData:Record<string,{h?:number}>;
  mergeData:Array<{startRow:number;startColumn:number;endRow:number;endColumn:number}>;
};
function fixture(){
  const data=createBlankPricingScheduleWorkbook('qc');
  const sheetId=pricingScheduleSheets(data)[0].id;
  const sheet=(data as unknown as {sheets:Record<string,TestSheet>}).sheets[sheetId];
  const mapping={sheetId,headerRow:1,firstDataRow:2,
    columns:{description:5,customerPrice:6}};
  return {data,sheet,mapping};
}

describe('Pricing Schedule workbook correctness and Excel parity',()=>{
  it('does not publish an empty price as zero, but accepts explicit $0',()=>{
    const {data,sheet,mapping}=fixture();
    sheet.cellData['1']={'5':{v:'A-series countertop'},'6':{v:''}};
    sheet.cellData['2']={'5':{v:'No-charge sample'},'6':{v:0}};
    const rows=derivePricingScheduleItems(data,mapping);
    expect(rows.map(row=>row.customerPrice)).toEqual([undefined,0]);
    const schedule=mergePricingScheduleData('qc',undefined,{
      route:'workbook',publishSource:'workbook',workbookData:data,mapping,
    });
    expect(schedule.customerItems).toHaveLength(2);
    expect(()=>validatePricingScheduleForSend(schedule)).toThrow(/row.*2/i);
    sheet.cellData['1']['6']={v:725};
    const ready=mergePricingScheduleData('qc',schedule,{workbookData:data});
    expect(ready.customerItems[0].customerPrice).toBe(725);
    expect(()=>validatePricingScheduleForSend(ready)).not.toThrow();
  });

  it('flags formula cells without cached values instead of publishing $0',()=>{
    const {data,sheet,mapping}=fixture();
    sheet.cellData['1']={'5':{v:'Kitchen upgrade'},'6':{f:'=B2*D2'}};
    const schedule=mergePricingScheduleData('qc',undefined,{
      route:'workbook',publishSource:'workbook',workbookData:data,mapping,
    });
    expect(uncalculatedPricingFormulaRows(data,mapping)).toEqual([2]);
    expect(schedule.customerItems[0].customerPrice).toBeUndefined();
    expect(()=>validatePricingScheduleForSend(schedule)).toThrow(/row\(s\) 2.*no calculated result/i);
    sheet.cellData['1']['6'].v=1500;
    const recalculated=mergePricingScheduleData('qc',schedule,{workbookData:data});
    expect(uncalculatedPricingFormulaRows(data,mapping)).toEqual([]);
    expect(()=>validatePricingScheduleForSend(recalculated)).not.toThrow();
  });

  it('recognizes a focused two-column builder sheet without inventing other mappings',()=>{
    const {data,sheet}=fixture();
    sheet.cellData['0']={'0':{v:'Description'},'1':{v:'Customer Price'}};
    sheet.cellData['1']={'0':{v:'Quartz countertop'},'1':{v:1025}};
    const mapping=autoDetectPricingScheduleMapping(data);
    expect(mapping?.columns).toMatchObject({description:0,customerPrice:1});
    expect(derivePricingScheduleItems(data,mapping)[0].customerPrice).toBe(1025);
    sheet.cellData['0']={'0':{v:'Notes'},'1':{v:'Supplier Cost'}};
    expect(autoDetectPricingScheduleMapping(data)).toBeUndefined();
  });

  it('round-trips cached formulas, visible prices, sheet measurements and merges through Excel',async()=>{
    const {data,sheet,mapping}=fixture();
    sheet.cellData['1']={'0':{v:'A'},'5':{v:'Bathroom vanity'},'6':{f:'=50*12',v:600}};
    sheet.cellData['2']={'0':{v:'B'},'5':{v:'Kitchen'},'6':{v:2400}};
    sheet.rowData['1']={h:35};
    sheet.columnData['5']={w:210};
    sheet.mergeData.push({startRow:4,startColumn:8,endRow:4,endColumn:9});
    const excel=await buildExcelPricingWorkbook(data);
    const bytes=new Uint8Array(await excel.xlsx.writeBuffer() as ArrayBuffer);
    const file=new File([bytes],'builder-pricing.xlsx',{
      type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const imported=await importExcelPricingWorkbook(file);
    const importedId=pricingScheduleSheets(imported)[0].id;
    const importedSheet=(imported as unknown as {sheets:Record<string,TestSheet>}).sheets[importedId];
    expect(importedSheet.cellData['1']['6']).toMatchObject({f:'=50*12',v:600});
    expect(importedSheet.cellData['2']['6'].v).toBe(2400);
    expect(importedSheet.rowData['1'].h).toBe(35);
    expect(importedSheet.columnData['5'].w).toBeGreaterThanOrEqual(195);
    expect(importedSheet.mergeData).toContainEqual(
      {startRow:4,startColumn:8,endRow:4,endColumn:9});
    const remapped={...mapping,sheetId:importedId};
    const schedule=mergePricingScheduleData('qc',undefined,{
      route:'workbook',publishSource:'workbook',workbookData:imported,mapping:remapped,
    });
    expect(schedule.customerItems.map(item=>item.customerPrice)).toEqual([600,2400]);
    expect(()=>validatePricingScheduleForSend(schedule)).not.toThrow();
    const final=await buildExcelPricingWorkbook(imported);
    expect(final.worksheets[0].getCell('G2').value).toEqual({formula:'50*12',result:600});
    expect(final.worksheets[0].getRow(2).height).toBe(35);
  });
});
