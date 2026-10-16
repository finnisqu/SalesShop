-- Platform Studio Settings. Adds one private document kind to the already
-- Developer-only Headquarters RPCs; no tenant schema or membership changes.
alter table private.platform_workspace_documents
  drop constraint platform_workspace_documents_document_kind_check;
alter table private.platform_workspace_documents
  add constraint platform_workspace_documents_document_kind_check
  check (document_kind in ('notebook','crm','settings'));

create or replace function private.platform_hq_validate_document(p_kind text,p_document jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  if p_kind not in ('notebook','crm','settings') then
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
  if p_kind='settings' and (
      (p_document->>'startTab') is null
      or (p_document->>'startTab') not in ('overview','companies','notebook','crm','playground','settings')
      or (p_document->>'density') is null
      or (p_document->>'density') not in ('comfortable','compact')
      or (p_document->>'accent') is null
      or (p_document->>'accent') not in ('gold','teal','blue')
      or jsonb_typeof(p_document->'showFollowUps') is distinct from 'boolean'
    ) then raise exception 'Invalid Developer settings' using errcode='22023';
  end if;
end;
$$;

create or replace function public.platform_hq_get_document(p_kind text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_doc jsonb;
begin
  if not private.is_platform_developer() then
    raise exception 'Developer access required' using errcode='42501';
  end if;
  if p_kind not in ('notebook','crm','settings') then
    raise exception 'Unsupported headquarters document type' using errcode='22023';
  end if;
  select jsonb_build_object('document',d.document,'revision',d.revision,
    'updatedAt',d.updated_at)
    into v_doc from private.platform_workspace_documents d
    where d.owner_user_id=(select auth.uid()) and d.document_kind=p_kind;
  return coalesce(v_doc,jsonb_build_object('document',null,'revision',0,'updatedAt',null));
end;
$$;

-- Keep explicit grants; replacing the function does not grant tenant access.
revoke all on function private.platform_hq_validate_document(text,jsonb) from public,anon,authenticated;
revoke all on function public.platform_hq_get_document(text) from public,anon;
grant execute on function public.platform_hq_get_document(text) to authenticated;
comment on function public.platform_hq_get_document(text) is
  'JWT-verified platform Developer document access (Notebook, CRM, Settings). Never tenant documents.';
