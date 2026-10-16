-- Migration-history reconciliation only.
-- This no-op was applied while verifying the live commercial-document identity migration.
-- It intentionally changes no schema or data; keeping it in source control makes the
-- checked-in migration history match the live Supabase project.

do $$
begin
  if not exists (select 1 from public.quotes limit 1) then
    null;
  end if;
end $$;
