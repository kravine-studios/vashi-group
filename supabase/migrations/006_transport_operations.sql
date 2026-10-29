insert into public.app_settings (key, value)
values
  ('slot_default_capacity', '1'::jsonb),
  ('slot_publish_days_ahead', '3'::jsonb),
  ('market_open_time', '"10:00"'::jsonb),
  ('market_close_time', '"18:00"'::jsonb),
  ('slot_length_minutes', '60'::jsonb)
on conflict (key) do nothing;

create unique index transport_slots_start_driver_idx
on public.transport_slots (starts_at, driver_name);

create policy "Super admins read all transport slots"
on public.transport_slots for select to authenticated
using ((select public.is_super_admin()));

create policy "Order participants read booked transport slots"
on public.transport_slots for select to authenticated
using (
  exists (
    select 1
    from public.transport_bookings booking
    where booking.slot_id = transport_slots.id
      and (select public.can_read_order(booking.order_id))
  )
);

create function public.admin_create_transport_slot(
  starts_at_input timestamptz,
  ends_at_input timestamptz,
  driver_name_input text,
  contact_number_input text,
  capacity_input integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot_id uuid;
  capacity_limit integer;
  publish_days integer;
begin
  if not (select public.is_super_admin()) then
    raise exception 'Only an approved super admin can manage transport slots';
  end if;

  select coalesce((value #>> '{}')::integer, 1)
  into capacity_limit
  from public.app_settings
  where key = 'slot_default_capacity';
  capacity_limit := coalesce(capacity_input, capacity_limit, 1);

  select coalesce((value #>> '{}')::integer, 3)
  into publish_days
  from public.app_settings
  where key = 'slot_publish_days_ahead';
  publish_days := coalesce(publish_days, 3);

  if starts_at_input is null or ends_at_input is null or starts_at_input <= now()
    or ends_at_input <= starts_at_input
    or (starts_at_input at time zone 'Asia/Kolkata')::date
      > (now() at time zone 'Asia/Kolkata')::date + publish_days then
    raise exception 'Choose a future slot within the configured publishing window';
  end if;
  if coalesce(length(trim(driver_name_input)), 0) = 0 or length(trim(driver_name_input)) > 100
    or coalesce(trim(contact_number_input), '') !~ '^[+0-9][0-9+() -]{5,19}$' then
    raise exception 'Enter a truck or driver name and a valid contact number';
  end if;
  if capacity_limit < 1 or capacity_limit > 100 then
    raise exception 'Slot capacity must be between 1 and 100 orders';
  end if;

  insert into public.transport_slots (starts_at, ends_at, driver_name, contact_number, capacity)
  values (starts_at_input, ends_at_input, trim(driver_name_input), trim(contact_number_input), capacity_limit)
  returning id into slot_id;

  insert into public.audit_logs (actor_id, action, details)
  values (
    (select auth.uid()),
    'transport_slot_created',
    jsonb_build_object('slot_id', slot_id, 'starts_at', starts_at_input, 'capacity', capacity_limit)
  );
  return slot_id;
end;
$$;

create function public.admin_bulk_create_transport_slots(
  date_start_input date,
  date_end_input date,
  driver_name_input text,
  contact_number_input text,
  market_open_input time default null,
  market_close_input time default null,
  slot_length_minutes_input integer default null,
  capacity_input integer default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  capacity_limit integer;
  publish_days integer;
  market_open time;
  market_close_time time;
  slot_length_minutes integer;
  slot_day date;
  slot_start timestamptz;
  slot_end timestamptz;
  market_close timestamptz;
  created_count integer := 0;
  inserted_count integer;
begin
  if not (select public.is_super_admin()) then
    raise exception 'Only an approved super admin can manage transport slots';
  end if;

  select coalesce((value #>> '{}')::integer, 1)
  into capacity_limit
  from public.app_settings
  where key = 'slot_default_capacity';
  capacity_limit := coalesce(capacity_input, capacity_limit, 1);

  select coalesce((value #>> '{}')::integer, 3)
  into publish_days
  from public.app_settings
  where key = 'slot_publish_days_ahead';
  publish_days := coalesce(publish_days, 3);

  select coalesce(
    market_open_input,
    (select (value #>> '{}')::time from public.app_settings where key = 'market_open_time'),
    time '10:00'
  ) into market_open;
  select coalesce(
    market_close_input,
    (select (value #>> '{}')::time from public.app_settings where key = 'market_close_time'),
    time '18:00'
  ) into market_close_time;
  select coalesce(
    slot_length_minutes_input,
    (select (value #>> '{}')::integer from public.app_settings where key = 'slot_length_minutes'),
    60
  ) into slot_length_minutes;

  if date_start_input is null or date_end_input is null or date_end_input < date_start_input
    or date_start_input < (now() at time zone 'Asia/Kolkata')::date
    or date_end_input > (now() at time zone 'Asia/Kolkata')::date + publish_days then
    raise exception 'Choose dates within the configured slot publishing window';
  end if;
  if market_close_time <= market_open
    or slot_length_minutes < 15 or slot_length_minutes > 720 then
    raise exception 'Market hours must be valid and slot length must be between 15 and 720 minutes';
  end if;
  if coalesce(length(trim(driver_name_input)), 0) = 0 or length(trim(driver_name_input)) > 100
    or coalesce(trim(contact_number_input), '') !~ '^[+0-9][0-9+() -]{5,19}$' then
    raise exception 'Enter a truck or driver name and a valid contact number';
  end if;
  if capacity_limit < 1 or capacity_limit > 100 then
    raise exception 'Slot capacity must be between 1 and 100 orders';
  end if;

  slot_day := date_start_input;
  while slot_day <= date_end_input loop
    slot_start := (slot_day + market_open) at time zone 'Asia/Kolkata';
    market_close := (slot_day + market_close_time) at time zone 'Asia/Kolkata';
    while slot_start + make_interval(mins => slot_length_minutes) <= market_close loop
      slot_end := slot_start + make_interval(mins => slot_length_minutes);
      if slot_start > now() then
        insert into public.transport_slots (starts_at, ends_at, driver_name, contact_number, capacity)
        values (slot_start, slot_end, trim(driver_name_input), trim(contact_number_input), capacity_limit)
        on conflict (starts_at, driver_name) do nothing;
        get diagnostics inserted_count = row_count;
        created_count := created_count + inserted_count;
      end if;
      slot_start := slot_end;
    end loop;
    slot_day := slot_day + 1;
  end loop;

  if created_count = 0 then
    raise exception 'No new future transport slots were created';
  end if;

  insert into public.audit_logs (actor_id, action, details)
  values (
    (select auth.uid()),
    'transport_slots_bulk_created',
    jsonb_build_object(
      'date_start', date_start_input,
      'date_end', date_end_input,
      'slot_length_minutes', slot_length_minutes,
      'created_count', created_count,
      'capacity', capacity_limit
    )
  );
  return created_count;
end;
$$;

create function public.admin_update_transport_slot(
  slot_id_input uuid,
  starts_at_input timestamptz,
  ends_at_input timestamptz,
  driver_name_input text,
  contact_number_input text,
  capacity_input integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_slot public.transport_slots%rowtype;
  publish_days integer;
begin
  if not (select public.is_super_admin()) then
    raise exception 'Only an approved super admin can manage transport slots';
  end if;
  select * into old_slot from public.transport_slots where id = slot_id_input for update;
  if not found then
    raise exception 'Transport slot not found';
  end if;

  select coalesce((value #>> '{}')::integer, 3)
  into publish_days
  from public.app_settings
  where key = 'slot_publish_days_ahead';
  publish_days := coalesce(publish_days, 3);
  if starts_at_input <= now() or ends_at_input <= starts_at_input
    or (starts_at_input at time zone 'Asia/Kolkata')::date
      > (now() at time zone 'Asia/Kolkata')::date + publish_days then
    raise exception 'Choose a future slot within the configured publishing window';
  end if;
  if coalesce(length(trim(driver_name_input)), 0) = 0 or length(trim(driver_name_input)) > 100
    or coalesce(trim(contact_number_input), '') !~ '^[+0-9][0-9+() -]{5,19}$' then
    raise exception 'Enter a truck or driver name and a valid contact number';
  end if;
  if capacity_input < 1 or capacity_input > 100 or capacity_input < old_slot.reserved_count then
    raise exception 'Capacity must be between 1 and 100 and cannot be lower than existing bookings';
  end if;

  update public.transport_slots
  set starts_at = starts_at_input,
      ends_at = ends_at_input,
      driver_name = trim(driver_name_input),
      contact_number = trim(contact_number_input),
      capacity = capacity_input,
      status = case
        when status = 'unavailable' then 'unavailable'
        when reserved_count >= capacity_input then 'booked'
        else 'available'
      end
  where id = slot_id_input;

  insert into public.audit_logs (actor_id, action, details)
  values (
    (select auth.uid()),
    'transport_slot_updated',
    jsonb_build_object('slot_id', slot_id_input, 'starts_at', starts_at_input, 'capacity', capacity_input)
  );
end;
$$;

create function public.admin_set_transport_slot_unavailable(slot_id_input uuid, unavailable_input boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot_row public.transport_slots%rowtype;
begin
  if not (select public.is_super_admin()) then
    raise exception 'Only an approved super admin can manage transport slots';
  end if;
  select * into slot_row from public.transport_slots where id = slot_id_input for update;
  if not found then
    raise exception 'Transport slot not found';
  end if;
  if unavailable_input and slot_row.reserved_count > 0 then
    raise exception 'A slot with existing bookings cannot be marked unavailable';
  end if;
  if not unavailable_input and slot_row.starts_at <= now() then
    raise exception 'A past or ongoing slot cannot be made available';
  end if;

  update public.transport_slots
  set status = case
    when unavailable_input then 'unavailable'
    when reserved_count >= capacity then 'booked'
    else 'available'
  end
  where id = slot_id_input;

  insert into public.audit_logs (actor_id, action, details)
  values (
    (select auth.uid()),
    case when unavailable_input then 'transport_slot_unavailable' else 'transport_slot_published' end,
    jsonb_build_object('slot_id', slot_id_input)
  );
end;
$$;

create view public.wholesaler_order_details
with (security_invoker = false)
as
select
  sub.id as sub_order_id,
  sub.order_id,
  sub.wholesaler_id,
  sub.status as sub_order_status,
  sub.amount,
  sub.created_at as sub_order_created_at,
  ord.payment_method,
  ord.payment_status,
  ord.fulfilment_method,
  ord.status as order_status,
  ord.subtotal,
  ord.transport_slot_id,
  ord.created_at as order_created_at,
  business.business_name as retailer_business_name,
  business.shop_number as retailer_shop_number,
  business.contact_name as retailer_contact_name,
  business.contact_phone as retailer_contact_phone,
  slot.starts_at as transport_starts_at,
  slot.ends_at as transport_ends_at,
  slot.driver_name as transport_driver_name,
  slot.contact_number as transport_contact_number
from public.sub_orders sub
join public.orders ord on ord.id = sub.order_id
left join public.business_profiles business on business.user_id = ord.retailer_id
left join public.transport_slots slot on slot.id = ord.transport_slot_id
where sub.wholesaler_id = (select auth.uid())
   or (select public.is_super_admin());

create function public.verify_pickup_token(token_input text)
returns table (
  order_id uuid,
  sub_order_id uuid,
  retailer_business_name text,
  retailer_shop_number text,
  retailer_contact_name text,
  retailer_contact_phone text,
  amount numeric,
  payment_method public.payment_method,
  payment_status public.order_payment_status,
  order_status public.order_status,
  sub_order_status public.order_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_count integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'wholesaler'
      and status = 'approved'
      and profile_completed
  ) then
    raise exception 'An approved wholesaler with a completed profile is required';
  end if;
  if coalesce(trim(token_input), '') = '' then
    raise exception 'Enter a self-pickup token';
  end if;

  return query
  select
    ord.id,
    sub.id,
    business.business_name,
    business.shop_number,
    business.contact_name,
    business.contact_phone,
    sub.amount,
    ord.payment_method,
    ord.payment_status,
    ord.status,
    sub.status
  from public.orders ord
  join public.sub_orders sub on sub.order_id = ord.id
  left join public.business_profiles business on business.user_id = ord.retailer_id
  where upper(ord.pickup_token) = upper(trim(token_input))
    and ord.fulfilment_method = 'self_pickup'
    and ord.status not in ('expired', 'cancelled')
    and sub.wholesaler_id = (select auth.uid());

  get diagnostics verified_count = row_count;
  if verified_count = 0 then
    raise exception 'No active self-pickup order with that token is assigned to your shop';
  end if;
end;
$$;

grant select on public.wholesaler_order_details to authenticated;
revoke all on public.wholesaler_order_details from public, anon;

revoke all on function public.admin_create_transport_slot(timestamptz, timestamptz, text, text, integer) from public, anon;
revoke all on function public.admin_bulk_create_transport_slots(date, date, text, text, time, time, integer, integer) from public, anon;
revoke all on function public.admin_update_transport_slot(uuid, timestamptz, timestamptz, text, text, integer) from public, anon;
revoke all on function public.admin_set_transport_slot_unavailable(uuid, boolean) from public, anon;
revoke all on function public.verify_pickup_token(text) from public, anon;
grant execute on function public.admin_create_transport_slot(timestamptz, timestamptz, text, text, integer) to authenticated;
grant execute on function public.admin_bulk_create_transport_slots(date, date, text, text, time, time, integer, integer) to authenticated;
grant execute on function public.admin_update_transport_slot(uuid, timestamptz, timestamptz, text, text, integer) to authenticated;
grant execute on function public.admin_set_transport_slot_unavailable(uuid, boolean) to authenticated;
grant execute on function public.verify_pickup_token(text) to authenticated;
