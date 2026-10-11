-- Make missing JSON keys fail closed at the database boundary.

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
    case when new.pricing_schedule ? 'builder' then 'builder' else 'workbook' end
  );

  if coalesce(jsonb_typeof(v_items), '') <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'The published pricing schedule does not contain any customer rows.' using errcode = '23514';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    if coalesce(btrim(v_item ->> 'description'), '') = ''
       or coalesce(jsonb_typeof(v_item -> 'customerPrice'), '') <> 'number' then
      raise exception 'Every published pricing row needs a Description and Customer price.' using errcode = '23514';
    end if;
  end loop;

  if v_source = 'builder' then
    if coalesce(jsonb_typeof(new.pricing_schedule -> 'builder'), '') <> 'object' then
      raise exception 'Structured Builder data is missing.' using errcode = '23514';
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
