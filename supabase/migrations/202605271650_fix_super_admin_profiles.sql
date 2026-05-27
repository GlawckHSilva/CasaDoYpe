-- Corrige visibilidade/gestao de usuarios para o Super Admin.
-- O painel usa profiles, entao usuarios criados no Auth precisam existir aqui.

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

create or replace function public.is_owner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin();
$$;

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
    raise exception 'Somente o Super Admin pode alterar permissoes.';
  end if;

  if tg_op = 'INSERT' and new.role <> 'hospede' then
    new.role := 'hospede';
  end if;

  return new;
end;
$$;

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
