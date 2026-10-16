-- Pricing Schedule numbering is a contractual boundary. Every published row must
-- carry both a customer-facing description and a numeric customer price before an
-- official document number can be assigned.

begin;

create or replace function private.validate_pricing_schedule_numbering()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_items jsonb;
  v_columns jsonb;
  v_invalid_rows integer;
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

  select count(*)
    into v_invalid_rows
  from jsonb_array_elements(v_items) as item
  where nullif(btrim(item ->> 'description'), '') is null
     or not (item ? 'customerPrice')
     or jsonb_typeof(item -> 'customerPrice') <> 'number';

  if v_invalid_rows > 0 then
    raise exception 'Every published pricing row must include a Description and numeric Customer price before sending.' using errcode = '23514';
  end if;

  return new;
end;
$$;

commit;
