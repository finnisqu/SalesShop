import {recordNameKey} from './recordNameKey';

export type ActivityCompanySelection={
 companyId?:string;
 stagedCompanyName?:string;
};
export type ActivityCompanyStageServices={
 companies:()=>readonly {id:string;name:string}[];
 resolveCompany:(name:string)=>string|undefined;
 /** Called as soon as a record exists, BEFORE any optional classification.
  * The caller keeps the created ID if later work fails, so retrying does not
  * create a second Company. */
 onCreated:(id:string)=>void;
 classifyNewCompany?:(id:string)=>void;
};

/** A picker "Create" choice is only a draft until the related Person/Deal is
 * submitted. Cancelling the Activity form before that point writes nothing. */
export function stageActivityCompanyName(raw:string,companies:readonly {name:string}[]):string{
 const name=raw.trim();
 if(!name)throw new Error('Enter a Company name.');
 if(companies.some(company=>recordNameKey(company.name)===recordNameKey(name)))
  throw new Error('That Company already exists. Select it from search.');
 return name;
}

/** Materialize the staged Company once the related record is being saved.
 * A resolved ID is stored by the caller before classification so failed
 * classification or child creation can retry against the same Company. */
export function resolveActivityCompanyStage(
 choice:ActivityCompanySelection,services:ActivityCompanyStageServices,
):string|undefined{
 const existingId=choice.companyId?.trim();
 const draft=choice.stagedCompanyName?.trim();
 if(existingId&&draft)throw new Error('Choose a Company or stage a new one, not both.');
 if(existingId){
  if(!services.companies().some(company=>company.id===existingId))
   throw new Error('Selected Company is no longer available. Choose it again.');
  return existingId;
 }
 if(!draft)return undefined;
 const name=stageActivityCompanyName(draft,services.companies());
 const before=new Set(services.companies().map(company=>company.id));
 const id=services.resolveCompany(name);
 if(!id||before.has(id))
  throw new Error('Could not create the Company. Select the existing Company instead.');
 services.onCreated(id);
 services.classifyNewCompany?.(id);
 return id;
}
