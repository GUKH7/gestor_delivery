-- Shifuh loyalty program configuration.
-- Keeps loyalty independent from roulette campaigns while reusing restaurant membership isolation.

create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  name text not null default 'Programa de fidelidade',
  status text not null default 'draft',
  earning_mode text not null default 'spend',
  spend_amount numeric(12,2),
  points_per_spend integer,
  points_per_order integer,
  minimum_order_amount numeric(12,2) not null default 0,
  points_validity_days integer,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_programs_restaurant_key unique (restaurant_id),
  constraint loyalty_programs_name_check check (char_length(btrim(name)) between 3 and 80),
  constraint loyalty_programs_status_check check (status in ('draft','active','paused')),
  constraint loyalty_programs_earning_mode_check check (earning_mode in ('spend','order')),
  constraint loyalty_programs_minimum_order_check check (minimum_order_amount >= 0),
  constraint loyalty_programs_validity_check check (points_validity_days is null or points_validity_days > 0),
  constraint loyalty_programs_earning_values_check check (
    (
      earning_mode = 'spend'
      and spend_amount is not null
      and spend_amount > 0
      and points_per_spend is not null
      and points_per_spend > 0
      and points_per_order is null
    )
    or
    (
      earning_mode = 'order'
      and points_per_order is not null
      and points_per_order > 0
      and spend_amount is null
      and points_per_spend is null
    )
  )
);

create index loyalty_programs_restaurant_status_idx
  on public.loyalty_programs (restaurant_id, status);

create trigger loyalty_programs_set_updated_at
before update on public.loyalty_programs
for each row execute function public.set_updated_at();

alter table public.loyalty_programs enable row level security;

revoke all on table public.loyalty_programs from public, anon, authenticated;
grant select, insert, update, delete on table public.loyalty_programs to authenticated;
grant all on table public.loyalty_programs to service_role;

create policy "Members manage loyalty programs"
on public.loyalty_programs
for all
to authenticated
using (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = loyalty_programs.restaurant_id
      and rm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = loyalty_programs.restaurant_id
      and rm.user_id = (select auth.uid())
  )
  and (created_by is null or created_by = (select auth.uid()))
);

comment on table public.loyalty_programs is 'One restaurant-scoped loyalty program configuration. Point balances and immutable transactions are stored separately.';
comment on column public.loyalty_programs.earning_mode is 'spend = points per configured BRL amount; order = fixed points per eligible completed order.';
comment on column public.loyalty_programs.points_validity_days is 'Null means points do not expire; otherwise defines validity from each future credit transaction.';