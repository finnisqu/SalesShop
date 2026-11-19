-- #391c — STAGING / DATABASE OPERATOR ONLY; READ-ONLY.
-- Run only after docs/platform/sql/391-private-documents-staging.sql was
-- installed on an approved isolated Supabase project. Never publish results
-- through PostgREST, an app view, or an unrestricted RPC.
-- This query neither reads file bytes nor reveals document names or object keys.
-- It must run under an operator role that can inspect all target records,
-- otherwise target visibility RLS might misclassify hidden records as orphans.
-- DO NOT TURN THIS INTO DELETE SQL. Remediation needs separate review.
with inspected as (
 select
  f.organization_id,
  f.status,
  f.size_bytes,
  case when f.status='pending' then 15728640::bigint
       else coalesce(f.size_bytes,0)
  end as reserved_bytes,
  case
   when f.target_kind='company' then exists (
    select 1 from public.companies c
    where c.organization_id=f.organization_id and c.id=f.target_id
   )
   when f.target_kind='deal' then exists (
    select 1 from public.projects p
    where p.organization_id=f.organization_id and p.id=f.target_id
   )
   else false
  end as target_exists,
  exists (
   select 1 from storage.objects o
   where o.bucket_id='sales-documents' and o.name=f.object_path
  ) as object_exists
 from public.crm_file_objects f
)
select
 organization_id,
 count(*) as indexed_documents,
 coalesce(sum(reserved_bytes),0) as reserved_bytes,
 count(*) filter (where not target_exists) as missing_target_documents,
 coalesce(sum(reserved_bytes) filter(where not target_exists),0)
   as reserved_bytes_at_missing_targets,
 count(*) filter (where status='pending' and object_exists)
   as interrupted_upload_candidates,
 count(*) filter (where status='pending' and not object_exists)
   as empty_pending_reservations,
 count(*) filter (where status='ready' and not object_exists)
   as missing_ready_objects,
 count(*) filter (where status='trashed' and object_exists)
   as trashed_still_using_bytes
from inspected
group by organization_id
order by reserved_bytes desc;
