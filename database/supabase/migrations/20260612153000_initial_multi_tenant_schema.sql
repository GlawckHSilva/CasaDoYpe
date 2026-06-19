create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  avatar_url text,
  platform_role text not null default 'user' check (platform_role in ('user', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  slug text not null unique,
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  default_property_type text check (default_property_type in ('seasonal_home', 'inn', 'small_hotel')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  member_role text not null default 'staff' check (member_role in ('owner', 'staff')),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  property_scope uuid[],
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  module text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  module text not null,
  description text,
  default_enabled boolean not null default false,
  owner_configurable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_features (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_flag_id uuid not null references public.feature_flags(id) on delete cascade,
  enabled boolean not null default false,
  configured_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, feature_flag_id)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  monthly_price numeric(12, 2) not null default 0,
  annual_price numeric(12, 2) not null default 0,
  max_properties integer not null default 1,
  max_units integer not null default 1,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_features (
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_flag_id uuid not null references public.feature_flags(id) on delete cascade,
  enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (plan_id, feature_flag_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'paused', 'cancelled')),
  starts_at timestamptz not null default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  license_key text not null unique,
  status text not null default 'trial' check (status in ('trial', 'active', 'expired', 'suspended', 'cancelled')),
  starts_at date not null default current_date,
  expires_at date,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  slug text not null,
  property_type text not null check (property_type in ('seasonal_home', 'inn', 'small_hotel')),
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'archived')),
  headline text,
  description text,
  address jsonb not null default '{}'::jsonb,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, slug)
);

create table public.property_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null unique references public.properties(id) on delete cascade,
  booking_mode text not null default 'manual_approval' check (booking_mode in ('manual_approval', 'instant_booking')),
  check_in_time time,
  check_out_time time,
  min_nights integer not null default 1,
  max_nights integer,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.unit_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  description text,
  max_guests integer not null default 1,
  bedrooms integer not null default 0,
  bathrooms integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_category_id uuid references public.unit_categories(id) on delete set null,
  code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, code)
);

create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  category text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.property_amenities (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (property_id, amenity_id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  media_type text not null default 'image' check (media_type in ('image', 'video', 'document')),
  storage_bucket text,
  storage_path text,
  url text,
  alt text,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid references public.units(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  code text not null,
  status text not null default 'draft' check (status in ('draft', 'pending', 'confirmed', 'cancelled', 'completed')),
  source text not null default 'manual' check (source in ('manual', 'marketplace', 'direct', 'external')),
  check_in date not null,
  check_out date not null,
  guests_count integer not null default 1,
  total_amount numeric(12, 2) not null default 0,
  currency char(3) not null default 'BRL',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  unique (tenant_id, code)
);

create table public.reservation_guests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  document_number text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reservation_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  name text not null,
  account_type text not null default 'cash' check (account_type in ('cash', 'bank', 'gateway', 'other')),
  currency char(3) not null default 'BRL',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('income', 'expense')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name, kind)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  expense_category_id uuid references public.expense_categories(id) on delete set null,
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  amount numeric(12, 2) not null default 0,
  currency char(3) not null default 'BRL',
  due_date date,
  paid_at timestamptz,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_table text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.deleted_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  entity_table text not null,
  entity_id uuid not null,
  deleted_by uuid references public.profiles(id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

create or replace function app_private.is_service_role()
returns boolean
language sql
stable
as $$
  select current_setting('role', true) = 'service_role';
$$;

create or replace function app_private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and platform_role = 'super_admin'
      and deleted_at is null
  );
$$;

create or replace function app_private.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select app_private.is_super_admin()
    or exists (
      select 1
      from public.tenant_members
      where tenant_id = target_tenant_id
        and user_id = auth.uid()
        and status = 'active'
    )
    or exists (
      select 1
      from public.tenants
      where id = target_tenant_id
        and owner_id = auth.uid()
        and deleted_at is null
    );
$$;

create or replace function app_private.is_tenant_owner(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select app_private.is_super_admin()
    or exists (
      select 1
      from public.tenants
      where id = target_tenant_id
        and owner_id = auth.uid()
        and deleted_at is null
    )
    or exists (
      select 1
      from public.tenant_members
      where tenant_id = target_tenant_id
        and user_id = auth.uid()
        and member_role = 'owner'
        and status = 'active'
    );
$$;

create or replace function app_private.has_tenant_permission(target_tenant_id uuid, permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select app_private.is_tenant_owner(target_tenant_id)
    or exists (
      select 1
      from public.tenant_members tm
      join public.role_permissions rp on rp.role_id = tm.role_id
      join public.permissions p on p.id = rp.permission_id
      where tm.tenant_id = target_tenant_id
        and tm.user_id = auth.uid()
        and tm.status = 'active'
        and p.code = permission_code
    );
$$;

create or replace function app_private.can_access_property(target_tenant_id uuid, target_property_id uuid, permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select app_private.is_tenant_owner(target_tenant_id)
    or exists (
      select 1
      from public.tenant_members tm
      join public.role_permissions rp on rp.role_id = tm.role_id
      join public.permissions p on p.id = rp.permission_id
      where tm.tenant_id = target_tenant_id
        and tm.user_id = auth.uid()
        and tm.status = 'active'
        and p.code = permission_code
        and (
          tm.property_scope is null
          or cardinality(tm.property_scope) = 0
          or target_property_id = any(tm.property_scope)
        )
    );
$$;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if app_private.is_service_role() then
    return new;
  end if;

  if tg_op = 'INSERT' and new.platform_role = 'super_admin' and not app_private.is_super_admin() then
    raise exception 'Only super admins can create super admin profiles.';
  end if;

  if tg_op = 'UPDATE'
    and old.platform_role is distinct from new.platform_role
    and not app_private.is_super_admin() then
    raise exception 'Only super admins can change platform roles.';
  end if;

  return new;
end;
$$;

create trigger prevent_profile_privilege_escalation
before insert or update on public.profiles
for each row execute function app_private.prevent_profile_privilege_escalation();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'tenants', 'roles', 'tenant_members', 'feature_flags', 'tenant_features',
    'plans', 'subscriptions', 'licenses', 'properties', 'property_settings',
    'unit_categories', 'units', 'media_assets', 'financial_accounts',
    'expense_categories', 'transactions'
  ]
  loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function app_private.set_updated_at()', table_name, table_name);
  end loop;
end $$;

insert into public.permissions (code, name, module, description) values
  ('tenants.manage', 'Gerenciar tenant', 'platform', 'Permite alterar configuracoes do tenant.'),
  ('members.manage', 'Gerenciar membros', 'platform', 'Permite convidar, alterar e remover membros.'),
  ('roles.manage', 'Gerenciar perfis', 'platform', 'Permite configurar papeis e permissoes.'),
  ('features.manage', 'Gerenciar features', 'platform', 'Permite ativar ou desativar features do tenant.'),
  ('properties.read', 'Ler propriedades', 'properties', 'Permite visualizar propriedades.'),
  ('properties.manage', 'Gerenciar propriedades', 'properties', 'Permite criar e editar propriedades.'),
  ('reservations.read', 'Ler reservas', 'reservations', 'Permite visualizar reservas.'),
  ('reservations.manage', 'Gerenciar reservas', 'reservations', 'Permite criar e alterar reservas.'),
  ('finance.read', 'Ler financeiro', 'finance', 'Permite visualizar financeiro.'),
  ('finance.manage', 'Gerenciar financeiro', 'finance', 'Permite criar e alterar financeiro.'),
  ('audit.read', 'Ler auditoria', 'audit', 'Permite visualizar auditoria.')
on conflict (code) do nothing;

insert into public.feature_flags (key, module, description, default_enabled, owner_configurable) values
  ('marketplace_visibility', 'marketplace', 'Publicacao no marketplace.', true, true),
  ('manual_approval', 'reservations', 'Reservas com aprovacao manual.', true, true),
  ('auto_booking', 'reservations', 'Reserva automatica.', false, true),
  ('payments', 'finance', 'Pagamentos online.', false, true),
  ('gateway_primary', 'finance', 'Gateway de pagamento inicial.', false, false),
  ('extra_services', 'marketplace', 'Servicos extras.', false, true),
  ('reviews', 'marketplace', 'Avaliacoes.', false, true),
  ('regional_guide', 'marketplace', 'Guia da regiao.', false, true),
  ('advanced_rates', 'advanced_rates', 'Tarifario avancado.', false, true),
  ('multi_unit', 'multi_unit', 'Multiplas unidades.', false, true),
  ('ics_sync', 'calendar', 'Importacao e exportacao ICS.', false, true),
  ('cleaning', 'cleaning', 'Operacao de limpeza.', false, true),
  ('inventory', 'inventory', 'Inventario.', false, true),
  ('staff', 'staff', 'Funcionarios.', false, true),
  ('crm', 'crm', 'CRM basico.', false, true),
  ('automations', 'automations', 'Automacoes.', false, true),
  ('ai_assistant', 'ai', 'Assistente inteligente.', false, true),
  ('ai_pricing', 'ai', 'Sugestoes de precificacao.', false, true),
  ('reports', 'reports', 'Relatorios.', false, true)
on conflict (key) do nothing;

create index tenants_owner_id_idx on public.tenants (owner_id);
create index tenant_members_tenant_id_idx on public.tenant_members (tenant_id);
create index tenant_members_user_id_idx on public.tenant_members (user_id);
create index roles_tenant_id_idx on public.roles (tenant_id);
create index tenant_features_tenant_id_idx on public.tenant_features (tenant_id);
create index subscriptions_tenant_id_idx on public.subscriptions (tenant_id);
create index licenses_tenant_id_idx on public.licenses (tenant_id);
create index properties_tenant_id_idx on public.properties (tenant_id);
create index properties_owner_id_idx on public.properties (owner_id);
create index property_settings_property_id_idx on public.property_settings (property_id);
create index unit_categories_property_id_idx on public.unit_categories (property_id);
create index units_property_id_idx on public.units (property_id);
create index property_amenities_tenant_id_idx on public.property_amenities (tenant_id);
create index media_assets_property_id_idx on public.media_assets (property_id);
create index reservations_tenant_id_idx on public.reservations (tenant_id);
create index reservations_property_id_idx on public.reservations (property_id);
create index reservation_guests_reservation_id_idx on public.reservation_guests (reservation_id);
create index financial_accounts_tenant_id_idx on public.financial_accounts (tenant_id);
create index transactions_tenant_id_idx on public.transactions (tenant_id);
create index transactions_reservation_id_idx on public.transactions (reservation_id);
create index audit_logs_tenant_id_created_at_idx on public.audit_logs (tenant_id, created_at desc);
create index deleted_items_tenant_id_deleted_at_idx on public.deleted_items (tenant_id, deleted_at desc);

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.feature_flags enable row level security;
alter table public.tenant_features enable row level security;
alter table public.plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscriptions enable row level security;
alter table public.licenses enable row level security;
alter table public.properties enable row level security;
alter table public.property_settings enable row level security;
alter table public.unit_categories enable row level security;
alter table public.units enable row level security;
alter table public.amenities enable row level security;
alter table public.property_amenities enable row level security;
alter table public.media_assets enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_guests enable row level security;
alter table public.reservation_status_history enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.expense_categories enable row level security;
alter table public.audit_logs enable row level security;
alter table public.deleted_items enable row level security;

create policy "profiles_select_own_or_super" on public.profiles
for select to authenticated
using (id = auth.uid() or app_private.is_super_admin());

create policy "profiles_insert_own_or_super" on public.profiles
for insert to authenticated
with check (id = auth.uid() or app_private.is_super_admin());

create policy "profiles_update_own_or_super" on public.profiles
for update to authenticated
using (id = auth.uid() or app_private.is_super_admin())
with check (id = auth.uid() or app_private.is_super_admin());

create policy "profiles_delete_super" on public.profiles
for delete to authenticated
using (app_private.is_super_admin());

create policy "tenants_select_member" on public.tenants
for select to authenticated
using (app_private.is_tenant_member(id));

create policy "tenants_insert_owner" on public.tenants
for insert to authenticated
with check (owner_id = auth.uid() or app_private.is_super_admin());

create policy "tenants_update_owner_or_permission" on public.tenants
for update to authenticated
using (app_private.is_tenant_owner(id) or app_private.has_tenant_permission(id, 'tenants.manage'))
with check (app_private.is_tenant_owner(id) or app_private.has_tenant_permission(id, 'tenants.manage'));

create policy "tenants_delete_super" on public.tenants
for delete to authenticated
using (app_private.is_super_admin());

create policy "tenant_members_select_member" on public.tenant_members
for select to authenticated
using (app_private.is_tenant_member(tenant_id));

create policy "tenant_members_manage" on public.tenant_members
for all to authenticated
using (app_private.is_tenant_owner(tenant_id) or app_private.has_tenant_permission(tenant_id, 'members.manage'))
with check (app_private.is_tenant_owner(tenant_id) or app_private.has_tenant_permission(tenant_id, 'members.manage'));

create policy "roles_select_member_or_global" on public.roles
for select to authenticated
using (tenant_id is null or app_private.is_tenant_member(tenant_id));

create policy "roles_manage" on public.roles
for all to authenticated
using (app_private.is_super_admin() or (tenant_id is not null and (app_private.is_tenant_owner(tenant_id) or app_private.has_tenant_permission(tenant_id, 'roles.manage'))))
with check (app_private.is_super_admin() or (tenant_id is not null and (app_private.is_tenant_owner(tenant_id) or app_private.has_tenant_permission(tenant_id, 'roles.manage'))));

create policy "permissions_select_authenticated" on public.permissions
for select to authenticated
using (true);

create policy "permissions_manage_super" on public.permissions
for all to authenticated
using (app_private.is_super_admin())
with check (app_private.is_super_admin());

create policy "role_permissions_select" on public.role_permissions
for select to authenticated
using (
  exists (
    select 1 from public.roles r
    where r.id = role_id
      and (r.tenant_id is null or app_private.is_tenant_member(r.tenant_id))
  )
);

create policy "role_permissions_manage" on public.role_permissions
for all to authenticated
using (
  app_private.is_super_admin()
  or exists (
    select 1 from public.roles r
    where r.id = role_id
      and r.tenant_id is not null
      and (app_private.is_tenant_owner(r.tenant_id) or app_private.has_tenant_permission(r.tenant_id, 'roles.manage'))
  )
)
with check (
  app_private.is_super_admin()
  or exists (
    select 1 from public.roles r
    where r.id = role_id
      and r.tenant_id is not null
      and (app_private.is_tenant_owner(r.tenant_id) or app_private.has_tenant_permission(r.tenant_id, 'roles.manage'))
  )
);

create policy "feature_flags_select_authenticated" on public.feature_flags
for select to authenticated
using (true);

create policy "feature_flags_manage_super" on public.feature_flags
for all to authenticated
using (app_private.is_super_admin())
with check (app_private.is_super_admin());

create policy "tenant_features_select_member" on public.tenant_features
for select to authenticated
using (app_private.is_tenant_member(tenant_id));

create policy "tenant_features_manage" on public.tenant_features
for all to authenticated
using (app_private.is_tenant_owner(tenant_id) or app_private.has_tenant_permission(tenant_id, 'features.manage'))
with check (app_private.is_tenant_owner(tenant_id) or app_private.has_tenant_permission(tenant_id, 'features.manage'));

create policy "plans_select_authenticated" on public.plans
for select to authenticated
using (true);

create policy "plans_manage_super" on public.plans
for all to authenticated
using (app_private.is_super_admin())
with check (app_private.is_super_admin());

create policy "plan_features_select_authenticated" on public.plan_features
for select to authenticated
using (true);

create policy "plan_features_manage_super" on public.plan_features
for all to authenticated
using (app_private.is_super_admin())
with check (app_private.is_super_admin());

create policy "subscriptions_select_member" on public.subscriptions
for select to authenticated
using (app_private.is_tenant_member(tenant_id));

create policy "subscriptions_manage_owner" on public.subscriptions
for all to authenticated
using (app_private.is_tenant_owner(tenant_id))
with check (app_private.is_tenant_owner(tenant_id));

create policy "licenses_select_member" on public.licenses
for select to authenticated
using (app_private.is_tenant_member(tenant_id));

create policy "licenses_manage_owner" on public.licenses
for all to authenticated
using (app_private.is_tenant_owner(tenant_id))
with check (app_private.is_tenant_owner(tenant_id));

create policy "properties_select" on public.properties
for select to authenticated
using (app_private.can_access_property(tenant_id, id, 'properties.read'));

create policy "properties_manage" on public.properties
for all to authenticated
using (app_private.can_access_property(tenant_id, id, 'properties.manage'))
with check (app_private.is_tenant_owner(tenant_id) or app_private.has_tenant_permission(tenant_id, 'properties.manage'));

create policy "property_settings_select" on public.property_settings
for select to authenticated
using (app_private.can_access_property(tenant_id, property_id, 'properties.read'));

create policy "property_settings_manage" on public.property_settings
for all to authenticated
using (app_private.can_access_property(tenant_id, property_id, 'properties.manage'))
with check (app_private.can_access_property(tenant_id, property_id, 'properties.manage'));

create policy "unit_categories_select" on public.unit_categories
for select to authenticated
using (app_private.can_access_property(tenant_id, property_id, 'properties.read'));

create policy "unit_categories_manage" on public.unit_categories
for all to authenticated
using (app_private.can_access_property(tenant_id, property_id, 'properties.manage'))
with check (app_private.can_access_property(tenant_id, property_id, 'properties.manage'));

create policy "units_select" on public.units
for select to authenticated
using (app_private.can_access_property(tenant_id, property_id, 'properties.read'));

create policy "units_manage" on public.units
for all to authenticated
using (app_private.can_access_property(tenant_id, property_id, 'properties.manage'))
with check (app_private.can_access_property(tenant_id, property_id, 'properties.manage'));

create policy "amenities_select" on public.amenities
for select to authenticated
using (tenant_id is null or app_private.is_tenant_member(tenant_id));

create policy "amenities_manage" on public.amenities
for all to authenticated
using (app_private.is_super_admin() or (tenant_id is not null and app_private.has_tenant_permission(tenant_id, 'properties.manage')))
with check (app_private.is_super_admin() or (tenant_id is not null and app_private.has_tenant_permission(tenant_id, 'properties.manage')));

create policy "property_amenities_select" on public.property_amenities
for select to authenticated
using (app_private.can_access_property(tenant_id, property_id, 'properties.read'));

create policy "property_amenities_manage" on public.property_amenities
for all to authenticated
using (app_private.can_access_property(tenant_id, property_id, 'properties.manage'))
with check (app_private.can_access_property(tenant_id, property_id, 'properties.manage'));

create policy "media_assets_select" on public.media_assets
for select to authenticated
using (property_id is null and app_private.is_tenant_member(tenant_id) or app_private.can_access_property(tenant_id, property_id, 'properties.read'));

create policy "media_assets_manage" on public.media_assets
for all to authenticated
using (property_id is null and app_private.has_tenant_permission(tenant_id, 'properties.manage') or app_private.can_access_property(tenant_id, property_id, 'properties.manage'))
with check (property_id is null and app_private.has_tenant_permission(tenant_id, 'properties.manage') or app_private.can_access_property(tenant_id, property_id, 'properties.manage'));

create policy "reservations_select" on public.reservations
for select to authenticated
using (app_private.can_access_property(tenant_id, property_id, 'reservations.read'));

create policy "reservations_manage" on public.reservations
for all to authenticated
using (app_private.can_access_property(tenant_id, property_id, 'reservations.manage'))
with check (app_private.can_access_property(tenant_id, property_id, 'reservations.manage'));

create policy "reservation_guests_select" on public.reservation_guests
for select to authenticated
using (
  exists (
    select 1 from public.reservations r
    where r.id = reservation_id
      and app_private.can_access_property(r.tenant_id, r.property_id, 'reservations.read')
  )
);

create policy "reservation_guests_manage" on public.reservation_guests
for all to authenticated
using (
  exists (
    select 1 from public.reservations r
    where r.id = reservation_id
      and app_private.can_access_property(r.tenant_id, r.property_id, 'reservations.manage')
  )
)
with check (
  exists (
    select 1 from public.reservations r
    where r.id = reservation_id
      and app_private.can_access_property(r.tenant_id, r.property_id, 'reservations.manage')
  )
);

create policy "reservation_status_history_select" on public.reservation_status_history
for select to authenticated
using (
  exists (
    select 1 from public.reservations r
    where r.id = reservation_id
      and app_private.can_access_property(r.tenant_id, r.property_id, 'reservations.read')
  )
);

create policy "reservation_status_history_manage" on public.reservation_status_history
for all to authenticated
using (
  exists (
    select 1 from public.reservations r
    where r.id = reservation_id
      and app_private.can_access_property(r.tenant_id, r.property_id, 'reservations.manage')
  )
)
with check (
  exists (
    select 1 from public.reservations r
    where r.id = reservation_id
      and app_private.can_access_property(r.tenant_id, r.property_id, 'reservations.manage')
  )
);

create policy "financial_accounts_select" on public.financial_accounts
for select to authenticated
using (app_private.has_tenant_permission(tenant_id, 'finance.read'));

create policy "financial_accounts_manage" on public.financial_accounts
for all to authenticated
using (app_private.has_tenant_permission(tenant_id, 'finance.manage'))
with check (app_private.has_tenant_permission(tenant_id, 'finance.manage'));

create policy "expense_categories_select" on public.expense_categories
for select to authenticated
using (app_private.has_tenant_permission(tenant_id, 'finance.read'));

create policy "expense_categories_manage" on public.expense_categories
for all to authenticated
using (app_private.has_tenant_permission(tenant_id, 'finance.manage'))
with check (app_private.has_tenant_permission(tenant_id, 'finance.manage'));

create policy "transactions_select" on public.transactions
for select to authenticated
using (app_private.has_tenant_permission(tenant_id, 'finance.read'));

create policy "transactions_manage" on public.transactions
for all to authenticated
using (app_private.has_tenant_permission(tenant_id, 'finance.manage'))
with check (app_private.has_tenant_permission(tenant_id, 'finance.manage'));

create policy "audit_logs_select" on public.audit_logs
for select to authenticated
using (app_private.is_super_admin() or (tenant_id is not null and app_private.has_tenant_permission(tenant_id, 'audit.read')));

create policy "audit_logs_manage_super" on public.audit_logs
for all to authenticated
using (app_private.is_super_admin())
with check (app_private.is_super_admin());

create policy "deleted_items_select" on public.deleted_items
for select to authenticated
using (app_private.is_super_admin() or (tenant_id is not null and app_private.has_tenant_permission(tenant_id, 'audit.read')));

create policy "deleted_items_manage_super" on public.deleted_items
for all to authenticated
using (app_private.is_super_admin())
with check (app_private.is_super_admin());

grant usage on schema public to authenticated, service_role;
grant usage on schema app_private to authenticated, service_role;

grant select, insert, update, delete on
  public.profiles,
  public.tenants,
  public.tenant_members,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.feature_flags,
  public.tenant_features,
  public.plans,
  public.plan_features,
  public.subscriptions,
  public.licenses,
  public.properties,
  public.property_settings,
  public.unit_categories,
  public.units,
  public.amenities,
  public.property_amenities,
  public.media_assets,
  public.reservations,
  public.reservation_guests,
  public.reservation_status_history,
  public.financial_accounts,
  public.transactions,
  public.expense_categories,
  public.audit_logs,
  public.deleted_items
to authenticated;

grant all on
  public.profiles,
  public.tenants,
  public.tenant_members,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.feature_flags,
  public.tenant_features,
  public.plans,
  public.plan_features,
  public.subscriptions,
  public.licenses,
  public.properties,
  public.property_settings,
  public.unit_categories,
  public.units,
  public.amenities,
  public.property_amenities,
  public.media_assets,
  public.reservations,
  public.reservation_guests,
  public.reservation_status_history,
  public.financial_accounts,
  public.transactions,
  public.expense_categories,
  public.audit_logs,
  public.deleted_items
to service_role;

grant execute on all functions in schema app_private to authenticated, service_role;
