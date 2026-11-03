-- First-class bid submission dates for the shared SalesShop calendar.
-- Existing Deal form previously labeled projects.due_date "Bid due date", so
-- carry those dates forward without discarding the old legacy field.
begin;
alter table public.projects add column if not exists bid_due_date date;
alter table public.projects add column if not exists bid_due_time time without time zone;
update public.projects set bid_due_date=due_date
 where bid_due_date is null and due_date is not null;
create index if not exists projects_organization_bid_due_idx
 on public.projects(organization_id,bid_due_date)
 where bid_due_date is not null;
commit;
