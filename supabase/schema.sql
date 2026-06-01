create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  slug text unique,
  name text not null,
  city text not null,
  headline text not null,
  description text not null,
  daily_rate numeric(10, 2) not null default 0,
  cleaning_fee numeric(10, 2) not null default 0,
  max_guests integer not null default 1,
  bedrooms integer not null default 1,
  bathrooms integer not null default 1,
  owner_whatsapp text default '43998108328',
  owner_email text,
  maps_url text,
  theme_color text default '#2563eb',
  license_key text,
  license_expires_at date,
  license_active boolean not null default true,
  active boolean not null default true,
  amenities text[] not null default '{}',
  rules text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  role text not null default 'hospede' check (role in ('super_admin', 'proprietario', 'hospede')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    case
      when lower(coalesce(new.email, '')) = lower('glawcksilva55@gmail.com') then 'super_admin'
      when lower(coalesce(new.email, '')) = lower('glawcksilva8@gmail.com') then 'proprietario'
      else 'hospede'
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        phone = coalesce(public.profiles.phone, excluded.phone),
        role = case
          when lower(excluded.email) = lower('glawcksilva55@gmail.com') then 'super_admin'
          when lower(excluded.email) = lower('glawcksilva8@gmail.com') and public.profiles.role = 'hospede' then 'proprietario'
          else public.profiles.role
        end,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;
  update public.profiles
    set role = case
      when role = 'admin' then 'proprietario'
      when role = 'client' then 'hospede'
      else role
    end
    where role in ('admin', 'client');
  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('super_admin', 'proprietario', 'hospede'));
end $$;

alter table public.properties
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

alter table public.properties
  add column if not exists slug text unique;

alter table public.properties
  add column if not exists owner_whatsapp text;

alter table public.properties
  add column if not exists owner_email text;

alter table public.properties
  add column if not exists maps_url text;

alter table public.properties
  add column if not exists theme_color text default '#2563eb';

alter table public.properties
  add column if not exists license_key text;

alter table public.properties
  add column if not exists license_expires_at date;

alter table public.properties
  add column if not exists license_active boolean not null default true;

alter table public.properties
  add column if not exists active boolean not null default true;

alter table public.properties
  alter column owner_whatsapp set default '43998108328';

update public.properties
  set owner_whatsapp = '43998108328'
  where owner_whatsapp is null or owner_whatsapp = '';

create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  url text not null,
  storage_path text,
  alt text not null default '',
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  guest_user_id uuid references auth.users(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  guest_document text,
  guests integer not null default 1,
  check_in date not null,
  check_out date not null,
  total_amount numeric(10, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'blocked', 'maintenance')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'not_required')),
  payment_method text not null default 'pix' check (payment_method in ('pix', 'card', 'transfer', 'cash', 'check')),
  installments integer not null default 1,
  interest_rate numeric(6, 2) not null default 0,
  interest_amount numeric(10, 2) not null default 0,
  source text not null default 'site' check (source in ('site', 'manual')),
  voucher_used boolean not null default false,
  payment_url text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.reservations
  add column if not exists payment_method text not null default 'pix';

alter table public.reservations
  add column if not exists guest_user_id uuid references auth.users(id) on delete set null;

alter table public.reservations
  add column if not exists installments integer not null default 1;

alter table public.reservations
  add column if not exists interest_rate numeric(6, 2) not null default 0;

alter table public.reservations
  add column if not exists interest_amount numeric(10, 2) not null default 0;

alter table public.reservations
  add column if not exists source text not null default 'site';

alter table public.reservations
  add column if not exists voucher_used boolean not null default false;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'reservations_status_check'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations drop constraint reservations_status_check;
  end if;
  alter table public.reservations
    add constraint reservations_status_check
    check (status in ('pending', 'confirmed', 'cancelled', 'blocked', 'maintenance'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'reservations_payment_method_check'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations drop constraint reservations_payment_method_check;
  end if;
  alter table public.reservations
    add constraint reservations_payment_method_check
    check (payment_method in ('pix', 'card', 'transfer', 'cash', 'check'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'reservations_valid_dates_check'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations drop constraint reservations_valid_dates_check;
  end if;
  alter table public.reservations
    add constraint reservations_valid_dates_check
    check (check_out > check_in);
end $$;

alter table public.property_photos
  add column if not exists storage_path text;

alter table public.property_photos
  add column if not exists is_primary boolean not null default false;

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  type text not null default 'income' check (type in ('income', 'expense')),
  status text not null default 'expected' check (status in ('expected', 'received', 'cancelled')),
  payment_method text not null default 'cash' check (payment_method in ('pix', 'card', 'cash', 'check')),
  amount numeric(10, 2) not null default 0,
  due_date date not null default current_date,
  paid_at timestamptz,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  amount numeric(10, 2) not null default 0,
  method text not null default 'pix',
  installments integer not null default 1,
  interest_rate numeric(6, 2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'cash_movements_payment_method_check'
      and conrelid = 'public.cash_movements'::regclass
  ) then
    alter table public.cash_movements drop constraint cash_movements_payment_method_check;
  end if;
  alter table public.cash_movements
    add constraint cash_movements_payment_method_check
    check (payment_method in ('pix', 'card', 'transfer', 'cash', 'check'));
end $$;

create table if not exists public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  property_id uuid unique references public.properties(id) on delete cascade,
  pix_key text,
  pix_key_type text,
  pix_receiver_name text,
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text,
  bank_holder text,
  bank_document text,
  card_payment_url text,
  max_installments integer not null default 1,
  payment_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  license_key text not null unique,
  status text not null default 'trial' check (status in ('active', 'expired', 'suspended', 'trial')),
  plan text not null default 'mensal',
  starts_at date not null default current_date,
  expires_at date not null default (current_date + interval '30 days'),
  monthly_value numeric(10, 2) not null default 0,
  property_limit integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.license_history (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references public.licenses(id) on delete cascade,
  action text not null,
  actor_email text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  nights_accumulated integer not null default 0,
  free_nights integer not null default 1,
  status text not null default 'available' check (status in ('available', 'used', 'expired')),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  name text,
  user_email text,
  email text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now()
);

alter table public.suggestions
  add column if not exists name text;

alter table public.suggestions
  add column if not exists email text;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  name text,
  subject text not null,
  category text not null default 'duvida' check (category in ('erro', 'duvida', 'sugestao')),
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.interest_settings (
  id uuid primary key default gen_random_uuid(),
  installments integer not null unique,
  rate numeric(6, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.interest_settings (installments, rate)
values (1, 0), (2, 3), (3, 5), (4, 7)
on conflict (installments) do nothing;

insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', true)
on conflict (id) do update set public = true;

alter table public.properties enable row level security;
alter table public.profiles enable row level security;
alter table public.property_photos enable row level security;
alter table public.reservations enable row level security;
alter table public.cash_movements enable row level security;
alter table public.payments enable row level security;
alter table public.vouchers enable row level security;
alter table public.suggestions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.admin_logs enable row level security;
alter table public.interest_settings enable row level security;
alter table public.payment_settings enable row level security;
alter table public.licenses enable row level security;
alter table public.license_history enable row level security;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = lower('glawcksilva55@gmail.com')
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'super_admin'
    );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'proprietario'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or public.is_owner();
$$;

create or replace function public.is_owner_admin_email(target_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(target_email, '')) in (
    lower('glawcksilva8@gmail.com'),
    lower('glawcksiva8@gmail.com')
  );
$$;

create or replace function public.is_super_admin_email(target_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(target_email, '')) = lower('glawcksilva55@gmail.com');
$$;

create or replace function public.is_owner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin();
$$;

create or replace function public.has_active_owner_license(target_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.licenses
    where owner_id = target_owner_id
      and status in ('active', 'trial')
      and starts_at <= current_date
      and expires_at >= current_date
  );
$$;

create or replace function public.is_property_bookable(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.properties
    where id = target_property_id
      and license_active is true
      and (license_expires_at is null or license_expires_at >= current_date)
  );
$$;

create or replace function public.protect_property_license_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.license_key := '';
    new.license_expires_at := null;
    new.license_active := false;
    return new;
  end if;

  if (
    coalesce(new.license_key, '') is distinct from coalesce(old.license_key, '')
    or coalesce(new.license_expires_at::text, '') is distinct from coalesce(old.license_expires_at::text, '')
    or coalesce(new.license_active, true) is distinct from coalesce(old.license_active, true)
  ) then
    raise exception 'Somente o administrador principal pode alterar licencas de uso.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_property_license_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner uuid;
  active_license public.licenses;
  allowed_properties integer;
  current_properties integer;
begin
  if public.is_super_admin() then
    return new;
  end if;

  if tg_op <> 'INSERT' then
    return new;
  end if;

  current_owner := coalesce(new.owner_id, auth.uid());

  if current_owner is null then
    raise exception 'Licenca ativa necessaria para cadastrar imoveis.';
  end if;

  if current_owner is distinct from auth.uid() then
    raise exception 'Proprietario invalido para este imovel.';
  end if;

  new.owner_id := current_owner;

  select *
    into active_license
    from public.licenses
    where owner_id = current_owner
      and status in ('active', 'trial')
      and starts_at <= current_date
      and expires_at >= current_date
    order by expires_at desc, updated_at desc, created_at desc
    limit 1;

  if active_license.id is null then
    raise exception 'Licenca ativa necessaria para cadastrar imoveis.';
  end if;

  allowed_properties := greatest(coalesce(active_license.property_limit, 1), 0);

  select count(*)
    into current_properties
    from public.properties
    where owner_id = current_owner
      and active is not false;

  if current_properties >= allowed_properties then
    raise exception 'Você atingiu o limite de casas da sua licença.';
  end if;

  return new;
end;
$$;

create or replace function public.protect_profile_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.is_super_admin_email(new.email) then
      new.role := 'super_admin';
      return new;
    end if;

    if lower(coalesce(new.email, '')) = lower('glawcksilva8@gmail.com') and new.role = 'proprietario' then
      return new;
    end if;
  end if;

  if public.is_owner_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    raise exception 'Somente o administrador principal pode alterar permissoes.';
  end if;

  if tg_op = 'INSERT' and new.role <> 'hospede' then
    new.role := 'hospede';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_property_license_fields on public.properties;
create trigger protect_property_license_fields
  before insert or update on public.properties
  for each row execute function public.protect_property_license_fields();

drop trigger if exists enforce_property_license_limit on public.properties;
create trigger enforce_property_license_limit
  before insert on public.properties
  for each row execute function public.enforce_property_license_limit();

drop trigger if exists protect_profile_role_changes on public.profiles;
create trigger protect_profile_role_changes
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role_changes();

alter table public.profiles disable trigger protect_profile_role_changes;

insert into public.profiles (id, email, full_name, phone, role)
select
  users.id,
  coalesce(users.email, ''),
  users.raw_user_meta_data ->> 'full_name',
  users.raw_user_meta_data ->> 'phone',
  case
    when lower(coalesce(users.email, '')) = lower('glawcksilva55@gmail.com') then 'super_admin'
    when lower(coalesce(users.email, '')) = lower('glawcksilva8@gmail.com') then 'proprietario'
    else 'hospede'
  end
from auth.users
where users.email is not null
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      phone = coalesce(public.profiles.phone, excluded.phone),
      role = case
        when lower(excluded.email) = lower('glawcksilva55@gmail.com') then 'super_admin'
        when lower(excluded.email) = lower('glawcksilva8@gmail.com') and public.profiles.role = 'hospede' then 'proprietario'
        else public.profiles.role
      end,
      updated_at = now();

update public.profiles
  set role = 'super_admin',
      updated_at = now()
  where lower(email) = lower('glawcksilva55@gmail.com')
    and role <> 'super_admin';

alter table public.profiles enable trigger protect_profile_role_changes;

create or replace function public.set_profile_role(target_profile_id uuid, target_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_super_admin() then
    raise exception 'Somente o Super Admin pode alterar permissoes.';
  end if;

  if target_role not in ('super_admin', 'proprietario', 'hospede') then
    raise exception 'Role invalida: %', target_role;
  end if;

  update public.profiles
    set role = target_role,
        updated_at = now()
    where id = target_profile_id
    returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Usuario nao encontrado.';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.set_profile_role(uuid, text) to authenticated;

create or replace function public.sync_property_license_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_property_id uuid;
  target_owner_id uuid;
  next_active boolean;
begin
  if tg_op = 'DELETE' then
    target_property_id := old.property_id;
    target_owner_id := old.owner_id;

    update public.properties
      set license_key = '',
          license_expires_at = null,
          license_active = false,
          updated_at = now()
      where (target_property_id is not null and id = target_property_id)
         or (target_property_id is null and target_owner_id is not null and owner_id = target_owner_id);

    return old;
  end if;

  target_property_id := new.property_id;
  target_owner_id := new.owner_id;
  next_active := new.status in ('active', 'trial') and new.expires_at >= current_date;

  update public.properties
    set license_key = new.license_key,
        license_expires_at = new.expires_at,
        license_active = next_active,
        updated_at = now()
    where (target_property_id is not null and id = target_property_id)
       or (target_property_id is null and target_owner_id is not null and owner_id = target_owner_id);

  return new;
end;
$$;

drop trigger if exists sync_property_license_fields on public.licenses;
create trigger sync_property_license_fields
  after insert or update or delete on public.licenses
  for each row execute function public.sync_property_license_fields();

drop policy if exists "Public can read properties" on public.properties;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Public can read photos" on public.property_photos;
drop policy if exists "Public can read unavailable reservation dates" on public.reservations;
drop policy if exists "Guests can create reservation requests" on public.reservations;
drop policy if exists "Authenticated owners can manage properties" on public.properties;
drop policy if exists "Authenticated owners can manage photos" on public.property_photos;
drop policy if exists "Authenticated owners can manage reservations" on public.reservations;
drop policy if exists "Authenticated owners can manage cash movements" on public.cash_movements;
drop policy if exists "Admins can manage payments" on public.payments;
drop policy if exists "Users can read own vouchers" on public.vouchers;
drop policy if exists "Admins can manage vouchers" on public.vouchers;
drop policy if exists "Authenticated users can send suggestions" on public.suggestions;
drop policy if exists "Admins can read suggestions" on public.suggestions;
drop policy if exists "Authenticated users can send support tickets" on public.support_tickets;
drop policy if exists "Users can read own support tickets" on public.support_tickets;
drop policy if exists "Super admins can manage support tickets" on public.support_tickets;
drop policy if exists "Admins can manage logs" on public.admin_logs;
drop policy if exists "Public can read interest settings" on public.interest_settings;
drop policy if exists "Admins can manage interest settings" on public.interest_settings;
drop policy if exists "Owners can manage payment settings" on public.payment_settings;
drop policy if exists "Super admins can manage payment settings" on public.payment_settings;
drop policy if exists "Owners can read own licenses" on public.licenses;
drop policy if exists "Super admins can manage licenses" on public.licenses;
drop policy if exists "Owners can read own license history" on public.license_history;
drop policy if exists "Super admins can manage license history" on public.license_history;
drop policy if exists "Public can read property photo files" on storage.objects;
drop policy if exists "Admins can upload property photo files" on storage.objects;
drop policy if exists "Admins can update property photo files" on storage.objects;
drop policy if exists "Admins can delete property photo files" on storage.objects;

create policy "Public can read property photo files"
  on storage.objects for select
  using (bucket_id = 'property-photos');

create policy "Admins can upload property photo files"
  on storage.objects for insert
  with check (bucket_id = 'property-photos' and public.is_admin());

create policy "Admins can update property photo files"
  on storage.objects for update
  using (bucket_id = 'property-photos' and public.is_admin())
  with check (bucket_id = 'property-photos' and public.is_admin());

create policy "Admins can delete property photo files"
  on storage.objects for delete
  using (bucket_id = 'property-photos' and public.is_admin());

create policy "Public can read properties"
  on public.properties for select
  using (true);

create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid() or public.is_super_admin());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (
    id = auth.uid()
    and (
      role = 'hospede'
      or (role = 'super_admin' and public.is_super_admin_email(email))
      or (role = 'proprietario' and lower(email) = lower('glawcksilva8@gmail.com'))
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_super_admin()
    or (
      id = auth.uid()
      and role = (
        select role
        from public.profiles
        where profiles.id = auth.uid()
      )
    )
  );

create policy "Public can read photos"
  on public.property_photos for select
  using (true);

create policy "Public can read unavailable reservation dates"
  on public.reservations for select
  using (status in ('confirmed', 'blocked', 'maintenance'));

create policy "Guests can create reservation requests"
  on public.reservations for insert
  with check (
    status = 'pending'
    and payment_status = 'pending'
    and public.is_property_bookable(property_id)
  );

create policy "Authenticated owners can manage properties"
  on public.properties for all
  using (
    public.is_super_admin()
    or (owner_id = auth.uid() and public.has_active_owner_license(auth.uid()))
  )
  with check (
    public.is_super_admin()
    or (owner_id = auth.uid() and public.has_active_owner_license(auth.uid()))
  );

create policy "Authenticated owners can manage photos"
  on public.property_photos for all
  using (
    public.is_super_admin()
    or (
      public.has_active_owner_license(auth.uid())
      and exists (
      select 1 from public.properties
      where properties.id = property_photos.property_id
        and properties.owner_id = auth.uid()
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.has_active_owner_license(auth.uid())
      and exists (
      select 1 from public.properties
      where properties.id = property_photos.property_id
        and properties.owner_id = auth.uid()
      )
    )
  );

create policy "Authenticated owners can manage reservations"
  on public.reservations for all
  using (
    public.is_super_admin()
    or guest_user_id = auth.uid()
    or guest_email = auth.email()
    or (
      public.has_active_owner_license(auth.uid())
      and exists (
      select 1 from public.properties
      where properties.id = reservations.property_id
        and properties.owner_id = auth.uid()
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.has_active_owner_license(auth.uid())
      and exists (
      select 1 from public.properties
      where properties.id = reservations.property_id
        and properties.owner_id = auth.uid()
      )
    )
  );

create policy "Authenticated owners can manage cash movements"
  on public.cash_movements for all
  using (
    public.is_super_admin()
    or (
      public.has_active_owner_license(auth.uid())
      and exists (
      select 1 from public.properties
      where properties.id = cash_movements.property_id
        and properties.owner_id = auth.uid()
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.has_active_owner_license(auth.uid())
      and exists (
      select 1 from public.properties
      where properties.id = cash_movements.property_id
        and properties.owner_id = auth.uid()
      )
    )
  );

create policy "Admins can manage payments"
  on public.payments for all
  using (public.is_super_admin() or user_id = auth.uid())
  with check (public.is_super_admin());

create policy "Users can read own vouchers"
  on public.vouchers for select
  using (public.is_admin() or user_id = auth.uid());

create policy "Admins can manage vouchers"
  on public.vouchers for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Authenticated users can send suggestions"
  on public.suggestions for insert
  with check (auth.role() = 'authenticated' or user_id is null);

create policy "Admins can read suggestions"
  on public.suggestions for select
  using (public.is_super_admin() or public.is_owner());

create policy "Authenticated users can send support tickets"
  on public.support_tickets for insert
  with check (auth.role() = 'authenticated' and (user_id = auth.uid() or user_id is null));

create policy "Users can read own support tickets"
  on public.support_tickets for select
  using (public.is_super_admin() or user_id = auth.uid() or user_email = auth.email());

create policy "Super admins can manage support tickets"
  on public.support_tickets for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Admins can manage logs"
  on public.admin_logs for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Public can read interest settings"
  on public.interest_settings for select
  using (true);

create policy "Admins can manage interest settings"
  on public.interest_settings for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Owners can manage payment settings"
  on public.payment_settings for all
  using (public.is_super_admin() or (owner_id = auth.uid() and public.has_active_owner_license(auth.uid())))
  with check (public.is_super_admin() or (owner_id = auth.uid() and public.has_active_owner_license(auth.uid())));

create policy "Owners can read own licenses"
  on public.licenses for select
  using (public.is_super_admin() or owner_id = auth.uid());

create policy "Super admins can manage licenses"
  on public.licenses for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Owners can read own license history"
  on public.license_history for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.licenses
      where licenses.id = license_history.license_id
        and licenses.owner_id = auth.uid()
    )
  );

create policy "Super admins can manage license history"
  on public.license_history for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Do not expose the service_role key in the browser.
