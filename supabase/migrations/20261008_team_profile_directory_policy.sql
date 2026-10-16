-- Members can see the display names of colleagues who share an organization.
-- This is limited to profile display names: auth emails are not exposed.
-- Account/profile editing remains self-only.
begin;
drop policy if exists profiles_select_teammates on public.profiles;
create policy profiles_select_teammates
  on public.profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members mine
      join public.organization_members teammate
        on teammate.organization_id = mine.organization_id
      where mine.user_id = (select auth.uid())
        and teammate.user_id = public.profiles.user_id
    )
  );
commit;
