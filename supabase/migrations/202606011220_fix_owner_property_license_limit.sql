-- HospedeX: enforce owner property limits using the latest active owner license.

alter table public.properties
  add column if not exists active boolean not null default true;

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
