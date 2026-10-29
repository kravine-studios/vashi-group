create table public.product_categories (
  name text primary key,
  active boolean not null default true
);

create table public.product_grades (
  name text primary key check (name in ('A', 'B', 'C')),
  active boolean not null default true
);

create table public.product_units (
  name text primary key check (name in ('kg', '25kg', 'ton')),
  active boolean not null default true
);

insert into public.product_categories (name) values
  ('Grains'), ('Rice'), ('Wheat'), ('Spices'), ('Dry Fruits')
on conflict (name) do nothing;

insert into public.product_grades (name) values ('A'), ('B'), ('C')
on conflict (name) do nothing;

insert into public.product_units (name) values ('kg'), ('25kg'), ('ton')
on conflict (name) do nothing;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  wholesaler_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category text not null references public.product_categories (name),
  grade text not null references public.product_grades (name),
  unit text not null references public.product_units (name),
  price numeric(12, 2) not null check (price > 0),
  stock numeric(12, 2) not null default 0 check (stock >= 0),
  min_order numeric(12, 2) not null check (min_order > 0),
  is_active boolean not null default true,
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (length(trim(name)) > 0),
  constraint products_min_order_not_above_stock check (stock = 0 or min_order <= stock),
  constraint products_photo_count check (cardinality(photos) between 1 and 5)
);

create index products_catalogue_idx on public.products (category, grade, price) where is_active and stock > 0;
create index products_wholesaler_idx on public.products (wholesaler_id, created_at desc);

alter table public.product_categories enable row level security;
alter table public.product_grades enable row level security;
alter table public.product_units enable row level security;
alter table public.products enable row level security;

create policy "Master data visible to everyone"
on public.product_categories for select to anon, authenticated using (active);

create policy "Grades visible to everyone"
on public.product_grades for select to anon, authenticated using (active);

create policy "Units visible to everyone"
on public.product_units for select to anon, authenticated using (active);

create policy "Approved users browse active in-stock products"
on public.products for select to authenticated
using (
  (
    is_active and stock > 0
    and exists (
      select 1 from public.profiles viewer
      where viewer.id = (select auth.uid())
        and viewer.status = 'approved'
        and viewer.profile_completed
        and viewer.role in ('retailer', 'super_admin')
    )
    and exists (
      select 1 from public.profiles seller
      where seller.id = wholesaler_id
        and seller.role = 'wholesaler'
        and seller.status = 'approved'
        and seller.profile_completed
    )
  )
  or wholesaler_id = (select auth.uid())
  or (select public.is_super_admin())
);

create policy "Approved wholesalers create products"
on public.products for insert to authenticated
with check (
  wholesaler_id = (select auth.uid())
  and (cardinality(photos) between 1 and 5)
  and not exists (
    select 1
    from unnest(photos) as photo(path)
    where photo.path not like ((select auth.uid())::text || '/%')
  )
  and exists (
    select 1 from public.profiles seller
    where seller.id = (select auth.uid())
      and seller.role = 'wholesaler'
      and seller.status = 'approved'
      and seller.profile_completed
  )
);

create policy "Wholesalers update own products"
on public.products for update to authenticated
using (
  wholesaler_id = (select auth.uid())
  and exists (
    select 1 from public.profiles seller
    where seller.id = (select auth.uid())
      and seller.role = 'wholesaler'
      and seller.status = 'approved'
      and seller.profile_completed
  )
)
with check (
  wholesaler_id = (select auth.uid())
  and (cardinality(photos) between 1 and 5)
  and not exists (
    select 1
    from unnest(photos) as photo(path)
    where photo.path not like ((select auth.uid())::text || '/%')
  )
  and exists (
    select 1 from public.profiles seller
    where seller.id = (select auth.uid())
      and seller.role = 'wholesaler'
      and seller.status = 'approved'
      and seller.profile_completed
  )
);

create policy "Wholesalers delete own products"
on public.products for delete to authenticated
using (
  wholesaler_id = (select auth.uid())
  and exists (
    select 1 from public.profiles seller
    where seller.id = (select auth.uid())
      and seller.role = 'wholesaler'
      and seller.status = 'approved'
      and seller.profile_completed
  )
);

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create view public.wholesaler_directory
with (security_invoker = false)
as
select
  p.id,
  b.business_name,
  b.address,
  b.shop_number,
  b.contact_name,
  b.contact_phone,
  b.logo_path
from public.profiles p
join public.business_profiles b on b.user_id = p.id
where p.role = 'wholesaler'
  and p.status = 'approved'
  and p.profile_completed
  and (select auth.uid()) is not null
  and exists (
    select 1
    from public.profiles viewer
    where viewer.id = (select auth.uid())
      and viewer.status = 'approved'
      and viewer.profile_completed
      and viewer.role in ('retailer', 'super_admin')
  );

grant select on public.product_categories, public.product_grades, public.product_units to anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select on public.wholesaler_directory to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Product images publicly readable"
on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');

create policy "Approved wholesalers upload product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1 from public.profiles seller
    where seller.id = (select auth.uid())
      and seller.role = 'wholesaler'
      and seller.status = 'approved'
      and seller.profile_completed
  )
);

create policy "Wholesalers manage own product images"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles seller
    where seller.id = (select auth.uid())
      and seller.role = 'wholesaler'
      and seller.status = 'approved'
      and seller.profile_completed
  )
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1 from public.profiles seller
    where seller.id = (select auth.uid())
      and seller.role = 'wholesaler'
      and seller.status = 'approved'
      and seller.profile_completed
  )
);

create policy "Wholesalers delete own product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles seller
    where seller.id = (select auth.uid())
      and seller.role = 'wholesaler'
      and seller.status = 'approved'
      and seller.profile_completed
  )
);
