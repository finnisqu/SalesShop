begin;

create index if not exists quote_shares_created_by_idx
  on public.quote_shares(created_by)
  where created_by is not null;

commit;
