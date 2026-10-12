import type { Activity, Company, Contact, CrmDocument, Project } from '../types/crm';
import type { Quote, QuoteDocument, QuoteLine } from '../types/quote';

/** Fictional fixtures only. No actual SalesShop customer/company records. */
export function seedPlaygroundCrm(): CrmDocument {
  const now=new Date().toISOString();
  const companies: Company[]=[
    {id:'demo_company_harbor',name:'Harborlight Demo Construction',kind:'customer',annualUnits:240,averageUnitValue:2150,expectedSharePct:35,createdAt:now,updatedAt:now},
    {id:'demo_company_pine',name:'Pine & Paper Demo Homes',kind:'customer',annualUnits:64,averageUnitValue:4400,expectedSharePct:65,createdAt:now,updatedAt:now},
    {id:'demo_company_cove',name:'Cobalt Cove Sample Hospitality',kind:'customer',annualUnits:110,averageUnitValue:1900,expectedSharePct:20,createdAt:now,updatedAt:now},
    {id:'demo_company_copper',name:'Copperline Fictional Properties',kind:'customer',annualUnits:85,averageUnitValue:2750,expectedSharePct:50,createdAt:now,updatedAt:now},
    {id:'demo_company_supplier',name:'Sandbox Sample Supply Co.',kind:'non-customer',createdAt:now,updatedAt:now},
  ];
  const contacts: Contact[]=[
    {id:'demo_contact_aria',companyId:companies[0].id,name:'Aria Sample',email:'aria@harborlight.example',title:'Preconstruction Manager',createdAt:now,updatedAt:now},
    {id:'demo_contact_ben',companyId:companies[1].id,name:'Ben Placeholder',email:'ben@pinepaper.example',title:'Purchasing Coordinator',createdAt:now,updatedAt:now},
    {id:'demo_contact_cora',companyId:companies[2].id,name:'Cora Fiction',email:'cora@cobaltcove.example',title:'Project Director',createdAt:now,updatedAt:now},
    {id:'demo_contact_dan',companyId:companies[3].id,name:'Dan Example',email:'dan@copperline.example',title:'Estimator',createdAt:now,updatedAt:now},
  ];
  const stages: Project['stage'][]=['Discovery','Bid Development','Bid Sent','Negotiation','Closed Won','Completed'];
  const names=['South Pier Apartments (Demo)','Juniper Townhomes (Demo)','Cobalt Suites Renovation (Demo)','Copperline Building C (Demo)','North Harbor Phase 2 (Demo)','Pinewood Model Homes (Demo)'];
  const companyIndexes=[0,1,2,3,0,1];
  const amounts=[425000,82500,194000,118500,213000,25500];
  const projects: Project[]=names.map((name,i)=>({
    id:`demo_project_${i+1}`,name,companyId:companies[companyIndexes[i]].id,
    companyName:companies[companyIndexes[i]].name,stage:stages[i],
    stageChangedAt:now,amount:amounts[i],nextAction:i===0?'Review example takeoff':i===1?'Complete demo pricing':'Follow up on sample bid',
    createdAt:now,updatedAt:now,
  }));
  const activities: Activity[]=[
    {id:'demo_activity_1',type:'project-created',summary:'Created fictional South Pier project',projectId:projects[0].id,companyId:companies[0].id,occurredAt:now},
    {id:'demo_activity_2',type:'contact-created',summary:'Added sample buyer contact',companyId:companies[1].id,contactId:contacts[1].id,occurredAt:now},
  ];
  return {schemaVersion:3,companies,contacts,projects,activities};
}

export function seedPlaygroundQuotes(): QuoteDocument {
  const now=new Date().toISOString();
  const today=now.slice(0,10);
  const lines=(material:string,quantity:number,rate:number):QuoteLine[]=>[
    {id:`demo_line_${material.replace(/\W+/g,'_').toLowerCase()}`,kind:'item',description:material,
      pricingMode:'quantity-rate',quantity,rate,customerVisible:true,includeInTotal:true},
    {id:`demo_note_${material.replace(/\W+/g,'_').toLowerCase()}`,kind:'note',
      description:'SAMPLE ONLY — not a real proposal or customer record',pricingMode:'none',
      customerVisible:true,includeInTotal:false},
  ];
  const base=(index:number,title:string,companyName:string,companyId:string,projectId:string,
    contactName:string,contactEmail:string,status:Quote['status'],quantity:number,rate:number):Quote=>({
      id:`demo_quote_${index}`,quoteNumber:`DEMO-00${index}`,documentType:'quote',
      originalQuoteDate:today,quoteDate:today,revision:0,status,title,
      projectId,companyId,companyName,contactName,contactEmail,
      sections:[],lines:lines(index===1?'Demo quartz countertops':index===2?'Demo vanity tops':'Sample kitchen stone package',quantity,rate),
      customerColumns:{quantity:true,rate:true,lineAmount:true},
      customerNotes:'DEVELOPER PLAYGROUND • Fictional data for testing only.',
      internalNotes:'This quote is a sandbox fixture. Nothing is sent to live customers.',
      history:[],createdAt:now,updatedAt:now,
  });
  const quotes:Quote[]=[
    base(1,'South Pier — Sample Multifamily Bid','Harborlight Demo Construction','demo_company_harbor',
      'demo_project_1','Aria Sample','aria@harborlight.example','Draft',1600,42),
    base(2,'Juniper — Sample Townhome Estimate','Pine & Paper Demo Homes','demo_company_pine',
      'demo_project_2','Ben Placeholder','ben@pinepaper.example','Ready',320,57),
    base(3,'Cobalt Suites — Sample Proposal','Cobalt Cove Sample Hospitality','demo_company_cove',
      'demo_project_3','Cora Fiction','cora@cobaltcove.example','Sent',840,49),
  ];
  return {schemaVersion:2,quotes,activeQuoteId:quotes[0].id};
}
