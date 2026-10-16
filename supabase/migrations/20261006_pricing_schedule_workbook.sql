-- Pricing Schedule working data lives with the mutable commercial document.
-- Sent revisions remain immutable through quote_revisions.snapshot.

begin;

alter table public.quotes
  add column if not exists pricing_schedule jsonb;

comment on column public.quotes.pricing_schedule is
  'Pricing Schedule internal workbook snapshot, publish mapping, and derived customer-safe rows. Raw workbook content must never be returned by public quote links.';

create or replace function private.validate_pricing_schedule_numbering()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_items jsonb;
  v_columns jsonb;
begin
  if new.document_type <> 'pricing-schedule'
     or old.quote_number !~ '^DRAFT-'
     or new.quote_number ~ '^DRAFT-' then
    return new;
  end if;

  if new.pricing_schedule is null then
    raise exception 'Add or import the pricing workbook before sending this schedule.' using errcode = '23514';
  end if;

  v_items := coalesce(new.pricing_schedule -> 'customerItems', '[]'::jsonb);
  v_columns := coalesce(new.pricing_schedule -> 'mapping' -> 'columns', '{}'::jsonb);

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'The mapped pricing schedule does not contain any customer rows.' using errcode = '23514';
  end if;

  if not (v_columns ? 'description') or not (v_columns ? 'customerPrice') then
    raise exception 'Map at least Description and Customer price before sending this schedule.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_pricing_schedule_numbering on public.quotes;
create trigger validate_pricing_schedule_numbering
  before update of quote_number on public.quotes
  for each row execute function private.validate_pricing_schedule_numbering();

commit;
