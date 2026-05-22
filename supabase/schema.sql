create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
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
  maps_url text,
  theme_color text default '#2563eb',
  amenities text[] not null default '{}',
  rules text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.properties
  add column if not exists owner_whatsapp text;

alter table public.properties
  add column if not exists maps_url text;

alter table public.properties
  add column if not exists theme_color text default '#2563eb';

alter table public.properties
  alter column owner_whatsapp set default '43998108328';

update public.properties
  set owner_whatsapp = '43998108328'
  where owner_whatsapp is null or owner_whatsapp = '';

create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  url text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  guest_document text,
  guests integer not null default 1,
  check_in date not null,
  check_out date not null,
  total_amount numeric(10, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'blocked')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'not_required')),
  payment_method text not null default 'pix' check (payment_method in ('pix', 'card', 'cash', 'check')),
  payment_url text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.reservations
  add column if not exists payment_method text not null default 'pix';

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

alter table public.properties enable row level security;
alter table public.property_photos enable row level security;
alter table public.reservations enable row level security;
alter table public.cash_movements enable row level security;

create policy "Public can read properties"
  on public.properties for select
  using (true);

create policy "Public can read photos"
  on public.property_photos for select
  using (true);

create policy "Public can read unavailable reservation dates"
  on public.reservations for select
  using (status in ('confirmed', 'blocked'));

create policy "Guests can create reservation requests"
  on public.reservations for insert
  with check (status = 'pending' and payment_status = 'pending');

create policy "Authenticated owners can manage properties"
  on public.properties for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated owners can manage photos"
  on public.property_photos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated owners can manage reservations"
  on public.reservations for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated owners can manage cash movements"
  on public.cash_movements for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Do not expose the service_role key in the browser.
