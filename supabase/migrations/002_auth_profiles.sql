create extension if not exists pgcrypto;

create type public.app_role as enum ('super_admin', 'wholesaler', 'retailer');
create type public.account_status as enum ('pending', 'approved', 'rejected', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.app_role not null,
  status public.account_status not null default 'pending',
  profile_completed boolean not null default false,
  rejection_reason text,
  approval_notice_pending boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_rejection_reason_check check (status <> 'rejected' or rejection_reason is not null)
);

create table public.business_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null,
  address text not null,
  gst_number text not null,
  fssai_number text not null,
  shop_number text,
  contact_name text not null,
  contact_phone text not null,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_gst_format check (gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  constraint business_profiles_fssai_format check (fssai_number ~ '^[0-9]{14}$'),
  constraint business_profiles_contact_phone_format check (contact_phone ~ '^[0-9]{10}$')
);

create table public.bank_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  account_holder text not null,
  branch_name text not null,
  account_number text not null,
  ifsc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_details_ifsc_format check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$')
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  subject_id uuid references public.profiles (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_status_created_at_idx on public.profiles (status, created_at);
create index business_profiles_gst_number_idx on public.business_profiles (gst_number);

create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'super_admin'
      and status = 'approved'
  );
$$;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_role public.app_role;
  business jsonb := new.raw_user_meta_data;
  normalized_gst text;
  normalized_fssai text;
  normalized_phone text;
begin
  if coalesce(business ->> 'role', '') not in ('retailer', 'wholesaler') then
    raise exception 'Registration role must be retailer or wholesaler';
  end if;

  user_role := (business ->> 'role')::public.app_role;
  normalized_gst := upper(trim(coalesce(business ->> 'gst_number', '')));
  normalized_fssai := trim(coalesce(business ->> 'fssai_number', ''));
  normalized_phone := trim(coalesce(business ->> 'contact_phone', ''));

  if normalized_gst !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    raise exception 'GST number must be a valid 15-character GSTIN';
  end if;

  if normalized_fssai !~ '^[0-9]{14}$' then
    raise exception 'FSSAI number must contain exactly 14 digits';
  end if;

  if normalized_phone !~ '^[0-9]{10}$' then
    raise exception 'Contact phone must contain exactly 10 digits';
  end if;

  if coalesce(trim(business ->> 'business_name'), '') = ''
    or coalesce(trim(business ->> 'address'), '') = ''
    or coalesce(trim(business ->> 'contact_name'), '') = '' then
    raise exception 'Business name, address, contact name, and contact phone are required';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, lower(new.email), user_role);

  insert into public.business_profiles (
    user_id, business_name, address, gst_number, fssai_number,
    shop_number, contact_name, contact_phone
  )
  values (
    new.id,
    trim(business ->> 'business_name'),
    trim(business ->> 'address'),
    normalized_gst,
    normalized_fssai,
    nullif(trim(coalesce(business ->> 'shop_number', '')), ''),
    trim(business ->> 'contact_name'),
    normalized_phone
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger business_profiles_set_updated_at
before update on public.business_profiles
for each row execute function public.set_updated_at();

create trigger bank_details_set_updated_at
before update on public.bank_details
for each row execute function public.set_updated_at();

create function public.review_registration(target_user_id uuid, approve boolean, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status public.account_status;
  normalized_reason text := nullif(trim(coalesce(reason, '')), '');
begin
  if not public.is_super_admin() then
    raise exception 'Only an approved super admin can review registrations';
  end if;

  if approve is false and normalized_reason is null then
    raise exception 'A rejection reason is required';
  end if;

  select status into target_status
  from public.profiles
  where id = target_user_id
  for update;

  if target_status is distinct from 'pending' then
    raise exception 'Only pending accounts can be reviewed';
  end if;

  update public.profiles
  set status = case when approve then 'approved'::public.account_status else 'rejected'::public.account_status end,
      rejection_reason = case when approve then null else normalized_reason end,
      approval_notice_pending = approve
  where id = target_user_id;

  insert into public.audit_logs (actor_id, subject_id, action, details)
  values (
    (select auth.uid()),
    target_user_id,
    case when approve then 'registration_approved' else 'registration_rejected' end,
    case when approve then '{}'::jsonb else jsonb_build_object('reason', normalized_reason) end
  );
end;
$$;

create function public.complete_my_profile(
  account_holder_input text,
  branch_name_input text,
  account_number_input text,
  ifsc_input text,
  logo_path_input text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_status public.account_status;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to complete your profile';
  end if;

  select status into current_status
  from public.profiles
  where id = current_user_id
  for update;

  if current_status is distinct from 'approved' then
    raise exception 'Only approved accounts can complete their profile';
  end if;

  if coalesce(trim(account_holder_input), '') = ''
    or coalesce(trim(branch_name_input), '') = ''
    or coalesce(trim(account_number_input), '') !~ '^[0-9]{8,20}$'
    or upper(trim(coalesce(ifsc_input, ''))) !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
    raise exception 'Valid bank details are required';
  end if;

  if coalesce(trim(logo_path_input), '') <> '' and split_part(logo_path_input, '/', 1) <> current_user_id::text then
    raise exception 'The logo must be uploaded to your own profile folder';
  end if;

  insert into public.bank_details (user_id, account_holder, branch_name, account_number, ifsc)
  values (
    current_user_id,
    trim(account_holder_input),
    trim(branch_name_input),
    trim(account_number_input),
    upper(trim(ifsc_input))
  )
  on conflict (user_id) do update
  set account_holder = excluded.account_holder,
      branch_name = excluded.branch_name,
      account_number = excluded.account_number,
      ifsc = excluded.ifsc;

  update public.business_profiles
  set logo_path = coalesce(logo_path_input, logo_path)
  where user_id = current_user_id;

  update public.profiles
  set profile_completed = true
  where id = current_user_id;

  insert into public.audit_logs (actor_id, subject_id, action)
  values (current_user_id, current_user_id, 'profile_completed');
end;
$$;

create function public.consume_approval_notice()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  notice_pending boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in';
  end if;

  update public.profiles
  set approval_notice_pending = false
  where id = (select auth.uid())
    and approval_notice_pending = true
  returning true into notice_pending;

  return coalesce(notice_pending, false);
end;
$$;

alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.bank_details enable row level security;
alter table public.audit_logs enable row level security;

create policy "Profiles readable by owner and super admin"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_super_admin()));

create policy "Business profiles readable by owner and super admin"
on public.business_profiles for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_super_admin()));

create policy "Bank details readable only by owner and super admin"
on public.bank_details for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_super_admin()));

create policy "Audit logs readable only by super admin"
on public.audit_logs for select to authenticated
using ((select public.is_super_admin()));

create policy "Users read own logo and super admins read all logos"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-logos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_super_admin())
  )
);

create policy "Users upload logos to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy "Users replace logos in own folder"
on storage.objects for update to authenticated
using (bucket_id = 'profile-logos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'profile-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete logos in own folder"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-logos', 'profile-logos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

revoke all on public.profiles, public.business_profiles, public.bank_details, public.audit_logs from anon;
revoke insert, update, delete on public.profiles, public.business_profiles, public.bank_details, public.audit_logs from authenticated;
grant select on public.profiles, public.business_profiles, public.bank_details, public.audit_logs to authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.review_registration(uuid, boolean, text) from public, anon;
revoke all on function public.complete_my_profile(text, text, text, text, text) from public, anon;
revoke all on function public.consume_approval_notice() from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.review_registration(uuid, boolean, text) to authenticated;
grant execute on function public.complete_my_profile(text, text, text, text, text) to authenticated;
grant execute on function public.consume_approval_notice() to authenticated;
