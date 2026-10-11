-- Quote reference access does not imply access to transferable customer
-- public-link tokens or handwritten customer signature records.
-- Public customer access uses the token-validated Edge Function with service
-- role and is unaffected by these authenticated employee policies.
alter policy quote_shares_members_select on public.quote_shares
  using (private.can_edit_quote(organization_id,quote_id)
    and private.can_issue_org_quotes(organization_id));
alter policy signatures_members_select on public.signatures
  using (private.can_edit_quote(organization_id,quote_id));
comment on policy quote_shares_members_select on public.quote_shares
  is 'Share URLs are signing credentials: quote-edit and issuance privileges are both required';
comment on policy signatures_members_select on public.signatures
  is 'Signer PII/strokes require quote edit privileges, not reference-only quote access';
