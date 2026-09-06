-- Shifuh loyalty program configuration foundation.
-- Keeps loyalty independent from roulette while preserving the same tenant boundary.

create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  name text not null default 'Clube de Fidelidade',
  status text not null default 'draft',
  earn_mode text not null default 'amount',
  spend_amount numeric(12,2) not null default 1.00,
  points_per_spend integer not null default 1,
  points_per_order integer not null default 1,
  minimum_order_amount numeric(12,2) not null default 0,
  points_expire_days integer,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_programs_restaurant_key unique (restaurant_id),
  constraint loyalty_programs_id_restaurant_key unique (id, restaurant_id),
  constraint loyalty_programs_name_check check (char_length(btrim(name)) between 3 and 80),
  constraint loyalty_programs_status_check check (status in ('draft','active','paused')),
  constraint loyalty_programs_earn_mode_check check (earn_mode in ('amount','order')),
  constraint loyalty_programs_spend_amount_check check (spend_amount > 0),
  constraint loyalty_programs_points_per_spend_check check (points_per_spend > 0),
  constraint loyalty_programs_points_per_order_check check (points_per_order > 0),
  constraint loyalty_programs_minimum_order_check check (minimum_order_amount >= 0),
  constraint loyalty_programs_expiry_check check (points_expire_days is null or points_expire_days between 1 and 3650)
);

create index loyalty_programs_status_idx
  on public.loyalty_programs (restaurant_id, status);

create trigger loyalty_programs_set_updated_at
before update on public.loyalty_programs
for each row execute function public.set_updated_at();

alter table public.loyalty_programs enable row level security;

revoke all on table public.loyalty_programs from public, anon, authenticated;
grant select, insert, update, delete on table public.loyalty_programs to authenticated;
grant all on table public.loyalty_programs to service_role;

create policy "Members manage loyalty program"
on public.loyalty_programs
for all
to authenticated
using (
  exists (
    select 1 from public.restaurant_members rm
    where rm.restaurant_id = loyalty_programs.restaurant_id
      and rm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.restaurant_members rm
    where rm.restaurant_id = loyalty_programs.restaurant_id
      and rm.user_id = (select auth.uid())
  )
  and (created_by is null or created_by = (select auth.uid()))
);
