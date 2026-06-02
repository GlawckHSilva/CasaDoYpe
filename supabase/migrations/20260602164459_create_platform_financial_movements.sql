create table if not exists public.platform_financial_movements (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'income',
  status text not null default 'expected',
  source text not null default 'manual',
  description text not null default '',
  owner_id uuid references auth.users(id) on delete set null,
  owner_name text,
  owner_document text,
  license_id uuid references public.licenses(id) on delete set null,
  plan text,
  property_limit integer not null default 1,
  amount numeric(10, 2) not null default 0,
  payment_method text not null default 'pix',
  due_date date not null default current_date,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_financial_movements_type_check check (type in ('income', 'expense')),
  constraint platform_financial_movements_status_check check (status in ('expected', 'received', 'paid', 'cancelled')),
  constraint platform_financial_movements_source_check check (source in ('manual', 'license', 'renewal', 'upgrade')),
  constraint platform_financial_movements_payment_method_check check (payment_method in ('pix', 'card', 'boleto', 'transfer', 'cash', 'check', 'other'))
);

alter table public.platform_financial_movements enable row level security;

drop policy if exists "Super admins can manage platform financial movements" on public.platform_financial_movements;
create policy "Super admins can manage platform financial movements"
  on public.platform_financial_movements for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create index if not exists platform_financial_movements_due_date_idx
  on public.platform_financial_movements (due_date desc);

create index if not exists platform_financial_movements_license_id_idx
  on public.platform_financial_movements (license_id);

create or replace function public.touch_platform_financial_movements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_platform_financial_movements_updated_at on public.platform_financial_movements;
create trigger touch_platform_financial_movements_updated_at
  before update on public.platform_financial_movements
  for each row execute function public.touch_platform_financial_movements_updated_at();
