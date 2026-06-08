alter table public.payment_settings
  add column if not exists interest_rates jsonb not null default '[]'::jsonb;

alter table public.suggestions
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "Guests can create reservation requests" on public.reservations;
create policy "Guests can create reservation requests"
  on public.reservations for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and payment_status = 'pending'
    and source = 'site'
    and public.is_property_bookable(property_id)
    and check_in < check_out
    and total_amount >= 0
    and guests > 0
    and installments >= 1
    and interest_rate >= 0
    and interest_amount >= 0
    and (guest_user_id is null or guest_user_id = auth.uid())
  );

drop policy if exists "Admins can read suggestions" on public.suggestions;
drop policy if exists "Owners and super admins can read suggestions" on public.suggestions;
drop policy if exists "Owners and super admins can update suggestions" on public.suggestions;
drop policy if exists "Owners and super admins can delete suggestions" on public.suggestions;

create policy "Owners and super admins can read suggestions"
  on public.suggestions for select
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.properties
      where properties.id = suggestions.property_id
        and properties.owner_id = auth.uid()
    )
  );

create policy "Owners and super admins can update suggestions"
  on public.suggestions for update
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.properties
      where properties.id = suggestions.property_id
        and properties.owner_id = auth.uid()
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1
      from public.properties
      where properties.id = suggestions.property_id
        and properties.owner_id = auth.uid()
    )
  );

create policy "Owners and super admins can delete suggestions"
  on public.suggestions for delete
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.properties
      where properties.id = suggestions.property_id
        and properties.owner_id = auth.uid()
    )
  );

drop policy if exists "Super admins can update support tickets" on public.support_tickets;
drop policy if exists "Super admins can delete support tickets" on public.support_tickets;

create policy "Super admins can update support tickets"
  on public.support_tickets for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "Super admins can delete support tickets"
  on public.support_tickets for delete
  using (public.is_super_admin());
