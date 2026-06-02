-- ERRO 29: proprietarios com licenca ativa devem conseguir salvar casas no Supabase.

alter table public.properties
  add column if not exists active boolean not null default true;

update public.properties
  set active = true
  where active is null;

create or replace function public.protect_property_license_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_license public.licenses;
  current_owner uuid;
begin
  if public.is_super_admin() then
    new.active := coalesce(new.active, true);
    return new;
  end if;

  if tg_op = 'INSERT' then
    current_owner := coalesce(new.owner_id, auth.uid());

    select *
      into owner_license
      from public.licenses
      where owner_id = current_owner
        and status in ('active', 'trial')
        and starts_at <= current_date
        and expires_at >= current_date
      order by expires_at desc, updated_at desc, created_at desc
      limit 1;

    new.owner_email := coalesce(nullif(new.owner_email, ''), auth.jwt() ->> 'email');
    new.active := true;
    new.license_key := coalesce(owner_license.license_key, '');
    new.license_expires_at := owner_license.expires_at;
    new.license_active := owner_license.id is not null;
    return new;
  end if;

  if (
    coalesce(new.license_key, '') is distinct from coalesce(old.license_key, '')
    or coalesce(new.license_expires_at::text, '') is distinct from coalesce(old.license_expires_at::text, '')
    or coalesce(new.license_active, true) is distinct from coalesce(old.license_active, true)
  ) then
    raise exception 'Somente o administrador principal pode alterar licencas de uso.';
  end if;

  new.active := true;
  return new;
end;
$$;

drop trigger if exists protect_property_license_fields on public.properties;
create trigger protect_property_license_fields
  before insert or update on public.properties
  for each row execute function public.protect_property_license_fields();

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
    raise exception 'Voce atingiu o limite de casas da sua licenca.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_property_license_limit on public.properties;
create trigger enforce_property_license_limit
  before insert on public.properties
  for each row execute function public.enforce_property_license_limit();
