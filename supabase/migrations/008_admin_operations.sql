alter table public.product_categories
add column gst_rate numeric(5, 2) not null default 0
check (gst_rate between 0 and 100);

create policy "Super admins read all product categories"
on public.product_categories for select to authenticated
using ((select public.is_super_admin()));

create policy "Super admins read all product grades"
on public.product_grades for select to authenticated
using ((select public.is_super_admin()));

create policy "Super admins read all product units"
on public.product_units for select to authenticated
using ((select public.is_super_admin()));

create function public.admin_update_category_gst_rate(category_name_input text, gst_rate_input numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_rate numeric(5, 2);
begin
  if not (select public.is_super_admin()) then
    raise exception 'Only an approved super admin can update category tax rates';
  end if;
  if gst_rate_input is null or gst_rate_input not between 0 and 100 then
    raise exception 'GST reference rate must be between 0 and 100 percent';
  end if;
  select gst_rate into previous_rate
  from public.product_categories
  where name = category_name_input
  for update;
  if not found then
    raise exception 'Product category not found';
  end if;
  update public.product_categories
  set gst_rate = gst_rate_input
  where name = category_name_input;
  insert into public.audit_logs (actor_id, action, details)
  values (
    (select auth.uid()),
    'category_gst_rate_updated',
    jsonb_build_object(
      'category', category_name_input,
      'before', previous_rate,
      'after', gst_rate_input
    )
  );
end;
$$;

create function public.admin_set_account_status(
  target_user_id uuid,
  status_input public.account_status,
  reason_input text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role public.app_role;
  before_status public.account_status;
  normalized_reason text := nullif(trim(coalesce(reason_input, '')), '');
begin
  if not (select public.is_super_admin()) then
    raise exception 'Only an approved super admin can manage accounts';
  end if;
  if target_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own account status';
  end if;
  if status_input not in ('approved', 'suspended') then
    raise exception 'Accounts can only be suspended or reinstated';
  end if;
  if status_input = 'suspended' and length(coalesce(normalized_reason, '')) < 5 then
    raise exception 'Enter a suspension reason of at least five characters';
  end if;

  select role, status into target_role, before_status
  from public.profiles
  where id = target_user_id
  for update;
  if not found or target_role = 'super_admin'
    or before_status not in ('approved', 'suspended')
    or before_status = status_input then
    raise exception 'This account cannot be changed from its current status';
  end if;

  update public.profiles
  set status = status_input,
      rejection_reason = null
  where id = target_user_id;

  insert into public.audit_logs (actor_id, subject_id, action, details)
  values (
    (select auth.uid()),
    target_user_id,
    case when status_input = 'suspended' then 'account_suspended' else 'account_reinstated' end,
    jsonb_build_object(
      'before_status', before_status,
      'after_status', status_input,
      'reason', normalized_reason
    )
  );
end;
$$;

create or replace function public.can_read_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = target_order_id
      and (
        (select public.is_super_admin())
        or exists (
          select 1 from public.profiles p
          where p.id = o.retailer_id
            and p.id = (select auth.uid())
            and p.role = 'retailer'
            and p.status = 'approved'
            and p.profile_completed
        )
        or exists (
          select 1
          from public.sub_orders s
          join public.profiles p on p.id = s.wholesaler_id
          where s.order_id = o.id
            and p.id = (select auth.uid())
            and p.role = 'wholesaler'
            and p.status = 'approved'
            and p.profile_completed
        )
      )
  );
$$;

create or replace function public.can_read_sub_order(target_sub_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sub_orders s
    join public.orders o on o.id = s.order_id
    where s.id = target_sub_order_id
      and (
        (select public.is_super_admin())
        or exists (
          select 1 from public.profiles p
          where p.id = o.retailer_id
            and p.id = (select auth.uid())
            and p.role = 'retailer'
            and p.status = 'approved'
            and p.profile_completed
        )
        or exists (
          select 1 from public.profiles p
          where p.id = s.wholesaler_id
            and p.id = (select auth.uid())
            and p.role = 'wholesaler'
            and p.status = 'approved'
            and p.profile_completed
        )
      )
  );
$$;

create or replace function public.can_read_dispute(target_dispute_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.disputes d
    join public.orders o on o.id = d.order_id
    where d.id = target_dispute_id
      and (
        (select public.is_super_admin())
        or exists (
          select 1 from public.profiles p
          where p.id = o.retailer_id
            and p.id = (select auth.uid())
            and p.status = 'approved'
            and p.profile_completed
        )
        or exists (
          select 1 from public.profiles p
          join public.sub_orders participant_order on participant_order.wholesaler_id = p.id
          where participant_order.order_id = d.order_id
            and (d.sub_order_id is null or participant_order.id = d.sub_order_id)
            and p.id = (select auth.uid())
            and p.status = 'approved'
            and p.profile_completed
        )
      )
  );
$$;

create function public.admin_update_app_setting(setting_key_input text, setting_value_input jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_value jsonb;
  numeric_value numeric;
  time_value text;
  open_time text;
  close_time text;
begin
  if not (select public.is_super_admin()) then
    raise exception 'Only an approved super admin can update settings';
  end if;

  if setting_key_input in ('cod_order_cap', 'slot_default_capacity', 'slot_publish_days_ahead', 'slot_length_minutes') then
    if jsonb_typeof(setting_value_input) <> 'number' then
      raise exception 'This setting requires a number';
    end if;
    numeric_value := (setting_value_input #>> '{}')::numeric;
    if numeric_value <> trunc(numeric_value) then
      raise exception 'This setting requires a whole number';
    end if;
    if (setting_key_input = 'cod_order_cap' and numeric_value not between 1 and 1000000)
      or (setting_key_input = 'slot_default_capacity' and numeric_value not between 1 and 100)
      or (setting_key_input = 'slot_publish_days_ahead' and numeric_value not between 0 and 30)
      or (setting_key_input = 'slot_length_minutes' and numeric_value not between 15 and 720) then
      raise exception 'The value is outside the allowed range';
    end if;
  elsif setting_key_input in ('market_open_time', 'market_close_time') then
    if jsonb_typeof(setting_value_input) <> 'string' then
      raise exception 'This setting requires a time in HH:MM format';
    end if;
    time_value := setting_value_input #>> '{}';
    if time_value !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Enter a valid time in HH:MM format';
    end if;
    perform 1
    from public.app_settings
    where key in ('market_open_time', 'market_close_time')
    order by key
    for update;
    select value #>> '{}' into open_time from public.app_settings where key = 'market_open_time';
    select value #>> '{}' into close_time from public.app_settings where key = 'market_close_time';
    if setting_key_input = 'market_open_time' then open_time := time_value; end if;
    if setting_key_input = 'market_close_time' then close_time := time_value; end if;
    if open_time >= close_time then
      raise exception 'Market closing time must be after opening time';
    end if;
  else
    raise exception 'This setting is not editable from the admin panel';
  end if;

  select value into previous_value from public.app_settings where key = setting_key_input for update;
  if not found then
    raise exception 'The requested setting does not exist';
  end if;
  update public.app_settings
  set value = setting_value_input,
      updated_at = now()
  where key = setting_key_input;

  insert into public.audit_logs (actor_id, action, details)
  values (
    (select auth.uid()),
    'app_setting_updated',
    jsonb_build_object(
      'key', setting_key_input,
      'before', previous_value,
      'after', setting_value_input
    )
  );
end;
$$;

revoke all on function public.admin_set_account_status(uuid, public.account_status, text) from public, anon;
revoke all on function public.admin_update_app_setting(text, jsonb) from public, anon;
revoke all on function public.admin_update_category_gst_rate(text, numeric) from public, anon;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text) to authenticated;
grant execute on function public.admin_update_app_setting(text, jsonb) to authenticated;
grant execute on function public.admin_update_category_gst_rate(text, numeric) to authenticated;
