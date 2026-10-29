create type public.payment_record_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payout_status as enum ('held', 'released', 'cancelled');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  provider text not null default 'mock' check (provider = 'mock'),
  provider_order_id text not null unique,
  provider_payment_id text unique,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status public.payment_record_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mock' check (provider = 'mock'),
  event_id text not null unique,
  event_type text not null,
  order_id uuid not null references public.orders (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  sub_order_id uuid not null unique references public.sub_orders (id) on delete cascade,
  wholesaler_id uuid not null references public.profiles (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  status public.payout_status not null default 'held',
  provider_transfer_id text unique,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_status_created_idx on public.payments (status, created_at desc);
create index payment_events_order_created_idx on public.payment_events (order_id, created_at desc);
create index payouts_wholesaler_status_idx on public.payouts (wholesaler_id, status, created_at desc);

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger payouts_set_updated_at
before update on public.payouts
for each row execute function public.set_updated_at();

create function public.record_pending_mock_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_payment_id uuid;
begin
  if new.payment_method = 'online' then
    insert into public.payments (order_id, provider_order_id, amount, status)
    values (new.id, 'mock-order-' || new.id::text, new.subtotal, 'pending')
    returning id into created_payment_id;

    insert into public.payment_events (event_id, event_type, order_id, payment_id, payload)
    values (
      'mock-order-created-' || new.id::text,
      'mock.payment_initiated',
      new.id,
      created_payment_id,
      jsonb_build_object('mock', true, 'amount', new.subtotal)
    );
  end if;
  return new;
end;
$$;

create function public.fail_pending_mock_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'expired' and old.status = 'pending_payment' then
    update public.payments
    set status = 'failed',
        provider_payment_id = null,
        paid_at = null
    where order_id = new.id
      and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger orders_record_pending_mock_payment
after insert on public.orders
for each row execute function public.record_pending_mock_payment();

create trigger orders_fail_pending_mock_payment
after update of status on public.orders
for each row execute function public.fail_pending_mock_payment();

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.payouts enable row level security;

create policy "Order participants and super admins read payments"
on public.payments for select to authenticated
using ((select public.can_read_order(order_id)));

create policy "Super admins read payment events"
on public.payment_events for select to authenticated
using ((select public.is_super_admin()));

create policy "Wholesalers and super admins read payouts"
on public.payouts for select to authenticated
using (
  wholesaler_id = (select auth.uid())
  or (select public.is_super_admin())
);

revoke all on public.payments, public.payment_events, public.payouts from anon;
revoke insert, update, delete on public.payments, public.payment_events, public.payouts from authenticated;
grant select on public.payments, public.payment_events, public.payouts to authenticated;

create function public.complete_mock_payment(
  target_order_id uuid,
  target_retailer_id uuid,
  payment_succeeded boolean,
  idempotency_key text
)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  created_payment_id uuid;
  result_status public.order_status;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Mock payment completion is only available to the trusted server';
  end if;

  if idempotency_key is null or length(trim(idempotency_key)) < 8 or length(idempotency_key) > 200 then
    raise exception 'A valid payment idempotency key is required';
  end if;

  select * into order_row
  from public.orders
  where id = target_order_id
    and retailer_id = target_retailer_id
    and payment_method = 'online'
  for update;

  if not found then
    raise exception 'The online order was not found for this retailer';
  end if;

  insert into public.payment_events (event_id, event_type, order_id, payload)
  values (
    idempotency_key,
    case when payment_succeeded then 'mock.payment_succeeded' else 'mock.payment_failed' end,
    target_order_id,
    jsonb_build_object('mock', true, 'succeeded', payment_succeeded)
  )
  on conflict (event_id) do nothing;

  if not found then
    return order_row.status;
  end if;

  if order_row.status <> 'pending_payment' then
    update public.payment_events
    set payload = payload || jsonb_build_object('ignored', true, 'order_status', order_row.status)
    where event_id = idempotency_key;
    return order_row.status;
  end if;

  insert into public.payments (
    order_id, provider_order_id, provider_payment_id, amount, status, paid_at
  )
  values (
    target_order_id,
    'mock-order-' || target_order_id::text,
    case when payment_succeeded then 'mock-payment-' || idempotency_key else null end,
    order_row.subtotal,
    case when payment_succeeded then 'paid'::public.payment_record_status else 'failed'::public.payment_record_status end,
    case when payment_succeeded then now() else null end
  )
  on conflict (order_id) do update
  set provider_payment_id = excluded.provider_payment_id,
      amount = excluded.amount,
      status = excluded.status,
      paid_at = excluded.paid_at
  returning id into created_payment_id;

  update public.payment_events
  set payment_id = created_payment_id
  where event_id = idempotency_key;

  if payment_succeeded and order_row.reservation_expires_at > now() then
    update public.orders
    set status = 'confirmed',
        payment_status = 'paid',
        reservation_expires_at = null
    where id = target_order_id;

    update public.sub_orders
    set status = 'confirmed'
    where order_id = target_order_id;

    insert into public.payouts (sub_order_id, wholesaler_id, amount)
    select id, wholesaler_id, amount
    from public.sub_orders
    where order_id = target_order_id
    on conflict (sub_order_id) do nothing;
  else
    if payment_succeeded then
      update public.payments
      set status = 'failed',
          provider_payment_id = null,
          paid_at = null
      where id = created_payment_id;
    end if;

    update public.orders
    set reservation_expires_at = now()
    where id = target_order_id
      and status = 'pending_payment';

    perform public.release_expired_order_reservations();
    update public.payment_events
    set payload = payload || jsonb_build_object('reservation_expired', true)
    where event_id = idempotency_key
      and payment_succeeded;
  end if;

  select status into result_status
  from public.orders
  where id = target_order_id;

  return result_status;
end;
$$;

create function public.release_mock_payout_for_completed_sub_order()
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
      and status = 'held';
  end if;
  return new;
end;
$$;

create trigger sub_order_release_mock_payout
after update of status on public.sub_orders
for each row execute function public.release_mock_payout_for_completed_sub_order();

revoke all on function public.complete_mock_payment(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.release_mock_payout_for_completed_sub_order() from public, anon, authenticated;
revoke all on function public.record_pending_mock_payment() from public, anon, authenticated;
revoke all on function public.fail_pending_mock_payment() from public, anon, authenticated;
grant execute on function public.complete_mock_payment(uuid, uuid, boolean, text) to service_role;
