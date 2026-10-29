create type public.payment_method as enum ('online', 'cod');
create type public.fulfilment_method as enum ('truck_slot', 'self_pickup');
create type public.order_status as enum ('pending_payment', 'confirmed', 'expired', 'cancelled', 'completed');
create type public.order_payment_status as enum ('pending', 'pending_cod', 'paid', 'failed', 'refunded');

alter table public.products drop constraint products_min_order_not_above_stock;

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('cod_order_cap', '5000'::jsonb)
on conflict (key) do nothing;

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity numeric(12, 2) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create table public.transport_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  driver_name text not null,
  contact_number text not null,
  status text not null default 'available' check (status in ('available', 'booked', 'unavailable')),
  capacity integer not null default 1 check (capacity > 0),
  reserved_count integer not null default 0 check (reserved_count >= 0 and reserved_count <= capacity),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_slots_time_check check (ends_at > starts_at)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.profiles (id) on delete restrict,
  payment_method public.payment_method not null,
  payment_status public.order_payment_status not null,
  fulfilment_method public.fulfilment_method not null,
  status public.order_status not null,
  pickup_token text unique,
  transport_slot_id uuid references public.transport_slots (id) on delete restrict,
  subtotal numeric(12, 2) not null check (subtotal > 0),
  reservation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_fulfilment_reference_check check (
    (fulfilment_method = 'self_pickup' and pickup_token is not null and transport_slot_id is null)
    or (fulfilment_method = 'truck_slot' and pickup_token is null and transport_slot_id is not null)
  ),
  constraint orders_payment_expiry_check check (
    (
      payment_method = 'online'
      and (
        (status = 'pending_payment' and reservation_expires_at is not null)
        or (status <> 'pending_payment' and reservation_expires_at is null)
      )
    )
    or (payment_method = 'cod' and reservation_expires_at is null)
  )
);

create table public.sub_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  wholesaler_id uuid not null references public.profiles (id) on delete restrict,
  status public.order_status not null default 'confirmed',
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, wholesaler_id)
);

create table public.sub_order_items (
  id uuid primary key default gen_random_uuid(),
  sub_order_id uuid not null references public.sub_orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  category text not null,
  grade text not null,
  unit text not null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  quantity numeric(12, 2) not null check (quantity > 0),
  line_total numeric(12, 2) not null check (line_total > 0),
  created_at timestamptz not null default now()
);

create table public.transport_bookings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  slot_id uuid not null references public.transport_slots (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index cart_items_cart_id_idx on public.cart_items (cart_id);
create index orders_retailer_created_idx on public.orders (retailer_id, created_at desc);
create index orders_expiry_idx on public.orders (reservation_expires_at) where status = 'pending_payment';
create index sub_orders_wholesaler_created_idx on public.sub_orders (wholesaler_id, created_at desc);
create index sub_order_items_sub_order_idx on public.sub_order_items (sub_order_id);
create index transport_slots_available_idx on public.transport_slots (starts_at) where status = 'available';

create trigger carts_set_updated_at
before update on public.carts
for each row execute function public.set_updated_at();

create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

create trigger transport_slots_set_updated_at
before update on public.transport_slots
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger sub_orders_set_updated_at
before update on public.sub_orders
for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.transport_slots enable row level security;
alter table public.orders enable row level security;
alter table public.sub_orders enable row level security;
alter table public.sub_order_items enable row level security;
alter table public.transport_bookings enable row level security;

create function public.can_read_order(target_order_id uuid)
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
        o.retailer_id = (select auth.uid())
        or (select public.is_super_admin())
        or exists (
          select 1 from public.sub_orders s
          where s.order_id = o.id and s.wholesaler_id = (select auth.uid())
        )
      )
  );
$$;

create function public.can_read_sub_order(target_sub_order_id uuid)
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
        s.wholesaler_id = (select auth.uid())
        or o.retailer_id = (select auth.uid())
        or (select public.is_super_admin())
      )
  );
$$;

create policy "Super admins read app settings"
on public.app_settings for select to authenticated
using ((select public.is_super_admin()));

create policy "Retailers read the COD order limit"
on public.app_settings for select to authenticated
using (
  key = 'cod_order_cap'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'retailer'
      and p.status = 'approved'
      and p.profile_completed
  )
);

create policy "Retailers manage their own cart"
on public.carts for all to authenticated
using (
  retailer_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'retailer'
      and p.status = 'approved'
      and p.profile_completed
  )
)
with check (
  retailer_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'retailer'
      and p.status = 'approved'
      and p.profile_completed
  )
);

create policy "Retailers manage items in their own cart"
on public.cart_items for all to authenticated
using (
  exists (
    select 1 from public.carts c
    where c.id = cart_id and c.retailer_id = (select auth.uid())
  )
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'retailer'
      and p.status = 'approved'
      and p.profile_completed
  )
)
with check (
  exists (
    select 1 from public.carts c
    where c.id = cart_id and c.retailer_id = (select auth.uid())
  )
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'retailer'
      and p.status = 'approved'
      and p.profile_completed
  )
);

create policy "Approved retailers see available truck slots"
on public.transport_slots for select to authenticated
using (
  status = 'available'
  and reserved_count < capacity
  and starts_at > now()
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'retailer'
      and p.status = 'approved'
      and p.profile_completed
  )
);

create policy "Retailers and involved wholesalers read orders"
on public.orders for select to authenticated
using ((select public.can_read_order(id)));

create policy "Retailers and involved wholesalers read sub-orders"
on public.sub_orders for select to authenticated
using ((select public.can_read_sub_order(id)));

create policy "Retailers and involved wholesalers read sub-order items"
on public.sub_order_items for select to authenticated
using ((select public.can_read_sub_order(sub_order_id)));

create policy "Order participants and super admins read transport bookings"
on public.transport_bookings for select to authenticated
using ((select public.can_read_order(order_id)));

revoke all on public.app_settings, public.carts, public.cart_items, public.transport_slots,
  public.orders, public.sub_orders, public.sub_order_items, public.transport_bookings from anon;
revoke insert, update, delete on public.carts, public.cart_items, public.transport_slots,
  public.orders, public.sub_orders, public.sub_order_items, public.transport_bookings from authenticated;
grant select on public.app_settings to authenticated;
grant select, insert, update, delete on public.carts, public.cart_items to authenticated;
grant select on public.transport_slots, public.orders, public.sub_orders,
  public.sub_order_items, public.transport_bookings to authenticated;

create function public.place_order(
  cart_lines jsonb,
  payment_method_input public.payment_method,
  fulfilment_method_input public.fulfilment_method,
  transport_slot_id_input uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
<<order_transaction>>
declare
  retailer uuid := (select auth.uid());
  account_status public.account_status;
  line_count integer;
  distinct_product_count integer;
  cart_total numeric(12, 2) := 0;
  cod_cap numeric(12, 2);
  order_id uuid;
  seller_id uuid;
  seller_sub_order_id uuid;
  current_token text;
  slot_row public.transport_slots%rowtype;
  cart_line record;
  product_row public.products%rowtype;
  line_total numeric(12, 2);
begin
  if retailer is null then
    raise exception 'Sign in before placing an order';
  end if;

  select status into account_status
  from public.profiles
  where id = retailer
    and role = 'retailer'
    and profile_completed
  for update;

  if account_status is distinct from 'approved' then
    raise exception 'An approved retailer with a completed profile is required';
  end if;

  if jsonb_typeof(cart_lines) is distinct from 'array' then
    raise exception 'Cart lines must be a JSON array';
  end if;

  if jsonb_array_length(cart_lines) = 0 then
    raise exception 'Add at least one product to your cart';
  end if;

  line_count := jsonb_array_length(cart_lines);
  if line_count > 100 then
    raise exception 'An order cannot contain more than 100 products';
  end if;

  select count(distinct product_id) into distinct_product_count
  from jsonb_to_recordset(cart_lines) as item(product_id uuid, quantity numeric);

  if distinct_product_count <> line_count then
    raise exception 'Cart contains duplicate or invalid product identifiers';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(cart_lines) as item(product_id uuid, quantity numeric)
    where item.quantity is null or item.quantity <= 0
  ) then
    raise exception 'Every product quantity must be greater than zero';
  end if;

  if fulfilment_method_input = 'self_pickup' and transport_slot_id_input is not null then
    raise exception 'A transport slot cannot be attached to a self-pickup order';
  end if;

  if fulfilment_method_input = 'truck_slot' and transport_slot_id_input is null then
    raise exception 'Choose an available truck slot';
  end if;

  if fulfilment_method_input = 'truck_slot' then
    select * into slot_row
    from public.transport_slots
    where id = transport_slot_id_input
    for update;

    if not found or slot_row.status <> 'available' or slot_row.starts_at <= now()
      or slot_row.reserved_count >= slot_row.capacity then
      raise exception 'The selected truck slot is no longer available';
    end if;
  end if;

  for cart_line in
    select item.product_id, item.quantity
    from jsonb_to_recordset(cart_lines) as item(product_id uuid, quantity numeric)
    order by item.product_id
  loop
    select * into product_row
    from public.products
    where id = cart_line.product_id
    for update;

    if not found
      or not product_row.is_active
      or product_row.stock <= 0
      or cart_line.quantity < product_row.min_order
      or cart_line.quantity > product_row.stock
      or not exists (
        select 1
        from public.profiles seller
        where seller.id = product_row.wholesaler_id
          and seller.role = 'wholesaler'
          and seller.status = 'approved'
          and seller.profile_completed
      ) then
      raise exception 'A product is unavailable or its stock, seller status, or minimum order has changed';
    end if;

    cart_total := cart_total + (product_row.price * cart_line.quantity);
  end loop;

  if payment_method_input = 'cod' then
    select coalesce((value #>> '{}')::numeric, 5000)
    into cod_cap
    from public.app_settings
    where key = 'cod_order_cap';
    cod_cap := coalesce(cod_cap, 5000);
    if cart_total > cod_cap then
      raise exception 'COD orders are limited to ₹% by the marketplace', cod_cap;
    end if;
  end if;

  if fulfilment_method_input = 'self_pickup' then
    loop
      current_token := 'KR-' || upper(substr(
        encode(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()), 'hex'),
        1,
        8
      ));
      exit when not exists (select 1 from public.orders where pickup_token = current_token);
    end loop;
  end if;

  insert into public.orders (
    retailer_id,
    payment_method,
    payment_status,
    fulfilment_method,
    status,
    pickup_token,
    transport_slot_id,
    subtotal,
    reservation_expires_at
  )
  values (
    retailer,
    payment_method_input,
    case when payment_method_input = 'cod' then 'pending_cod'::public.order_payment_status else 'pending'::public.order_payment_status end,
    fulfilment_method_input,
    case when payment_method_input = 'cod' then 'confirmed'::public.order_status else 'pending_payment'::public.order_status end,
    current_token,
    transport_slot_id_input,
    cart_total,
    case when payment_method_input = 'online' then now() + interval '15 minutes' else null end
  )
  returning id into order_id;

  for cart_line in
    select item.product_id, item.quantity
    from jsonb_to_recordset(cart_lines) as item(product_id uuid, quantity numeric)
    order by item.product_id
  loop
    select * into product_row
    from public.products
    where id = cart_line.product_id;

    seller_id := product_row.wholesaler_id;
    line_total := product_row.price * cart_line.quantity;
    select id into seller_sub_order_id
    from public.sub_orders
    where sub_orders.order_id = order_transaction.order_id
      and sub_orders.wholesaler_id = seller_id;

    if seller_sub_order_id is null then
      insert into public.sub_orders (order_id, wholesaler_id, amount, status)
      values (
        order_id,
        seller_id,
        line_total,
        case when payment_method_input = 'cod' then 'confirmed'::public.order_status else 'pending_payment'::public.order_status end
      )
      returning id into seller_sub_order_id;
    else
      update public.sub_orders
      set amount = amount + line_total
      where id = seller_sub_order_id;
    end if;

    insert into public.sub_order_items (
      sub_order_id, product_id, product_name, category, grade, unit, unit_price, quantity, line_total
    )
    values (
      seller_sub_order_id,
      product_row.id,
      product_row.name,
      product_row.category,
      product_row.grade,
      product_row.unit,
      product_row.price,
      cart_line.quantity,
      line_total
    );

    update public.products
    set stock = stock - cart_line.quantity
    where id = product_row.id;
  end loop;

  if fulfilment_method_input = 'truck_slot' then
    insert into public.transport_bookings (order_id, slot_id)
    values (order_id, transport_slot_id_input);

    update public.transport_slots
    set reserved_count = reserved_count + 1,
        status = case when reserved_count + 1 >= capacity then 'booked' else 'available' end
    where id = transport_slot_id_input;
  end if;

  delete from public.carts where retailer_id = retailer;

  return order_id;
end order_transaction;
$function$;

create function public.release_expired_order_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_order record;
  released_count integer := 0;
begin
  for expired_order in
    select id, transport_slot_id
    from public.orders
    where status = 'pending_payment'
      and reservation_expires_at <= now()
    order by reservation_expires_at
    for update skip locked
  loop
    update public.products p
    set stock = p.stock + reserved.quantity
    from (
      select item.product_id, sum(item.quantity) as quantity
      from public.sub_order_items item
      join public.sub_orders sub on sub.id = item.sub_order_id
      where sub.order_id = expired_order.id
      group by item.product_id
    ) reserved
    where p.id = reserved.product_id;

    update public.orders
    set status = 'expired',
        payment_status = 'failed',
        reservation_expires_at = null
    where id = expired_order.id
      and status = 'pending_payment';

    update public.sub_orders
    set status = 'expired'
    where order_id = expired_order.id;

    if expired_order.transport_slot_id is not null then
      update public.transport_slots
      set reserved_count = greatest(reserved_count - 1, 0),
          status = case
            when status = 'unavailable' then status
            when reserved_count - 1 < capacity then 'available'
            else status
          end
      where id = expired_order.transport_slot_id;
    end if;

    released_count := released_count + 1;
  end loop;
  return released_count;
end;
$$;

revoke all on function public.place_order(jsonb, public.payment_method, public.fulfilment_method, uuid) from public, anon;
revoke all on function public.release_expired_order_reservations() from public, anon, authenticated;
revoke all on function public.can_read_order(uuid), public.can_read_sub_order(uuid) from public, anon;
grant execute on function public.can_read_order(uuid), public.can_read_sub_order(uuid) to authenticated;
grant execute on function public.place_order(jsonb, public.payment_method, public.fulfilment_method, uuid) to authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'release-expired-online-order-stock',
  '* * * * *',
  'select public.release_expired_order_reservations()'
);
