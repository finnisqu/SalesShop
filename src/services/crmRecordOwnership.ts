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
