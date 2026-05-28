-- HospedeX: public house slugs and in-app support tickets.

alter table public.properties
  add column if not exists slug text unique;

create extension if not exists unaccent with schema public;

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(public.unaccent(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.ensure_property_slug()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_slug text;
  next_slug text;
  suffix integer := 2;
begin
  base_slug := public.slugify(coalesce(new.slug, new.name, 'hospedagem'));
  if base_slug = '' then
    base_slug := 'hospedagem';
  end if;

  next_slug := base_slug;
  while exists (
    select 1
    from public.properties
    where slug = next_slug
      and id is distinct from new.id
  ) loop
    next_slug := base_slug || '-' || suffix;
    suffix := suffix + 1;
  end loop;

  new.slug := next_slug;
  return new;
end;
$$;

drop trigger if exists ensure_property_slug on public.properties;
create trigger ensure_property_slug
  before insert or update of name, slug on public.properties
  for each row execute function public.ensure_property_slug();

update public.properties
set slug = public.slugify(name)
where slug is null or slug = '';

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

alter table public.support_tickets enable row level security;

drop policy if exists "Authenticated users can send support tickets" on public.support_tickets;
drop policy if exists "Users can read own support tickets" on public.support_tickets;
drop policy if exists "Super admins can manage support tickets" on public.support_tickets;

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
