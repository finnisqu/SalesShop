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

type TestCell={v?:unknown;f?:string;s?:unknown};
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


describe('Pricing Schedule XLSX appearance parity',()=>{
  it('retains styled headers, currency formats, alignments, wraps and colored borders',async()=>{
    const {data,sheet}=fixture();
    sheet.cellData['0']['5']={
      v:'DESCRIPTION',
      s:{ff:'Arial',fs:13,bl:1,cl:{rgb:'#FFFFFF'},bg:{rgb:'#17324D'},
        ht:2,vt:2,tb:3,
        bd:{b:{s:8,cl:{rgb:'#204060'}}}},
    };
    sheet.cellData['1']={'5':{v:'Countertop'} ,'6':{
      v:2400,
      s:{n:{pattern:'"$"#,##0.00'},fs:11,it:1,cl:{rgb:'#006633'},
        bd:{t:{s:1,cl:{rgb:'#DDDDDD'}}}},
    }};
    // Number formats and style-only blank cells must not disappear.
    sheet.cellData['2']={'6':{s:{bg:{rgb:'#FFF2CC'}}}};
    const excel=await buildExcelPricingWorkbook(data);
    const bytes=new Uint8Array(await excel.xlsx.writeBuffer() as ArrayBuffer);
    const imported=await importExcelPricingWorkbook(new File([bytes],'styled.xlsx'));
    const id=pricingScheduleSheets(imported)[0].id;
    const model=(imported as unknown as {sheets:Record<string,TestSheet>}).sheets[id];
    expect(model.cellData['0']['5'].s).toMatchObject({
      ff:'Arial',fs:13,bl:1,cl:{rgb:'#FFFFFF'},bg:{rgb:'#17324D'},
      ht:2,vt:2,tb:3,bd:{b:{s:8,cl:{rgb:'#204060'}}},
    });
    expect(model.cellData['1']['6'].s).toMatchObject({
      n:{pattern:'"$"#,##0.00'},it:1,cl:{rgb:'#006633'},
      bd:{t:{s:1,cl:{rgb:'#DDDDDD'}}},
    });
    expect(model.cellData['2']['6'].s).toMatchObject({bg:{rgb:'#FFF2CC'}});
    const reexported=await buildExcelPricingWorkbook(imported);
    const header=reexported.worksheets[0].getCell('F1');
    expect(header.font).toMatchObject({name:'Arial',size:13,bold:true,
      color:{argb:'FFFFFFFF'}});
    expect(header.fill).toMatchObject({type:'pattern',pattern:'solid',
      fgColor:{argb:'FF17324D'}});
    expect(header.alignment).toMatchObject({horizontal:'center',vertical:'middle',wrapText:true});
    expect(header.border.bottom).toMatchObject({style:'medium',
      color:{argb:'FF204060'}});
    const price=reexported.worksheets[0].getCell('G2');
    expect(price.numFmt).toBe('"$"#,##0.00');
    expect(price.font).toMatchObject({italic:true,color:{argb:'FF006633'}});
    expect(reexported.worksheets[0].getCell('G3').fill)
      .toMatchObject({type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}});
  });

  it('resolves style IDs written by Univer back into XLSX',async()=>{
    const {data,sheet}=fixture();
    sheet.cellData['1']={'5':{v:'Quartz'},'6':{v:850,s:'currency-accent'}};
    (data as unknown as {styles:Record<string,unknown>}).styles={
      'currency-accent':{n:{pattern:'$#,##0.00'},bl:1,bg:{rgb:'#DAF4E7'}},
    };
    const excel=await buildExcelPricingWorkbook(data);
    const cell=excel.worksheets[0].getCell('G2');
    expect(cell.numFmt).toBe('$#,##0.00');
    expect(cell.font.bold).toBe(true);
    expect(cell.fill).toMatchObject({fgColor:{argb:'FFDAF4E7'}});
  });
});
