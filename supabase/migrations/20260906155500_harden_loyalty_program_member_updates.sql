-- Allow any authenticated member of the same restaurant to maintain the loyalty program
-- without allowing tenant or audit identity fields to be rewritten.

create or replace function app_private.guard_loyalty_program_identity()
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
    return new;
  end if;

  new.id := old.id;
  new.restaurant_id := old.restaurant_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger loyalty_programs_guard_identity
before insert or update on public.loyalty_programs
for each row execute function app_private.guard_loyalty_program_identity();

revoke all on function app_private.guard_loyalty_program_identity() from public, anon, authenticated;

drop policy if exists "Members manage loyalty programs" on public.loyalty_programs;

revoke delete on table public.loyalty_programs from authenticated;

create policy "Members read loyalty programs"
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

create policy "Members create loyalty programs"
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

create policy "Members update loyalty programs"
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
