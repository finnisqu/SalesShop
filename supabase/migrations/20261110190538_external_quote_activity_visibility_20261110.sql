-- External quotes are deliberately logged without a native quote_id.
-- Preserve private native Quote visibility; only the explicitly marked
-- externally sent submission belongs in shared CRM Activity history.
drop policy if exists activities_read_org on public.activities;
create policy activities_read_org on public.activities
 for select to authenticated
 using (
  private.is_org_member(organization_id)
  and (
   (quote_id is null and type not like 'quote-%' and type not like 'change-order-%')
   or (quote_id is null and type='quote-sent' and project_id is not null
       and metadata->>'externalQuoteSent'='true')
   or (quote_id is not null and private.can_read_quote(organization_id,quote_id))
  )
 );
comment on policy activities_read_org on public.activities is
 'Organization members can see general CRM events and explicitly marked external Quote Sent events. Native Quote lifecycle remains gated by quote-specific permission.';
