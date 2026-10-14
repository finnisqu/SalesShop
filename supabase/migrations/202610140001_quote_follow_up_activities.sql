-- Follow-up events are CRM activity breadcrumbs, scoped to a specific issued
-- quote revision. No separate mutable reminder state or new RLS surface.
-- Apply before releasing the follow-up UI to connected organizations.
begin;
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check check (type in (
  'project-created','project-stage-changed','quote-created','quote-linked',
  'quote-sent','quote-revision-created','quote-viewed','quote-signed',
  'quote-declined','quote-expired',
  'change-order-created','change-order-sent','change-order-revision-created',
  'change-order-viewed','change-order-signed','change-order-declined',
  'change-order-expired','contact-created','quote-follow-up'
));
commit;
