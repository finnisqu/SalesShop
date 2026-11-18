/** #385 — Review-first CSV/Excel CRM import. No file bytes or raw rows
 * are persisted; no custom field value publishing or CRM write occurs here. */
import {PROJECT_STAGES,DEAL_PIPELINES,type Company,type Contact,type Project,
 type ProjectStage,type DealPipeline,type CompanyKind} from '../types/crm';
import {normalizeCompanyIdentity,normalizeCompanyLooseIdentity,normalizeEmail,
 normalizePersonName,normalizePhone} from './crmIdentity';

export type CrmImportKind='company'|'person'|'deal';
export type CrmImportField='name'|'kind'|'email'|'phone'|'title'|'company'|
 'stage'|'pipeline'|'amount'|'dueDate'|'nextAction';
export type CrmImportMapping=Partial<Record<CrmImportField,number>>;
export interface CrmImportTable{headers:string[];rows:string[][];sheetName:string}
export interface CrmImportFieldSpec{
 id:CrmImportField;label:string;required?:boolean;aliases:readonly string[];
}
export const MAX_CRM_IMPORT_BYTES=2_000_000;
export const MAX_CRM_IMPORT_ROWS=500;
export const MAX_CRM_IMPORT_COLUMNS=50;
export const CRM_IMPORT_FIELDS:Record<CrmImportKind,readonly CrmImportFieldSpec[]>={
 company:[
  {id:'name',label:'Company name',required:true,aliases:['company','company name','account','account name','organization','organization name','business','business name','name']},
  {id:'kind',label:'Customer classification',aliases:['customer classification','classification','company type','customer type','type','kind','status']},
 ],
 person:[
  {id:'name',label:'Person name',required:true,aliases:['name','full name','contact','contact name','person','person name']},
  {id:'email',label:'Email',aliases:['email','email address','e-mail','e-mail address','contact email']},
  {id:'phone',label:'Phone',aliases:['phone','phone number','telephone','mobile','cell','contact phone']},
  {id:'title',label:'Job title',aliases:['title','position','job title','role']},
  {id:'company',label:'Linked Company name',aliases:['linked company name','linked company','company','company name','account','account name','organization','employer','business']},
 ],
 deal:[
  {id:'name',label:'Deal name',required:true,aliases:['name','deal','deal name','opportunity','opportunity name','project','project name']},
  {id:'company',label:'Linked Company name',aliases:['linked company name','linked company','company','company name','account','account name','organization','customer']},
  {id:'stage',label:'Deal stage',aliases:['stage','deal stage','sales stage','opportunity stage']},
  {id:'pipeline',label:'Pipeline',aliases:['pipeline','sales pipeline','deal pipeline']},
  {id:'amount',label:'Amount',aliases:['amount','value','deal value','project value','estimated amount','contract amount']},
  {id:'dueDate',label:'Due date',aliases:['due date','bid due','bid due date','deadline','target date']},
  {id:'nextAction',label:'Next action',aliases:['next action','next step','follow up','follow-up']},
 ],
};
const normHeader=(name:string)=>name.trim().toLowerCase().replace(/[_-]+/g,' ')
 .replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ');
const clean=(value:string|undefined)=>String(value??'').trim();
const good=(text:string,max=180)=>text.length>0&&text.length<=max&&
 !/[\u0000-\u001f<>]/.test(text);
export function detectCrmImportMapping(
 kind:CrmImportKind,headers:readonly string[],
):CrmImportMapping{
 const mapping:CrmImportMapping={},used=new Set<number>();
 for(const field of CRM_IMPORT_FIELDS[kind]){
  const candidates=headers.map((header,i)=>({header:normHeader(header),i}));
  const exact=candidates.find(candidate=>!used.has(candidate.i)&&
   field.aliases.some(alias=>normHeader(alias)===candidate.header));
  if(exact){mapping[field.id]=exact.i;used.add(exact.i);}
 }
 return mapping;
}
export function parseCrmCsv(content:string):CrmImportTable{
 if(content.length>MAX_CRM_IMPORT_BYTES)throw new Error('CSV exceeds the 2 MB limit.');
 const input=content.replace(/^\uFEFF/,'');
 const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'){
   if(quoted&&input[i+1]==='"'){cell+='"';i++;continue;}
   if(!quoted&&cell.length>0)throw new Error('Invalid CSV quotation near row '+(rows.length+1)+'.');
   quoted=!quoted;continue;
  }
  if(!quoted&&(c===','||c==='\r'||c==='\n')){
   row.push(cell.trim());cell='';
   if(row.length>MAX_CRM_IMPORT_COLUMNS)throw new Error('File has too many columns.');
   if(c!==','){
    if(c==='\r'&&input[i+1]==='\n')i++;
    if(row.some(Boolean))rows.push(row);
    row=[];
    if(rows.length>MAX_CRM_IMPORT_ROWS+1)throw new Error('File exceeds 500 data rows.');
   }
   continue;
  }
  cell+=c;
  if(cell.length>5000)throw new Error('A file cell exceeds 5,000 characters.');
 }
 if(quoted)throw new Error('CSV has an unclosed quoted value.');
 row.push(cell.trim());
 if(row.some(Boolean))rows.push(row);
 return buildCrmImportTable(rows,'CSV');
}
export function buildCrmImportTable(rows:unknown[][],sheetName:string):CrmImportTable{
 if(!rows.length)throw new Error('The file is empty.');
 if(rows.length-1>MAX_CRM_IMPORT_ROWS)throw new Error('File exceeds 500 data rows.');
 const maxWidth=Math.max(...rows.map(row=>row.length));
 if(maxWidth>MAX_CRM_IMPORT_COLUMNS)throw new Error('File exceeds 50 columns.');
 const headers=rows[0].map(value=>clean(value==null?'':String(value)));
 if(!headers.length||!headers.some(Boolean))throw new Error('The file needs a header row.');
 // Reject data beyond the header width rather than silently dropping it.
 if(rows.slice(1).some(row=>row.slice(headers.length).some(value=>
  clean(value===undefined||value===null?'':String(value)).length>0)))
  throw new Error('Some rows contain values beyond the header columns.');
 const normalized=headers.map(normHeader).filter(Boolean);
 if(new Set(normalized).size!==normalized.length)
  throw new Error('Duplicate column names. Rename them in the source file first.');
 const cleanRows=rows.slice(1).map(row=>headers.map((_,i)=>clean(
  row[i]===undefined||row[i]===null?'':String(row[i])))).filter(row=>row.some(Boolean));
 if(!cleanRows.length)throw new Error('The file has no data rows.');
 if(cleanRows.some(row=>row.some(cell=>cell.length>5000)))
  throw new Error('A file cell exceeds 5,000 characters.');
 return {headers,rows:cleanRows,sheetName};
}
/** Lazy-load the existing XLSX dependency only when Excel is selected. */
export async function readCrmImportFile(file:File,sheetIndex=0):Promise<{
 table:CrmImportTable;sheetNames:string[];
}>{
 if(file.size>MAX_CRM_IMPORT_BYTES)throw new Error('File exceeds 2 MB. Split it into smaller imports.');
 const lower=file.name.toLowerCase();
 if(lower.endsWith('.csv')){
  return {table:parseCrmCsv(await file.text()),sheetNames:['CSV']};
 }
 if(!/\.(xlsx|xls)$/.test(lower))
  throw new Error('Choose a CSV, XLSX or XLS file.');
 const XLSX=await import('xlsx');
 const workbook=XLSX.read(await file.arrayBuffer(),{
  type:'array',cellFormula:false,cellHTML:false,cellStyles:false,bookVBA:false,
  sheetRows:MAX_CRM_IMPORT_ROWS+2,
 });
 if(!workbook.SheetNames.length)throw new Error('Workbook contains no worksheets.');
 if(sheetIndex<0||sheetIndex>=workbook.SheetNames.length)
  throw new Error('Choose a valid worksheet.');
 const sheetName=workbook.SheetNames[sheetIndex];
 const values=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName],{
  header:1,blankrows:false,defval:'',raw:false,
 }) as unknown[][];
 return {table:buildCrmImportTable(values,sheetName),sheetNames:workbook.SheetNames};
}
export type CrmImportStatus='ready'|'existing'|'review';
export interface CrmImportedValues{
 name:string;kind?:CompanyKind;companyId?:string;companyName?:string;
 email?:string;phone?:string;title?:string;stage?:ProjectStage;
 pipeline?:DealPipeline;amount?:number;dueDate?:string;nextAction?:string;
}
export interface CrmImportCandidate{
 index:number;status:CrmImportStatus;reason:string;values:CrmImportedValues;
}
export interface CrmImportPreview{
 candidates:CrmImportCandidate[];counts:Record<CrmImportStatus,number>;
 errors:string[];mapping:CrmImportMapping;
}
export type CrmImportSnapshot={companies:readonly Company[];people:readonly Contact[];deals:readonly Project[]};
function mapped(row:readonly string[],mapping:CrmImportMapping,id:CrmImportField){
 const col=mapping[id];return col===undefined?'':clean(row[col]);
}
function parseMoney(v:string):number|undefined|null{
 if(!v)return undefined;
 const value=v.replace(/[$,\s]/g,'');
 if(!/^\d+(?:\.\d{1,2})?$/.test(value))return null;
 const amount=Number(value);
 return Number.isFinite(amount)&&amount<=1_000_000_000?amount:null;
}
function parseDate(v:string):string|null|undefined{
 if(!v)return undefined;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;
 const d=new Date(v+'T12:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v?v:null;
}
function classify(v:string):CompanyKind|undefined|null{
 if(!v)return undefined;
 if(['customer','client','active','prospect'].includes(v.toLowerCase()))return 'customer';
 if(['non-customer','noncustomer','partner','vendor','supplier'].includes(v.toLowerCase()))return 'non-customer';
 return null;
}
function resolveCompanyLink(companies:readonly Company[],name:string):{
 id?:string;name?:string;issue?:string;
}{
 if(!name)return {};
 const normal=normalizeCompanyIdentity(name);
 const exact=companies.filter(company=>
  [company.name,...(company.aliases??[])].some(alias=>normalizeCompanyIdentity(alias)===normal));
 if(exact.length===1)return {id:exact[0].id,name:exact[0].name};
 if(exact.length>1)return {issue:'Several Companies match this name; choose a unique Company name.'};
 const loose=normalizeCompanyLooseIdentity(name);
 if(companies.some(company=>normalizeCompanyLooseIdentity(company.name)===loose))
  return {issue:'Similar Company name found; review possible duplicate before linking.'};
 return {issue:'Company not found. Import or create that Company first.'};
}
export function previewCrmImport(
 kind:CrmImportKind,table:CrmImportTable,mapping:CrmImportMapping,snapshot:CrmImportSnapshot,
):CrmImportPreview{
 const errors:string[]=[];
 const selected=CRM_IMPORT_FIELDS[kind];
 const columns=selected.map(field=>mapping[field.id]).filter((n):n is number=>n!==undefined);
 if(columns.some(n=>!Number.isInteger(n)||n<0||n>=table.headers.length))
  errors.push('A mapping points to a missing column.');
 if(new Set(columns).size!==columns.length)
  errors.push('One source column cannot map to multiple fields.');
 if(mapping.name===undefined)errors.push('Map the required Name column.');
 if(errors.length)return {candidates:[],counts:{ready:0,existing:0,review:0},errors,mapping};
 const previously=new Set<string>();
 const candidates=table.rows.map((row,index):CrmImportCandidate=>{
  const name=mapped(row,mapping,'name');
  const values:CrmImportedValues={name};
  const flag=(reason:string):CrmImportCandidate=>({index,status:'review',reason,values});
  const found=(reason:string):CrmImportCandidate=>({index,status:'existing',reason,values});
  if(!good(name,160))return flag('Name is required (up to 160 characters, no markup).');
  const canonical=kind==='company'?normalizeCompanyIdentity(name):normalizePersonName(name);
  if(!canonical)return flag('Name contains no searchable characters.');
  if(kind==='company'){
   const companyType=classify(mapped(row,mapping,'kind'));
   if(companyType===null)return flag('Unknown classification; use Customer or Non-Customer.');
   values.kind=companyType??'customer';
   const exact=snapshot.companies.filter(c=>
    [c.name,...(c.aliases??[])].some(alias=>normalizeCompanyIdentity(alias)===canonical));
   if(exact.length===1)return found('Company already exists (name or alias). No overwrites.');
   if(exact.length>1)return flag('Multiple existing Companies share this name.');
   const loose=normalizeCompanyLooseIdentity(name);
   if(snapshot.companies.some(c=>normalizeCompanyLooseIdentity(c.name)===loose))
    return flag('Similar Company already exists. Review before creating.');
   if(previously.has(canonical))return flag('Repeated Company in this file.');
   previously.add(canonical);
   return {index,status:'ready',reason:'Create new Company',values};
  }
  const companyName=mapped(row,mapping,'company');
  const company=resolveCompanyLink(snapshot.companies,companyName);
  if(company.issue)return flag(company.issue);
  if(company.id){values.companyId=company.id;values.companyName=company.name;}
  if(kind==='person'){
   const email=mapped(row,mapping,'email').toLowerCase(),
    phone=mapped(row,mapping,'phone'),title=mapped(row,mapping,'title');
   if(email&&(!good(email,180)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    return flag('Email address is invalid.');
   if(phone&&(!good(phone,60)||normalizePhone(phone)===undefined))
    return flag('Phone must contain at least seven digits.');
   if(title&&!good(title,120))return flag('Job title is too long or invalid.');
   values.email=email||undefined;values.phone=phone||undefined;values.title=title||undefined;
   const contactKey=email?'email:'+normalizeEmail(email):'name:'+canonical+
    ':company:'+(company.id??'unlinked');
   if(previously.has(contactKey))return flag('Repeated Person in this file.');
   const matches=snapshot.people.filter(p=>email&&normalizeEmail(p.email)===email||
    !email&&normalizePersonName(p.name)===canonical&&
    (company.id?p.companyId===company.id:!p.companyId));
   // A name alone is not sufficient proof that two People are identical,
   // even when they belong to the same Company. Preserve the ambiguity.
   if(!email&&snapshot.people.some(p=>normalizePersonName(p.name)===canonical))
    return flag('Person with same name exists; add an email or review first.');
   if(matches.length===1)return found('Person already exists. No overwrites.');
   if(matches.length>1)return flag('Several existing People match; review manually.');
   previously.add(contactKey);
   return {index,status:'ready',reason:'Create new Person'+(company.id?' linked to Company':''),values};
  }
  const rawStage=mapped(row,mapping,'stage'),rawPipeline=mapped(row,mapping,'pipeline'),
    rawAmount=mapped(row,mapping,'amount'),rawDate=mapped(row,mapping,'dueDate'),
    nextAction=mapped(row,mapping,'nextAction');
  const stage=rawStage?PROJECT_STAGES.find(s=>s.toLowerCase()===rawStage.toLowerCase()):'Discovery';
  if(!stage)return flag('Unrecognized Deal stage; select a valid SalesShop stage.');
  const pipeline=rawPipeline?DEAL_PIPELINES.find(p=>
   [p.id,p.label].some(x=>x.toLowerCase()===rawPipeline.toLowerCase()))?.id:undefined;
  if(rawPipeline&&!pipeline)return flag('Unrecognized Pipeline; use Residential, Commercial or Multifamily.');
  const amount=parseMoney(rawAmount),dueDate=parseDate(rawDate);
  if(amount===null)return flag('Amount must be a nonnegative number (up to $1 billion).');
  if(dueDate===null)return flag('Due date must be YYYY-MM-DD.');
  if(nextAction&&!good(nextAction,240))return flag('Next action exceeds 240 characters or includes markup.');
  Object.assign(values,{stage,pipeline,amount,dueDate,nextAction:nextAction||undefined});
  const dealKey=canonical+':'+(company.id??'unlinked')+':'+(pipeline??'none');
  if(previously.has(dealKey))return flag('Repeated Deal in this file.');
  const matches=snapshot.deals.filter(d=>normalizePersonName(d.name)===canonical&&
   d.companyId===company.id&&d.pipeline===pipeline);
  if(matches.length)return found('A Deal with this name, Company and pipeline already exists.');
  if(snapshot.deals.some(d=>normalizePersonName(d.name)===canonical&&d.companyId===company.id))
   return flag('Similar Deal already exists with a different pipeline.');
  previously.add(dealKey);
  return {index,status:'ready',reason:'Create new Deal'+(company.id?' linked to Company':''),values};
 });
 const counts={ready:0,existing:0,review:0};
 candidates.forEach(row=>{counts[row.status]++;});
 return {candidates,counts,errors,mapping};
}
