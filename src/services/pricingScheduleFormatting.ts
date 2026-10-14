import type {Cell as ExcelCell} from 'exceljs';

/** Loss-conscious bridge for the Excel styles that Univer Sheets Core supports.
 * Do not claim parity for charts, macros, images, conditional formats or themes. */
export type PricingCellStyle={
  ff?:string;fs?:number;bl?:0|1;it?:0|1;
  ul?:{s:number};st?:{s:number};
  cl?:{rgb:string};bg?:{rgb:string};
  n?:{pattern:string};ht?:number;vt?:number;tb?:number;
  bd?:Record<string,{s:number;cl:{rgb:string}}>;
};
export type StyledPricingCell={s?:string|PricingCellStyle};

const excelBorderToUniver:Record<string,number>={
  thin:1,hair:2,dotted:3,dashed:4,dashDot:5,dashDotDot:6,
  double:7,medium:8,mediumDashed:9,mediumDashDot:10,
  mediumDashDotDot:11,slantDashDot:12,thick:13,
};
const univerBorderToExcel=Object.fromEntries(
  Object.entries(excelBorderToUniver).map(([name,id])=>[String(id),name]),
);
const edges=[['top','t'],['bottom','b'],['left','l'],['right','r']] as const;
const horizontal:Record<string,number>={left:1,center:2,right:3};
const vertical:Record<string,number>={top:1,middle:2,bottom:3};
const reverseHorizontal:Record<string,string>={1:'left',2:'center',3:'right'};
const reverseVertical:Record<string,string>={1:'top',2:'middle',3:'bottom'};

function rgbFromExcel(color:unknown){
  if(!color || typeof color!=='object')return;
  const raw=(color as {argb?:unknown}).argb;
  if(typeof raw!=='string')return;
  const normalized=raw.replace(/^#/,'').toUpperCase();
  if(!/^[0-9A-F]{6}([0-9A-F]{2})?$/.test(normalized))return;
  return '#'+normalized.slice(-6);
}
function excelColor(rgb:string){
  const hex=rgb.replace(/^#/,'').toUpperCase();
  return {argb:'FF'+hex.slice(-6)};
}
function formatted(style:PricingCellStyle){
  return Object.keys(style).length?style:undefined;
}

export function excelCellStyleToPricing(cell:ExcelCell):PricingCellStyle|undefined{
  const style:PricingCellStyle={};
  const font=cell.font;
  if(font?.name)style.ff=font.name;
  if(font?.size)style.fs=font.size;
  if(font?.bold)style.bl=1;
  if(font?.italic)style.it=1;
  if(font?.underline)style.ul={s:1};
  if(font?.strike)style.st={s:1};
  const foreground=rgbFromExcel(font?.color);
  if(foreground)style.cl={rgb:foreground};
  const fill=cell.fill;
  if(fill?.type==='pattern'&&fill.pattern==='solid'){
    const color=rgbFromExcel(fill.fgColor);
    if(color)style.bg={rgb:color};
  }
  if(cell.numFmt&&cell.numFmt!=='General')style.n={pattern:cell.numFmt};
  if(cell.alignment?.horizontal && horizontal[cell.alignment.horizontal])
    style.ht=horizontal[cell.alignment.horizontal];
  if(cell.alignment?.vertical && vertical[cell.alignment.vertical])
    style.vt=vertical[cell.alignment.vertical];
  if(cell.alignment?.wrapText)style.tb=3;
  const borders:NonNullable<PricingCellStyle['bd']>={};
  for(const [from,to] of edges){
    const edge=cell.border?.[from];
    const kind=edge?.style&&excelBorderToUniver[edge.style];
    if(kind)borders[to]={s:kind,cl:{rgb:rgbFromExcel(edge?.color)??'#000000'}};
  }
  if(Object.keys(borders).length)style.bd=borders;
  return formatted(style);
}

export function resolvedPricingCellStyle(
  cell:StyledPricingCell,styles?:Record<string,PricingCellStyle>,
):PricingCellStyle|undefined{
  if(!cell.s)return;
  return typeof cell.s==='string'?styles?.[cell.s]:cell.s;
}

export function applyPricingStyleToExcel(cell:ExcelCell,style?:PricingCellStyle){
  if(!style)return;
  const font:Record<string,unknown>={};
  if(style.ff)font.name=style.ff;
  if(style.fs)font.size=style.fs;
  if(style.bl!==undefined)font.bold=style.bl===1;
  if(style.it!==undefined)font.italic=style.it===1;
  if(style.ul)font.underline=style.ul.s===1;
  if(style.st)font.strike=style.st.s===1;
  if(style.cl?.rgb)font.color=excelColor(style.cl.rgb);
  if(Object.keys(font).length)cell.font=font as ExcelCell['font'];

  if(style.bg?.rgb)cell.fill={
    type:'pattern',pattern:'solid',fgColor:excelColor(style.bg.rgb),
  };
  if(style.n?.pattern)cell.numFmt=style.n.pattern;

  const alignment:Record<string,unknown>={};
  if(style.ht!==undefined&&reverseHorizontal[String(style.ht)])
    alignment.horizontal=reverseHorizontal[String(style.ht)];
  if(style.vt!==undefined&&reverseVertical[String(style.vt)])
    alignment.vertical=reverseVertical[String(style.vt)];
  if(style.tb!==undefined)alignment.wrapText=style.tb===3;
  if(Object.keys(alignment).length)cell.alignment=alignment as ExcelCell['alignment'];

  if(style.bd){
    const borders:Record<string,unknown>={};
    for(const [name,key] of edges){
      const border=style.bd[key];
      const line=border&&univerBorderToExcel[String(border.s)];
      if(line)borders[name]={style:line,color:excelColor(border.cl.rgb)};
    }
    if(Object.keys(borders).length)cell.border=borders as ExcelCell['border'];
  }
}
