-- Platform Headquarters: private developer Notebook + sales CRM.
-- Never uses tenant organization_id, tenant CRM, quote, notebook or contact records.
create table private.platform_workspace_documents (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  document_kind text not null check (document_kind in ('notebook','crm')),
  document jsonb not null,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id,document_kind)
);
alter table private.platform_workspace_documents enable row level security;
revoke all on table private.platform_workspace_documents from public,anon,authenticated;

-- Server-side format and size gates reduce accidental over-sized saves.
create function private.platform_hq_validate_document(p_kind text,p_document jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  if p_kind not in ('notebook','crm') then
    raise exception 'Unsupported headquarters document type' using errcode='22023';
  end if;
  if p_document is null or jsonb_typeof(p_document)<>'object'
    or p_document->>'schemaVersion'<>'1' then
    raise exception 'Invalid headquarters document version' using errcode='22023';
  end if;
  if octet_length(p_document::text)>1048576 then
    raise exception 'Headquarters document exceeds 1 MB' using errcode='22023';
  end if;
  if p_kind='notebook' and (
      jsonb_typeof(p_document->'pages') is distinct from 'array'
      or jsonb_array_length(p_document->'pages')>250
    ) then raise exception 'Invalid notebook pages' using errcode='22023';
  end if;
  if p_kind='crm' and (
      jsonb_typeof(p_document->'accounts') is distinct from 'array'
      or jsonb_typeof(p_document->'contacts') is distinct from 'array'
      or jsonb_typeof(p_document->'activities') is distinct from 'array'
      or jsonb_array_length(p_document->'accounts')>2000
      or jsonb_array_length(p_document->'contacts')>5000
      or jsonb_array_length(p_document->'activities')>10000
    ) then raise exception 'Invalid headquarters CRM lists' using errcode='22023';
  end if;
end;
$$;
revoke all on function private.platform_hq_validate_document(text,jsonb)
  from public,anon,authenticated;

create function public.platform_hq_get_document(p_kind text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_doc jsonb;
begin
  if not private.is_platform_developer() then
    raise exception 'Developer access required' using errcode='42501';
  end if;
  if p_kind not in ('notebook','crm') then
    raise exception 'Unsupported headquarters document type' using errcode='22023';
  end if;
  select jsonb_build_object('document',d.document,'revision',d.revision,
    'updatedAt',d.updated_at)
    into v_doc
    from private.platform_workspace_documents d
    where d.owner_user_id=(select auth.uid()) and d.document_kind=p_kind;
  return coalesce(v_doc,jsonb_build_object('document',null,'revision',0,'updatedAt',null));
end;
$$;

create function public.platform_hq_save_document(
  p_kind text,
  p_document jsonb,
  p_expected_revision bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_revision bigint; v_updated_at timestamptz;
begin
  if not private.is_platform_developer() then
    raise exception 'Developer access required' using errcode='42501';
  end if;
  perform private.platform_hq_validate_document(p_kind,p_document);
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Expected revision required' using errcode='22023';
  end if;
  insert into private.platform_workspace_documents
    (owner_user_id,document_kind,document,revision,updated_at)
  values ((select auth.uid()),p_kind,p_document,1,now())
  on conflict (owner_user_id,document_kind)
  do update set
    document=excluded.document,
    revision=private.platform_workspace_documents.revision+1,
    updated_at=now()
  where private.platform_workspace_documents.revision=p_expected_revision
  returning revision,updated_at into v_revision,v_updated_at;
  if v_revision is null then
    raise exception 'Headquarters document changed on another device; reload before editing'
      using errcode='40001';
  end if;
  return jsonb_build_object('revision',v_revision,'updatedAt',v_updated_at);
end;
$$;

revoke all on function public.platform_hq_get_document(text) from public,anon;
revoke all on function public.platform_hq_save_document(text,jsonb,bigint) from public,anon;
grant execute on function public.platform_hq_get_document(text) to authenticated;
grant execute on function public.platform_hq_save_document(text,jsonb,bigint) to authenticated;
comment on table private.platform_workspace_documents is
  'Private SalesShop platform developer workspace only. No customer tenant data.';
comment on function public.platform_hq_save_document(text,jsonb,bigint) is
  'Developer-only private Notebook/CRM storage with optimistic revision safety.';
