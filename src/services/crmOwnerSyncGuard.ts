/**
 * Client-side sync guard, NOT authorization. Supabase RLS enforces actual
 * visibility and mutations. Legacy unknown ownership remains unassigned.
 */
export function mayUploadCrmEntity(
  ownerUserId:string|undefined,
  actorId:string|undefined,
  privateRlsEnabled:boolean,
){
  return !privateRlsEnabled || Boolean(actorId && ownerUserId===actorId);
}
