export type PlatformSalesStage = 'Lead' | 'Contacted' | 'Demo' | 'Trial' | 'Customer' | 'Cold' | 'Lost';
export const SALES_STAGES: PlatformSalesStage[]=['Lead','Contacted','Demo','Trial','Customer','Cold','Lost'];

export interface PlatformNotePage {
 id:string;title:string;contentHtml:string;pinned:boolean;createdAt:string;updatedAt:string;
}
export interface PlatformNotebookDocument {
 schemaVersion:1;pages:PlatformNotePage[];activePageId:string|null;
}
export interface PlatformLeadAccount {
 id:string;name:string;stage:PlatformSalesStage;source:string;website:string;notes:string;
 nextAction:string;followUpDate:string;tenantOrganizationId:string|null;
 createdAt:string;updatedAt:string;
}
export interface PlatformLeadContact {
 id:string;accountId:string;name:string;title:string;email:string;phone:string;notes:string;
 createdAt:string;updatedAt:string;
}
export interface PlatformLeadActivity {
 id:string;accountId:string;summary:string;occurredAt:string;
}
export interface PlatformCrmDocument {
 schemaVersion:1;accounts:PlatformLeadAccount[];contacts:PlatformLeadContact[];activities:PlatformLeadActivity[];
}
export const blankNotebook=():PlatformNotebookDocument=>({schemaVersion:1,pages:[],activePageId:null});
export const blankCrm=():PlatformCrmDocument=>({schemaVersion:1,accounts:[],contacts:[],activities:[]});

export function cleanNotebook(value:unknown):PlatformNotebookDocument {
 if(!value || typeof value!=='object')return blankNotebook();
 const obj=value as Partial<PlatformNotebookDocument>;
 if(obj.schemaVersion!==1 || !Array.isArray(obj.pages))return blankNotebook();
 const pages=obj.pages.filter((p)=>p && typeof p.id==='string' && typeof p.title==='string' && typeof p.contentHtml==='string');
 return {schemaVersion:1,pages,activePageId:pages.some(p=>p.id===obj.activePageId)?obj.activePageId??null:pages[0]?.id??null};
}
export function cleanCrm(value:unknown):PlatformCrmDocument {
 if(!value || typeof value!=='object')return blankCrm();
 const obj=value as Partial<PlatformCrmDocument>;
 if(obj.schemaVersion!==1 || !Array.isArray(obj.accounts)||!Array.isArray(obj.contacts)||!Array.isArray(obj.activities))return blankCrm();
 const accounts=obj.accounts.filter(a=>a && typeof a.id==='string' && typeof a.name==='string' && SALES_STAGES.includes(a.stage));
 const ids=new Set(accounts.map(a=>a.id));
 return {schemaVersion:1,accounts,
 contacts:obj.contacts.filter(c=>c && typeof c.id==='string' && ids.has(c.accountId)),
 activities:obj.activities.filter(a=>a && typeof a.id==='string' && ids.has(a.accountId))};
}
export function remainingFollowUps(doc:PlatformCrmDocument, today=new Date().toISOString().slice(0,10)) {
 return doc.accounts.filter(a=>a.followUpDate && a.followUpDate<=today && a.stage!=='Lost' && a.stage!=='Cold');
}
export function newPlatformId(prefix:string) {
 return `${prefix}_${crypto.randomUUID()}`;
}
