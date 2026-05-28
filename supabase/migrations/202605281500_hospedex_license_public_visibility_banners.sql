-- HospedeX: public visibility must depend on an active owner license.
-- This migration keeps owner data stored while hiding invalid listings from public surfaces.

alter table public.properties
  add column if not exists active boolean not null default true;

alter table public.licenses drop constraint if exists licenses_status_check;
alter table public.licenses
  add constraint licenses_status_check
  check (status in ('active', 'trial', 'expired', 'suspended', 'cancelled', 'blocked', 'inactive'));

create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  subtitle text not null default '',
  image_url text not null,
  storage_path text,
  link_url text,
  active boolean not null default true,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.home_banners enable row level security;

insert into storage.buckets (id, name, public)
values ('home-banners', 'home-banners', true)
on conflict (id) do update set public = true;

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
      when public.is_super_admin_email(new.email) then 'super_admin'
      else 'hospede'
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        phone = coalesce(public.profiles.phone, excluded.phone),
        role = case
          when public.is_super_admin_email(excluded.email) then 'super_admin'
          else public.profiles.role
        end,
        updated_at = now();
  return new;
end;
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

create or replace function public.is_property_publicly_visible(target_property_id uuid)
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
      and active is true
      and owner_id is not null
      and public.has_active_owner_license(owner_id)
  );
$$;

create or replace function public.is_property_bookable(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_property_publicly_visible(target_property_id);
$$;

create or replace function public.protect_property_license_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_license public.licenses;
begin
  if public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id is null then
      new.owner_id := auth.uid();
    end if;

    select *
      into latest_license
      from public.licenses
      where owner_id = new.owner_id
        and status in ('active', 'trial')
        and starts_at <= current_date
        and expires_at >= current_date
      order by expires_at desc, updated_at desc, created_at desc
      limit 1;

    if latest_license.id is null then
      new.license_key := '';
      new.license_expires_at := null;
      new.license_active := false;
    else
      new.license_key := latest_license.license_key;
      new.license_expires_at := latest_license.expires_at;
      new.license_active := true;
    end if;
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

create or replace function public.sync_owner_license_fields(target_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_license public.licenses;
  has_valid boolean;
begin
  if target_owner_id is null then
    return;
  end if;

  select *
    into chosen_license
    from public.licenses
    where owner_id = target_owner_id
    order by
      case
        when status in ('active', 'trial') and starts_at <= current_date and expires_at >= current_date then 0
        else 1
      end,
      expires_at desc,
      updated_at desc,
      created_at desc
    limit 1;

  if chosen_license.id is null then
    update public.properties
      set license_key = '',
          license_expires_at = null,
          license_active = false,
          updated_at = now()
      where owner_id = target_owner_id;
    return;
  end if;

  has_valid := chosen_license.status in ('active', 'trial')
    and chosen_license.starts_at <= current_date
    and chosen_license.expires_at >= current_date;

  update public.properties
    set license_key = chosen_license.license_key,
        license_expires_at = chosen_license.expires_at,
        license_active = has_valid,
        updated_at = now()
    where owner_id = target_owner_id;
end;
$$;

create or replace function public.sync_property_license_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_owner_license_fields(old.owner_id);
    return old;
  end if;

  perform public.sync_owner_license_fields(new.owner_id);
  if tg_op = 'UPDATE' and old.owner_id is distinct from new.owner_id then
    perform public.sync_owner_license_fields(old.owner_id);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_property_license_fields on public.licenses;
create trigger sync_property_license_fields
  after insert or update or delete on public.licenses
  for each row execute function public.sync_property_license_fields();

do $$
declare
  owner_record record;
begin
  for owner_record in select distinct owner_id from public.licenses where owner_id is not null loop
    perform public.sync_owner_license_fields(owner_record.owner_id);
  end loop;
end $$;

drop policy if exists "Public can read properties" on public.properties;
drop policy if exists "Authenticated owners can manage properties" on public.properties;
drop policy if exists "Public can read photos" on public.property_photos;
drop policy if exists "Authenticated owners can manage photos" on public.property_photos;
drop policy if exists "Public can read unavailable reservation dates" on public.reservations;
drop policy if exists "Authenticated owners can manage reservations" on public.reservations;
drop policy if exists "Public can read home banners" on public.home_banners;
drop policy if exists "Super admins can manage home banners" on public.home_banners;
drop policy if exists "Public can read home banner files" on storage.objects;
drop policy if exists "Super admins can upload home banner files" on storage.objects;
drop policy if exists "Super admins can update home banner files" on storage.objects;
drop policy if exists "Super admins can delete home banner files" on storage.objects;

create policy "Public can read visible properties"
  on public.properties for select
  using (
    public.is_super_admin()
    or owner_id = auth.uid()
    or public.is_property_publicly_visible(id)
  );

create policy "Owners can insert licensed properties"
  on public.properties for insert
  with check (
    public.is_super_admin()
    or (owner_id = auth.uid() and public.has_active_owner_license(auth.uid()))
  );

create policy "Owners can update licensed properties"
  on public.properties for update
  using (
    public.is_super_admin()
    or (owner_id = auth.uid() and public.has_active_owner_license(auth.uid()))
  )
  with check (
    public.is_super_admin()
    or (owner_id = auth.uid() and public.has_active_owner_license(auth.uid()))
  );

create policy "Owners can delete licensed properties"
  on public.properties for delete
  using (
    public.is_super_admin()
    or (owner_id = auth.uid() and public.has_active_owner_license(auth.uid()))
  );

create policy "Public can read visible photos"
  on public.property_photos for select
  using (
    public.is_super_admin()
    or public.is_property_publicly_visible(property_id)
    or exists (
      select 1 from public.properties
      where properties.id = property_photos.property_id
        and properties.owner_id = auth.uid()
    )
  );

create policy "Owners can manage licensed photos"
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

create policy "Public can read visible reservation dates"
  on public.reservations for select
  using (
    public.is_super_admin()
    or guest_user_id = auth.uid()
    or guest_email = auth.email()
    or exists (
      select 1 from public.properties
      where properties.id = reservations.property_id
        and properties.owner_id = auth.uid()
    )
    or (
      status in ('confirmed', 'blocked', 'maintenance')
      and public.is_property_publicly_visible(property_id)
    )
  );

create policy "Owners can manage licensed reservations"
  on public.reservations for all
  using (
    public.is_super_admin()
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

create policy "Public can read home banners"
  on public.home_banners for select
  using (active is true or public.is_super_admin());

create policy "Super admins can manage home banners"
  on public.home_banners for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Public can read home banner files"
  on storage.objects for select
  using (bucket_id = 'home-banners');

create policy "Super admins can upload home banner files"
  on storage.objects for insert
  with check (bucket_id = 'home-banners' and public.is_super_admin());

create policy "Super admins can update home banner files"
  on storage.objects for update
  using (bucket_id = 'home-banners' and public.is_super_admin())
  with check (bucket_id = 'home-banners' and public.is_super_admin());

create policy "Super admins can delete home banner files"
  on storage.objects for delete
  using (bucket_id = 'home-banners' and public.is_super_admin());
