-- STAGING/DISPOSABLE ONLY; NOT AN AUTOMATIC PRODUCTION MIGRATION.
-- Move to supabase/migrations ONLY after isolated RLS tests and explicit approval.
-- #391 PRIVATE DOCUMENT STORAGE (STAGED ONLY)
-- Do not run on production without a separately approved RLS and role-matrix check.
-- Deliberately supports only shared Company and Deal attachments; NOT Quotes.
-- A file is listed to org members only after Storage confirms its actual byte count.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
 'sales-documents','sales-documents',false,15728640,
 array[
  'application/pdf','image/png','image/jpeg','image/webp',
  'text/plain','text/csv',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
 ]
)
on conflict (id) do nothing;

-- Fail closed if someone pre-created the same bucket with broader access
-- or different upload constraints. Do not silently reuse a public bucket.
do $$
begin
 if exists (
  select 1 from storage.buckets b
  where b.id='sales-documents'
   and (
    b.public is distinct from false
    or b.file_size_limit is distinct from 15728640
    or b.allowed_mime_types is distinct from array[
     'application/pdf','image/png','image/jpeg','image/webp',
     'text/plain','text/csv',
     'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]::text[]
   )
 ) then
  raise exception 'SalesShop document bucket exists with unsafe or unexpected settings. Refusing migration.';
 end if;
end;
$$;

create table if not exists public.crm_file_objects (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 uploaded_by uuid not null default auth.uid(),
 target_kind text not null check (target_kind in ('company','deal')),
 target_id text not null check (char_length(target_id) between 1 and 200),
 title text not null check (char_length(title) between 1 and 180),
 category text not null default 'other'
   check (category in ('drawing','bid','contract','spec','other')),
 folder_path text not null default ''
   check (char_length(folder_path)<=160),
 mime_type text not null check (char_length(mime_type) between 3 and 150),
 size_bytes bigint check (size_bytes is null or size_bytes>=0),
 status text not null default 'pending'
   check (status in ('pending','ready','trashed')),
 object_path text generated always as
  (organization_id::text || '/' || id::text) stored,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint crm_file_objects_pending_size check (status <> 'pending' or size_bytes is null),
 constraint crm_file_objects_ready_size check (status <> 'ready' or size_bytes is not null),
 constraint crm_file_objects_unique_object unique (object_path)
);
create index if not exists crm_file_objects_org_status_idx
 on public.crm_file_objects(organization_id,status,updated_at desc);
create index if not exists crm_file_objects_target_idx
 on public.crm_file_objects(organization_id,target_kind,target_id,status);

-- Storage metadata is authoritative. A user can only change state, never
-- organization/path/uploader/record association or size. This trigger is
-- in a non-exposed schema, not a publicly executable RPC.
create or replace function private.crm_file_guard_391()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
 stored_bytes bigint;
 stored_mime text;
 reserved_bytes bigint;
 expected_mime text;
begin
 if TG_OP='DELETE' then
  -- Never leave billable, unreachable bytes behind by deleting an index row
  -- before its Storage object. This also protects against direct API writes.
  if exists(
   select 1 from storage.objects o
   where o.bucket_id='sales-documents'
     and o.name=old.object_path
  ) then
   raise exception 'Delete document bytes from private Storage before removing metadata';
  end if;
  return old;
 end if;
 if TG_OP='INSERT' then
  if new.status<>'pending' or new.size_bytes is not null then
   raise exception 'New document must be pending and have no size yet';
  end if;
  -- Enforce document metadata rules against direct authenticated API writes.
  if new.title <> pg_catalog.btrim(new.title)
    or new.title ~ '[[:cntrl:]/]'
    or pg_catalog.strpos(new.title,pg_catalog.chr(92))>0
    or new.title in ('.','..') then
   raise exception 'Unsafe document title';
  end if;
  if new.folder_path ~ '[[:cntrl:]]'
    or pg_catalog.strpos(new.folder_path,pg_catalog.chr(92))>0
    or pg_catalog.strpos(new.folder_path,'../')>0
    or new.folder_path='..' then
   raise exception 'Unsafe document folder';
  end if;
  expected_mime := case pg_catalog.lower(
    pg_catalog.substring(new.title from '\.([a-zA-Z0-9]+)$'))
   when 'pdf' then 'application/pdf'
   when 'png' then 'image/png'
   when 'jpg' then 'image/jpeg'
   when 'jpeg' then 'image/jpeg'
   when 'webp' then 'image/webp'
   when 'txt' then 'text/plain'
   when 'csv' then 'text/csv'
   when 'doc' then 'application/msword'
   when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
   when 'xls' then 'application/vnd.ms-excel'
   when 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
   when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
   else null end;
  if expected_mime is null or expected_mime is distinct from new.mime_type then
   raise exception 'Document extension and declared MIME type do not match';
  end if;
  -- Serialize concurrent upload reservations for this organization, preventing
  -- multiple simultaneous uploads from bypassing its initial safety allowance.
  perform pg_catalog.pg_advisory_xact_lock(391,pg_catalog.hashtext(new.organization_id::text));
  select coalesce(sum(
   case when f.status='pending' then 15728640::bigint
    else coalesce(f.size_bytes,0) end
  ),0) into reserved_bytes
  from public.crm_file_objects f
  where f.organization_id=new.organization_id;
  -- Soft-deleted objects still occupy real provider bytes until purged.
  if reserved_bytes + 15728640 > 524288000 then
   raise exception 'The initial 500 MB organization file allowance is full. Permanently delete unneeded files or contact an administrator.';
  end if;
  -- Client-supplied timestamps are not authoritative audit metadata.
  new.created_at := now();
  new.updated_at := now();
  return new;
 end if;
 if new.id is distinct from old.id
  or new.organization_id is distinct from old.organization_id
  or new.uploaded_by is distinct from old.uploaded_by
  or new.target_kind is distinct from old.target_kind
  or new.target_id is distinct from old.target_id
  or new.title is distinct from old.title
  or new.category is distinct from old.category
  or new.folder_path is distinct from old.folder_path
  or new.mime_type is distinct from old.mime_type
  or new.size_bytes is distinct from old.size_bytes
  -- NEW.object_path is a stored generated column and is not readable in
  -- BEFORE UPDATE. Its base UUID fields above are already immutable.
  or new.created_at is distinct from old.created_at
 then
  raise exception 'Document identity, location and size are immutable';
 end if;
 if not (
  (old.status='pending' and new.status='ready') or
  (old.status='ready' and new.status='trashed') or
  (old.status='trashed' and new.status='ready')
 ) then
  raise exception 'Invalid document status transition';
 end if;
 if new.status='ready' then
  select
   case when coalesce(o.metadata->>'size','') ~ '^[0-9]+$'
     then (o.metadata->>'size')::bigint else null end,
   o.metadata->>'mimetype'
  into stored_bytes,stored_mime
  from storage.objects o
  where o.bucket_id='sales-documents'
   -- Compute from immutable source columns. Generated columns are NOT
   -- available on NEW in BEFORE triggers (PostgreSQL 17+ behavior).
   and o.name=(new.organization_id::text || '/' || new.id::text);
  if stored_bytes is null or stored_bytes<0 or stored_bytes>15728640
    or stored_mime is null or stored_mime<>old.mime_type then
   raise exception 'Storage object is missing or its size/type cannot be verified';
  end if;
  new.size_bytes := stored_bytes;
 end if;
 new.updated_at := now();
 return new;
end;
$$;
revoke all on function private.crm_file_guard_391() from public;
drop trigger if exists crm_file_guard_391 on public.crm_file_objects;
create trigger crm_file_guard_391
 before insert or update or delete on public.crm_file_objects
 for each row execute function private.crm_file_guard_391();

alter table public.crm_file_objects enable row level security;
revoke all on public.crm_file_objects from anon;
grant select,insert,update,delete on public.crm_file_objects to authenticated;

-- The current CRM's Companies/Deals are organization-visible, subject to
-- private.is_org_member, and writeable subject to private.can_edit_org_area.
-- A later Quote integration MUST use quote-level access checks instead.
create policy "crm_files_read_member_391"
 on public.crm_file_objects for select to authenticated using (
  private.is_org_member(organization_id)
  and (
   (target_kind='company' and exists(
    select 1 from public.companies c
    where c.id=target_id and c.organization_id=crm_file_objects.organization_id
   )) or
   (target_kind='deal' and exists(
    select 1 from public.projects p
    where p.id=target_id and p.organization_id=crm_file_objects.organization_id
   )) or
   -- A CRM editor can recover / purge orphaned rows if a target is deleted.
   private.can_edit_org_area(organization_id,'crm')
  )
  and (
   status='ready' or
   (status='pending' and (
     uploaded_by=(select auth.uid()) or
     private.can_edit_org_area(organization_id,'crm')
   )) or
   (status='trashed' and private.can_edit_org_area(organization_id,'crm'))
  )
);
create policy "crm_files_insert_editor_391"
 on public.crm_file_objects for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and status='pending' and size_bytes is null
  and private.can_edit_org_area(organization_id,'crm')
  and (
   (target_kind='company' and exists(
    select 1 from public.companies c
    where c.id=target_id and c.organization_id=crm_file_objects.organization_id
   )) or
   (target_kind='deal' and exists(
    select 1 from public.projects p
    where p.id=target_id and p.organization_id=crm_file_objects.organization_id
   ))
  )
);
create policy "crm_files_update_editor_391"
 on public.crm_file_objects for update to authenticated
 using (private.can_edit_org_area(organization_id,'crm'))
 with check (private.can_edit_org_area(organization_id,'crm'));
create policy "crm_files_delete_editor_391"
 on public.crm_file_objects for delete to authenticated using (
  private.can_edit_org_area(organization_id,'crm')
  and status in ('pending','trashed')
);

-- STORAGE: An INSERT is allowed only for a pre-authorized pending row
-- with the exact random immutable object path for this org/file.
-- SELECT also protects authenticated download, and DELETE needs a trashed row.
-- No UPDATE policy: overwrite (upsert) is intentionally disallowed.
create policy "crm_files_storage_insert_391"
 on storage.objects for insert to authenticated with check (
  bucket_id='sales-documents' and exists (
   select 1 from public.crm_file_objects f
   where f.object_path=name and f.status='pending'
    and f.uploaded_by=(select auth.uid())
    and private.can_edit_org_area(f.organization_id,'crm')
  )
);
create policy "crm_files_storage_select_391"
 on storage.objects for select to authenticated using (
  bucket_id='sales-documents' and exists (
   select 1 from public.crm_file_objects f
   where f.object_path=name
    and private.is_org_member(f.organization_id)
    and (
     f.status='ready' or
     (f.status='pending' and (
       f.uploaded_by=(select auth.uid()) or
       private.can_edit_org_area(f.organization_id,'crm')
     )) or
     (f.status='trashed' and private.can_edit_org_area(f.organization_id,'crm'))
    )
  )
);
create policy "crm_files_storage_delete_391"
 on storage.objects for delete to authenticated using (
  bucket_id='sales-documents' and exists (
   select 1 from public.crm_file_objects f
   where f.object_path=name
    and private.can_edit_org_area(f.organization_id,'crm')
    and (f.status='trashed' or f.status='pending')
  )
);

comment on table public.crm_file_objects is
 'Private CRM Company/Deal document metadata. Storage bytes are authoritative; no Quote attachments until quote access parity. #391';
