-- HospedeX: Super Admin, roles oficiais, licencas e RLS.

update public.profiles
  set role = case
    when role = 'admin' then 'proprietario'
    when role = 'client' then 'hospede'
    else role
  end
  where role in ('admin', 'client');

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'proprietario', 'hospede'));

create or replace function public.is_super_admin()
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
      and role = 'super_admin'
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

create or replace function public.enforce_property_license_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_properties integer;
  current_properties integer;
begin
  if public.is_super_admin() then
    return new;
  end if;

  if tg_op <> 'INSERT' then
    return new;
  end if;

  if new.owner_id is distinct from auth.uid() then
    raise exception 'Proprietario invalido para este imovel.';
  end if;

  select max(property_limit)
    into allowed_properties
    from public.licenses
    where owner_id = auth.uid()
      and status in ('active', 'trial')
      and expires_at >= current_date;

  if allowed_properties is null then
    raise exception 'Licenca ativa necessaria para cadastrar imoveis.';
  end if;

  select count(*)
    into current_properties
    from public.properties
    where owner_id = auth.uid();

  if current_properties >= allowed_properties then
    raise exception 'Limite de imoveis da licenca atingido.';
  end if;

  return new;
end;
$$;

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

create or replace function public.protect_profile_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    raise exception 'Somente o Super Admin pode alterar permissoes.';
  end if;

  if tg_op = 'INSERT' and new.role <> 'hospede' then
    new.role := 'hospede';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_property_license_limit on public.properties;
create trigger enforce_property_license_limit
  before insert on public.properties
  for each row execute function public.enforce_property_license_limit();

drop trigger if exists sync_property_license_fields on public.licenses;
create trigger sync_property_license_fields
  after insert or update or delete on public.licenses
  for each row execute function public.sync_property_license_fields();

drop trigger if exists protect_profile_role_changes on public.profiles;
create trigger protect_profile_role_changes
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role_changes();

drop policy if exists "Users can insert own profile" on public.profiles;
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

drop policy if exists "Guests can create reservation requests" on public.reservations;
create policy "Guests can create reservation requests"
  on public.reservations for insert
  with check (
    status = 'pending'
    and payment_status = 'pending'
    and public.is_property_bookable(property_id)
  );

drop policy if exists "Authenticated owners can manage properties" on public.properties;
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

drop policy if exists "Authenticated owners can manage reservations" on public.reservations;
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

drop policy if exists "Authenticated owners can manage cash movements" on public.cash_movements;
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

drop policy if exists "Owners can manage payment settings" on public.payment_settings;
create policy "Owners can manage payment settings"
  on public.payment_settings for all
  using (public.is_super_admin() or (owner_id = auth.uid() and public.has_active_owner_license(auth.uid())))
  with check (public.is_super_admin() or (owner_id = auth.uid() and public.has_active_owner_license(auth.uid())));
