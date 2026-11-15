import {recordNameKey} from './recordNameKey';

export interface ExternalQuoteCompanyChoice{
 companyId?:string;
 newCompanyName?:string;
}
export interface ExternalQuoteDealCreateServices{
 deals:()=>readonly {id:string;name:string}[];
 companies:()=>readonly {id:string;name:string}[];
 createDeal:(name:string)=>string|null;
 resolveCompany:(name:string)=>string|undefined;
 assignCompany:(dealId:string,companyId:string)=>void;
 afterNewCompany?:(companyId:string)=>void;
}
export interface ExternalQuoteCompanyLinkRecovery{
 dealId:string;
 companyId?:string;
 newCompanyName?:string;
 message:string;
}

/** Reject invalid or ambiguous selections before creating a Deal.
 * An external Quote must not create an unrelated Deal on a failing form. */
function validateCompanyChoice(choice:ExternalQuoteCompanyChoice,services:ExternalQuoteDealCreateServices){
 const id=choice.companyId?.trim();
 const name=choice.newCompanyName?.trim();
 if(id&&name)throw new Error('Choose an existing Company or enter a new one, not both.');
 if(id&&!services.companies().some(company=>company.id===id))
  throw new Error('Selected Company is no longer available. Choose it again.');
 if(name&&services.companies().some(company=>recordNameKey(company.name)===recordNameKey(name)))
  throw new Error('That Company already exists. Choose it from search instead.');
}
/** Link a Company to an existing Deal. If the Deal has already been created,
 * keep its ID and a retryable company target on any subsequent failure. */
export function linkExternalQuoteDealCompany(
 dealId:string,choice:ExternalQuoteCompanyChoice,services:ExternalQuoteDealCreateServices,
):ExternalQuoteCompanyLinkRecovery|null{
 let companyId=choice.companyId?.trim()||undefined;
 let newCompanyName=choice.newCompanyName?.trim()||undefined;
 try{
  if(newCompanyName&&!companyId){
   validateCompanyChoice({newCompanyName},services);
   const before=new Set(services.companies().map(company=>company.id));
   const createdId=services.resolveCompany(newCompanyName);
   if(!createdId||before.has(createdId))
    throw new Error('Company could not be created. Select the existing Company instead.');
   companyId=createdId;
   newCompanyName=undefined;
   services.afterNewCompany?.(createdId);
  }
  if(companyId)services.assignCompany(dealId,companyId);
  return null;
 }catch(reason){
  const detail=reason instanceof Error?reason.message:'Unable to finish Company link.';
  return {dealId,companyId,newCompanyName,
   message:'Deal created, but its Company is not linked. Retry the link or choose the Deal from Records. '+detail};
 }
}
export function createExternalQuoteDealWithCompany(
 rawName:string,choice:ExternalQuoteCompanyChoice,services:ExternalQuoteDealCreateServices,
):{dealId:string;recovery:ExternalQuoteCompanyLinkRecovery|null}{
 const name=rawName.trim();
 if(!name)throw new Error('Enter a Deal name.');
 if(services.deals().some(deal=>recordNameKey(deal.name)===recordNameKey(name)))
  throw new Error('A Deal with that name already exists. Select it from search.');
 validateCompanyChoice(choice,services);
 const dealId=services.createDeal(name);
 if(!dealId)throw new Error('Could not create the Deal.');
 // The Deal now exists. Never throw the user back into "Create" mode if
 // Company creation/classification/linking fails after this point.
 return {dealId,recovery:linkExternalQuoteDealCompany(dealId,choice,services)};
}
