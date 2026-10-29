create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'rejected');
create type public.dispute_resolution as enum ('refund', 'replacement', 'dismissed');

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  sub_order_id uuid references public.sub_orders (id) on delete cascade,
  raised_by uuid not null references public.profiles (id) on delete restrict,
  reason text not null check (reason in ('missing_items', 'damaged_goods', 'wrong_items', 'quality_issue', 'payment_issue', 'other')),
  description text not null check (length(trim(description)) between 10 and 4000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 5),
  status public.dispute_status not null default 'open',
  resolution public.dispute_resolution,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disputes_resolution_check check (
    (status in ('resolved', 'rejected') and resolution is not null and resolution_notes is not null)
    or (status in ('open', 'under_review') and resolution is null and resolution_notes is null)
  )
);

create table public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  message text not null check (length(trim(message)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index disputes_status_created_idx on public.disputes (status, created_at desc);
create index disputes_order_id_idx on public.disputes (order_id);
create index dispute_messages_dispute_created_idx on public.dispute_messages (dispute_id, created_at);
create index notifications_unread_recipient_idx on public.notifications (recipient_id, created_at desc) where read_at is null;

create trigger disputes_set_updated_at
before update on public.disputes
for each row execute function public.set_updated_at();

alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;
alter table public.notifications enable row level security;

create function public.can_read_dispute(target_dispute_id uuid)
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
    left join public.sub_orders s on s.id = d.sub_order_id
    where d.id = target_dispute_id
      and (
        (select public.is_super_admin())
        or o.retailer_id = (select auth.uid())
        or s.wholesaler_id = (select auth.uid())
      )
  );
$$;

create function public.notify_user(
  recipient uuid,
  notification_type text,
  notification_title text,
  notification_message text,
  notification_payload jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, type, title, message, payload)
  select recipient, notification_type, notification_title, notification_message, coalesce(notification_payload, '{}'::jsonb)
  where recipient is not null;
$$;

create function public.notify_registration_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_name text;
  admin record;
begin
  if tg_op = 'INSERT' then
    select b.business_name into business_name from public.business_profiles b where b.user_id = new.id;
    for admin in select id from public.profiles where role = 'super_admin' and status = 'approved' loop
      perform public.notify_user(
        admin.id,
        'registration_submitted',
        'New registration',
        'New ' || new.role::text || ' awaiting approval: ' || coalesce(business_name, new.email),
        jsonb_build_object('user_id', new.id)
      );
    end loop;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform public.notify_user(
      new.id,
      'registration_' || new.status::text,
      case when new.status = 'approved' then 'Registration approved' else 'Registration rejected' end,
      case when new.status = 'approved'
        then 'You have been successfully registered in this community.'
        else 'Registration rejected: ' || coalesce(new.rejection_reason, 'Contact support for details.')
      end,
      jsonb_build_object('user_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger profiles_notify_registration
after insert or update of status on public.profiles
for each row execute function public.notify_registration_event();

create function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  retailer_name text;
  shop_number text;
  seller record;
begin
  select business_name, business_profiles.shop_number
  into retailer_name, shop_number
  from public.business_profiles
  where user_id = (select o.retailer_id from public.orders o where o.id = new.order_id);
  perform public.notify_user(
    new.wholesaler_id,
    'new_order',
    'New order received',
    coalesce(retailer_name, 'A retailer') || ', Shop ' || coalesce(shop_number, '—')
      || ' has placed an order of ₹' || new.amount::text,
    jsonb_build_object('order_id', new.order_id, 'sub_order_id', new.id)
  );
  return new;
end;
$$;

create trigger sub_orders_notify_new_order
after insert on public.sub_orders
for each row execute function public.notify_new_order();

create function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform public.notify_user(
      new.retailer_id,
      'order_status_changed',
      'Order status updated',
      'Your order status is now ' || replace(new.status::text, '_', ' ') || '.',
      jsonb_build_object('order_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger orders_notify_status
after update of status on public.orders
for each row execute function public.notify_order_status();

create function public.notify_sub_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  retailer_id uuid;
begin
  if new.status is distinct from old.status then
    select o.retailer_id into retailer_id from public.orders o where o.id = new.order_id;
    perform public.notify_user(
      retailer_id,
      'order_status_changed',
      'Order status updated',
      'Your order from a wholesaler is now ' || replace(new.status::text, '_', ' ') || '.',
      jsonb_build_object('order_id', new.order_id, 'sub_order_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger sub_orders_notify_status
after update of status on public.sub_orders
for each row execute function public.notify_sub_order_status();

create function public.notify_transport_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  slot_row public.transport_slots%rowtype;
  seller record;
  business_name text;
begin
  select * into order_row from public.orders where id = new.order_id;
  select * into slot_row from public.transport_slots where id = new.slot_id;
  select business_profiles.business_name into business_name
  from public.business_profiles where user_id = order_row.retailer_id;
  perform public.notify_user(
    order_row.retailer_id,
    'transport_slot_booked',
    'Truck slot booked',
    'Your truck slot is ' || slot_row.starts_at::text || ' with ' || slot_row.driver_name || ' (' || slot_row.contact_number || ').',
    jsonb_build_object('order_id', order_row.id, 'slot_id', slot_row.id)
  );
  for seller in select distinct wholesaler_id from public.sub_orders where order_id = order_row.id loop
    perform public.notify_user(
      seller.wholesaler_id,
      'transport_slot_booked',
      'Truck slot booked',
      coalesce(business_name, 'A retailer') || ' booked ' || slot_row.starts_at::text || ' with '
        || slot_row.driver_name || ' (' || slot_row.contact_number || ').',
      jsonb_build_object('order_id', order_row.id, 'slot_id', slot_row.id)
    );
  end loop;
  for seller in select id from public.profiles where role = 'super_admin' and status = 'approved' loop
    perform public.notify_user(
      seller.id,
      'transport_slot_booked',
      'Transport slot booked',
      'A truck slot was booked for order ' || left(order_row.id::text, 8) || '.',
      jsonb_build_object('order_id', order_row.id, 'slot_id', slot_row.id)
    );
  end loop;
  return new;
end;
$$;

create trigger transport_bookings_notify
after insert on public.transport_bookings
for each row execute function public.notify_transport_booking();

create function public.notify_dispute_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  seller record;
  recipient_id uuid;
begin
  select * into order_row from public.orders where id = new.order_id;
  if tg_op = 'INSERT' then
    for seller in select id from public.profiles where role = 'super_admin' and status = 'approved' loop
      perform public.notify_user(seller.id, 'dispute_raised', 'Dispute raised', 'A new dispute needs review: ' || new.reason || '.', jsonb_build_object('dispute_id', new.id));
    end loop;
    if order_row.retailer_id <> new.raised_by then
      perform public.notify_user(order_row.retailer_id, 'dispute_raised', 'Dispute raised', 'A dispute was opened for your order.', jsonb_build_object('dispute_id', new.id));
    end if;
    for seller in
      select distinct s.wholesaler_id
      from public.sub_orders s
      where s.order_id = new.order_id
        and (new.sub_order_id is null or s.id = new.sub_order_id)
        and s.wholesaler_id <> new.raised_by
    loop
      perform public.notify_user(seller.wholesaler_id, 'dispute_raised', 'Dispute raised', 'A dispute was opened for an order involving your shop.', jsonb_build_object('dispute_id', new.id));
    end loop;
  else
    for recipient_id in
      select distinct p.id
      from public.profiles p
      where p.id <> (select auth.uid())
        and (
          p.id = order_row.retailer_id
          or exists (
            select 1 from public.sub_orders s
            where s.order_id = new.order_id
              and (new.sub_order_id is null or s.id = new.sub_order_id)
              and s.wholesaler_id = p.id
          )
          or p.role = 'super_admin'
        )
    loop
      perform public.notify_user(
        recipient_id,
        'dispute_updated',
        'Dispute updated',
        'Dispute status: ' || replace(new.status::text, '_', ' ') || '.',
        jsonb_build_object('dispute_id', new.id, 'status', new.status)
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger disputes_notify
after insert or update on public.disputes
for each row execute function public.notify_dispute_event();

create function public.notify_dispute_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dispute_row public.disputes%rowtype;
  retailer_id uuid;
  recipient_id uuid;
begin
  select * into dispute_row from public.disputes where id = new.dispute_id;
  select o.retailer_id into retailer_id from public.orders o where o.id = dispute_row.order_id;
  for recipient_id in
    select distinct p.id
    from public.profiles p
    where p.id <> new.sender_id
      and (
        p.role = 'super_admin'
        or p.id = retailer_id
        or exists (
          select 1 from public.sub_orders s
          where s.order_id = dispute_row.order_id
            and (dispute_row.sub_order_id is null or s.id = dispute_row.sub_order_id)
            and s.wholesaler_id = p.id
        )
      )
  loop
    perform public.notify_user(
      recipient_id,
      'dispute_updated',
      'New dispute message',
      'A participant added a message to a dispute.',
      jsonb_build_object('dispute_id', dispute_row.id)
    );
  end loop;
  return new;
end;
$$;

create trigger dispute_messages_notify
after insert on public.dispute_messages
for each row execute function public.notify_dispute_message();

create function public.create_dispute(
  order_id_input uuid,
  sub_order_id_input uuid,
  reason_input text,
  description_input text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  dispute_id uuid;
  order_row public.orders%rowtype;
begin
  select * into order_row
  from public.orders
  where id = order_id_input
  for share;
  if not found or not (select public.can_read_order(order_id_input)) then
    raise exception 'You are not a participant in this order';
  end if;
  if (select auth.uid()) <> order_row.retailer_id
    and not exists (
      select 1 from public.sub_orders
      where order_id = order_id_input and wholesaler_id = (select auth.uid())
        and (sub_order_id_input is null or id = sub_order_id_input)
    ) then
    raise exception 'Only the retailer or an involved wholesaler can raise a dispute';
  end if;
  if sub_order_id_input is not null and not exists (
    select 1 from public.sub_orders where id = sub_order_id_input and order_id = order_id_input
  ) then
    raise exception 'The selected sub-order does not belong to this order';
  end if;
  if order_row.status in ('expired', 'cancelled') then
    raise exception 'A dispute cannot be raised for an expired or cancelled order';
  end if;
  if reason_input not in ('missing_items', 'damaged_goods', 'wrong_items', 'quality_issue', 'payment_issue', 'other')
    or length(trim(description_input)) < 10 or length(trim(description_input)) > 4000 then
    raise exception 'Choose a reason and enter a description between 10 and 4000 characters';
  end if;

  insert into public.disputes (order_id, sub_order_id, raised_by, reason, description)
  values (order_id_input, sub_order_id_input, (select auth.uid()), reason_input, trim(description_input))
  returning id into dispute_id;

  if sub_order_id_input is not null then
    update public.payouts set status = 'held', released_at = null
    where sub_order_id = sub_order_id_input and status <> 'cancelled';
  else
    update public.payouts p set status = 'held', released_at = null
    where p.sub_order_id in (select id from public.sub_orders where order_id = order_id_input)
      and p.status <> 'cancelled';
  end if;
  return dispute_id;
end;
$$;

create function public.add_dispute_message(dispute_id_input uuid, message_input text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_id uuid;
begin
  if not (select public.can_read_dispute(dispute_id_input)) then
    raise exception 'You cannot access this dispute';
  end if;
  if length(trim(message_input)) < 1 or length(trim(message_input)) > 4000 then
    raise exception 'Message must contain between 1 and 4000 characters';
  end if;
  insert into public.dispute_messages (dispute_id, sender_id, message)
  values (dispute_id_input, (select auth.uid()), trim(message_input))
  returning id into message_id;
  return message_id;
end;
$$;

create function public.attach_dispute_photos(dispute_id_input uuid, photo_paths_input text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.can_read_dispute(dispute_id_input)) then
    raise exception 'You cannot attach photos to this dispute';
  end if;
  if photo_paths_input is null or cardinality(photo_paths_input) > 5
    or exists (
      select 1 from unnest(photo_paths_input) photo_path
      where split_part(photo_path, '/', 1) <> (select auth.uid())::text
        or split_part(photo_path, '/', 2) <> dispute_id_input::text
        or photo_path !~ '\.(jpg|jpeg|png|webp)$'
    ) then
    raise exception 'Dispute photos must be up to five image files stored in your dispute folder';
  end if;
  update public.disputes
  set photo_paths = photo_paths_input
  where id = dispute_id_input;
end;
$$;

create function public.admin_update_dispute(
  dispute_id_input uuid,
  status_input public.dispute_status,
  resolution_input public.dispute_resolution default null,
  resolution_notes_input text default null,
  message_input text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  dispute_row public.disputes%rowtype;
begin
  if not (select public.is_super_admin()) then
    raise exception 'Only an approved super admin can manage disputes';
  end if;
  select * into dispute_row from public.disputes where id = dispute_id_input for update;
  if not found then raise exception 'Dispute not found'; end if;
  if status_input in ('resolved', 'rejected')
    and (resolution_input is null or length(trim(coalesce(resolution_notes_input, ''))) < 5) then
    raise exception 'A resolution and notes of at least five characters are required';
  end if;
  if status_input in ('open', 'under_review') and (resolution_input is not null or resolution_notes_input is not null) then
    raise exception 'An unresolved dispute cannot include a final resolution';
  end if;

  update public.disputes
  set status = status_input,
      resolution = resolution_input,
      resolution_notes = nullif(trim(resolution_notes_input), '')
  where id = dispute_id_input;

  if message_input is not null and length(trim(message_input)) > 0 then
    perform public.add_dispute_message(dispute_id_input, message_input);
  end if;

  if status_input in ('resolved', 'rejected') then
    if resolution_input = 'refund' then
      update public.payouts set status = 'cancelled', released_at = null
      where sub_order_id in (
        select s.id from public.sub_orders s
        where s.order_id = dispute_row.order_id
          and (dispute_row.sub_order_id is null or s.id = dispute_row.sub_order_id)
      );
    elsif not exists (
      select 1 from public.disputes active
      where active.id <> dispute_id_input
        and active.status in ('open', 'under_review')
        and active.order_id = dispute_row.order_id
        and (active.sub_order_id = dispute_row.sub_order_id or active.sub_order_id is null or dispute_row.sub_order_id is null)
    ) then
      update public.payouts p set status = 'released', released_at = now()
      where p.sub_order_id in (
        select s.id from public.sub_orders s
        where s.order_id = dispute_row.order_id
          and (dispute_row.sub_order_id is null or s.id = dispute_row.sub_order_id)
          and s.status = 'completed'
      )
      and p.status = 'held';
    end if;
  end if;

  insert into public.audit_logs (actor_id, subject_id, action, details)
  values (
    (select auth.uid()),
    dispute_row.raised_by,
    'dispute_updated',
    jsonb_build_object(
      'dispute_id', dispute_id_input,
      'before_status', dispute_row.status,
      'after_status', status_input,
      'resolution', resolution_input,
      'resolution_notes', resolution_notes_input
    )
  );
end;
$$;

create or replace function public.release_mock_payout_for_completed_sub_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.payouts
    set status = 'released',
        released_at = now()
    where sub_order_id = new.id
      and status = 'held'
      and not exists (
        select 1 from public.disputes d
        where d.status in ('open', 'under_review')
          and (d.sub_order_id = new.id or d.sub_order_id is null and d.order_id = new.order_id)
      );
  end if;
  return new;
end;
$$;

create policy "Participants and admins read disputes"
on public.disputes for select to authenticated
using ((select public.can_read_dispute(id)));

create policy "Participants and admins read dispute messages"
on public.dispute_messages for select to authenticated
using ((select public.can_read_dispute(dispute_id)));

create policy "Users manage their own notifications"
on public.notifications for select to authenticated
using (recipient_id = (select auth.uid()));

create policy "Users mark their own notifications read"
on public.notifications for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

revoke all on public.disputes, public.dispute_messages, public.notifications from anon;
revoke insert, update, delete on public.disputes, public.dispute_messages, public.notifications from authenticated;
grant select on public.disputes, public.dispute_messages, public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant usage on type public.dispute_status, public.dispute_resolution to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dispute-photos', 'dispute-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Participants read dispute photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'dispute-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_super_admin())
    or (select public.can_read_dispute(((storage.foldername(name))[2])::uuid))
  )
);

create policy "Participants upload dispute photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'dispute-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.can_read_dispute(((storage.foldername(name))[2])::uuid))
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

revoke all on function public.can_read_dispute(uuid), public.notify_user(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.create_dispute(uuid, uuid, text, text) from public, anon;
revoke all on function public.add_dispute_message(uuid, text) from public, anon;
revoke all on function public.attach_dispute_photos(uuid, text[]) from public, anon;
revoke all on function public.admin_update_dispute(uuid, public.dispute_status, public.dispute_resolution, text, text) from public, anon;
grant execute on function public.can_read_dispute(uuid) to authenticated;
grant execute on function public.create_dispute(uuid, uuid, text, text) to authenticated;
grant execute on function public.add_dispute_message(uuid, text) to authenticated;
grant execute on function public.attach_dispute_photos(uuid, text[]) to authenticated;
grant execute on function public.admin_update_dispute(uuid, public.dispute_status, public.dispute_resolution, text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end;
$$;
