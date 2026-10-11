-- Support Simple Rate Sheet rows that are contractually NC / Included / TBD
-- while still failing closed when customer pricing is incomplete.

begin;

create or replace function private.validate_pricing_schedule_numbering()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_items jsonb;
  v_columns jsonb;
  v_source text;
  v_item jsonb;
  v_price_label text;
begin
  if new.document_type <> 'pricing-schedule'
     or old.quote_number !~ '^DRAFT-'
     or new.quote_number ~ '^DRAFT-' then
    return new;
  end if;

  if new.pricing_schedule is null then
    raise exception 'Configure the pricing schedule before sending.' using errcode = '23514';
  end if;

  v_items := coalesce(new.pricing_schedule -> 'customerItems', '[]'::jsonb);
  v_source := coalesce(
    nullif(new.pricing_schedule ->> 'publishSource', ''),
    case
      when new.pricing_schedule ->> 'route' = 'workbook' then 'workbook'
      when new.pricing_schedule ->> 'route' = 'plan-builder' then 'builder'
      when new.pricing_schedule ->> 'route' = 'rate-sheet' then 'rate-sheet'
      when new.pricing_schedule ? 'builder' then 'builder'
      else 'workbook'
    end
  );

  if coalesce(jsonb_typeof(v_items), '') <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'The published pricing schedule does not contain any customer rows.' using errcode = '23514';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    if coalesce(btrim(v_item ->> 'description'), '') = '' then
      raise exception 'Every published pricing row needs a Description.' using errcode = '23514';
    end if;

    v_price_label := coalesce(btrim(v_item ->> 'priceLabel'), '');
    if v_source = 'rate-sheet' then
      if coalesce(jsonb_typeof(v_item -> 'customerPrice'), '') <> 'number'
         and v_price_label = '' then
        raise exception 'Every published Rate Sheet row needs a numeric price or an explicit pricing state.' using errcode = '23514';
      end if;
    elsif coalesce(jsonb_typeof(v_item -> 'customerPrice'), '') <> 'number' then
      raise exception 'Every published pricing row needs a numeric Customer price.' using errcode = '23514';
    end if;
  end loop;

  if v_source in ('builder', 'rate-sheet') then
    if coalesce(jsonb_typeof(new.pricing_schedule -> 'builder'), '') <> 'object' then
      raise exception 'Structured pricing data is missing.' using errcode = '23514';
    end if;
  else
    v_columns := coalesce(new.pricing_schedule -> 'mapping' -> 'columns', '{}'::jsonb);
    if not (v_columns ? 'description') or not (v_columns ? 'customerPrice') then
      raise exception 'Map at least Description and Customer price before sending this schedule.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

commit;
