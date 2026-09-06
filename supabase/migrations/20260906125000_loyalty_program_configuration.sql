-- Shifuh loyalty program configuration foundation.
-- Keeps the loyalty program independent from roulette campaigns while preserving tenant isolation.

create table public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  status text not null default 'draft',
  earning_mode text not null default 'spend',
  spend_unit_amount numeric(12,2),
  points_per_spend_unit integer,
  points_per_order integer,
  minimum_order_amount numeric(12,2) not null default 0,
  points_validity_days integer,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_programs_restaurant_key unique (restaurant_id),
  constraint loyalty_programs_id_restaurant_key unique (id, restaurant_id),
  constraint loyalty_programs_name_check check (char_length(btrim(name)) between 3 and 80),
  constraint loyalty_programs_status_check check (status in ('draft','active','paused')),
  constraint loyalty_programs_earning_mode_check check (earning_mode in ('spend','order')),
  constraint loyalty_programs_minimum_order_check check (minimum_order_amount >= 0),
  constraint loyalty_programs_validity_check check (points_validity_days is null or points_validity_days > 0),
  constraint loyalty_programs_earning_values_check check (
    (
      earning_mode = 'spend'
      and spend_unit_amount is not null
      and spend_unit_amount > 0
      and points_per_spend_unit is not null
      and points_per_spend_unit > 0
      and points_per_order is null
    )
    or
    (
      earning_mode = 'order'
      and points_per_order is not null
      and points_per_order > 0
      and spend_unit_amount is null
      and points_per_spend_unit is null
    )
  )
);

create index loyalty_programs_restaurant_status_idx
  on public.loyalty_programs (restaurant_id, status);

create trigger loyalty_programs_set_updated_at
before update on public.loyalty_programs
for each row execute function public.set_updated_at();

create or replace function app_private.preserve_loyalty_program_creator()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
  else
    new.created_by := old.created_by;
  end if;

  return new;
end;
$$;

create trigger loyalty_programs_preserve_creator
before insert or update on public.loyalty_programs
for each row execute function app_private.preserve_loyalty_program_creator();

revoke all on function app_private.preserve_loyalty_program_creator() from public, anon, authenticated;

alter table public.loyalty_programs enable row level security;

revoke all on table public.loyalty_programs from public, anon, authenticated;
grant select, insert, update on table public.loyalty_programs to authenticated;
grant all on table public.loyalty_programs to service_role;

create policy "Members read loyalty program"
on public.loyalty_programs
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = loyalty_programs.restaurant_id
      and rm.user_id = (select auth.uid())
  )
);

create policy "Members create loyalty program"
on public.loyalty_programs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = loyalty_programs.restaurant_id
      and rm.user_id = (select auth.uid())
  )
);

create policy "Members update loyalty program"
on public.loyalty_programs
for update
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
);
