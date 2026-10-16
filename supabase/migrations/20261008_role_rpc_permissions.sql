-- Limit privileged write RPCs to signed-in callers. They also enforce
-- workspace editor checks internally, so Viewer and anonymous calls cannot mutate.
revoke all on function public.merge_crm_company_identity(uuid,text,text) from public, anon;
grant execute on function public.merge_crm_company_identity(uuid,text,text) to authenticated;
revoke all on function public.merge_crm_contact_identity(uuid,text,text) from public, anon;
grant execute on function public.merge_crm_contact_identity(uuid,text,text) to authenticated;
revoke all on function public.merge_supplier_profiles(uuid,text,text) from public, anon;
grant execute on function public.merge_supplier_profiles(uuid,text,text) to authenticated;
-- This is a trigger-only function; it should never be called via PostgREST.
revoke all on function public.sync_supplier_name_references() from public, anon;
