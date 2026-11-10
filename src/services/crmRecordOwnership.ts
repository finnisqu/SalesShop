/** CRM Company/Person ownership is separate from organization read access.
 * New cloud records belong to the creating member. Existing records are left
 * unassigned; read and write permissions remain controlled by organization RLS.
 */
export function initialCrmOwnerUserId(mode:'cloud'|'local',userId?:string|null){
 return mode==='cloud'&&userId?userId:undefined;
}
export function crmOwnerLabel(ownerId:string|undefined,viewerId:string|undefined,
 mode:'cloud'|'local'):string{
 if(mode!=='cloud')return 'You · local workspace';
 if(!ownerId)return 'Unassigned · existing record';
 return ownerId===viewerId?'You':'Assigned teammate';
}

/** The UI uses the same strict role rule as the server owner-change trigger.
 * Actual authorization is independently enforced by PostgreSQL.
 */
export function canReassignCrmOwner(role:'owner'|'admin'|'member'|'viewer'|null,
 mode:'cloud'|'local',rolePreview=false):boolean{
 return mode==='cloud'&&!rolePreview&&(role==='owner'||role==='admin');
}
export type CrmOwnerMember={userId:string;name:string;role:'owner'|'admin'|'member'|'viewer'};
export function crmOwnerDisplay(ownerId:string|undefined,viewerId:string|undefined,
 mode:'cloud'|'local',members:readonly CrmOwnerMember[]):string{
 if(mode!=='cloud'||!ownerId||ownerId===viewerId)
   return crmOwnerLabel(ownerId,viewerId,mode);
 return members.find(member=>member.userId===ownerId)?.name??'Assigned teammate';
}
