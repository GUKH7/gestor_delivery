-- Shifuh loyalty wallet and immutable point ledger.
-- Point mutation stays server-side; authenticated restaurant members only receive read access.

create unique index if not exists loyalty_programs_id_restaurant_id_uidx
  on public.loyalty_programs (id, restaurant_id);

create table public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  program_id uuid not null,
  customer_id uuid not null,
  points_balance bigint not null default 0,
  lifetime_earned bigint not null default 0,
  lifetime_redeemed bigint not null default 0,
  lifetime_expired bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_accounts_program_fkey
    foreign key (program_id, restaurant_id)
    references public.loyalty_programs(id, restaurant_id)
    on delete restrict,
  constraint loyalty_accounts_customer_fkey
    foreign key (customer_id, restaurant_id)
    references public.customers(id, restaurant_id)
    on delete restrict,
  constraint loyalty_accounts_balance_check check (points_balance >= 0),
  constraint loyalty_accounts_lifetime_check check (
    lifetime_earned >= 0 and lifetime_redeemed >= 0 and lifetime_expired >= 0
  ),
  constraint loyalty_accounts_program_customer_key unique (program_id, customer_id),
  constraint loyalty_accounts_id_tenant_key unique (id, restaurant_id, program_id, customer_id)
);

create table public.loyalty_point_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  restaurant_id uuid not null,
  program_id uuid not null,
  customer_id uuid not null,
  transaction_type text not null,
  points_delta bigint not null,
  balance_after bigint not null,
  source_order_id uuid,
  idempotency_key text not null,
  description text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint loyalty_transactions_account_fkey
    foreign key (account_id, restaurant_id, program_id, customer_id)
    references public.loyalty_accounts(id, restaurant_id, program_id, customer_id)
    on delete restrict,
  constraint loyalty_transactions_order_fkey
    foreign key (source_order_id, restaurant_id)
    references public.orders(id, restaurant_id)
    on delete restrict,
  constraint loyalty_transactions_type_check check (
    transaction_type in ('earn','redeem','expire','adjustment_credit','adjustment_debit')
  ),
  constraint loyalty_transactions_delta_check check (
    (transaction_type in ('earn','adjustment_credit') and points_delta > 0)
    or (transaction_type in ('redeem','expire','adjustment_debit') and points_delta < 0)
  ),
  constraint loyalty_transactions_balance_check check (balance_after >= 0),
  constraint loyalty_transactions_idempotency_check check (
    char_length(btrim(idempotency_key)) between 8 and 180
  ),
  constraint loyalty_transactions_metadata_check check (jsonb_typeof(metadata) = 'object'),
  constraint loyalty_transactions_expiry_check check (
    expires_at is null or transaction_type in ('earn','adjustment_credit')
  ),
  constraint loyalty_transactions_tenant_idempotency_key unique (restaurant_id, idempotency_key),
  constraint loyalty_transactions_id_tenant_key unique (id, restaurant_id)
);

create index loyalty_accounts_restaurant_customer_idx
  on public.loyalty_accounts (restaurant_id, customer_id);
create index loyalty_accounts_program_balance_idx
  on public.loyalty_accounts (program_id, points_balance desc);
create index loyalty_transactions_account_created_idx
  on public.loyalty_point_transactions (account_id, created_at desc);
create index loyalty_transactions_customer_created_idx
  on public.loyalty_point_transactions (restaurant_id, customer_id, created_at desc);
create index loyalty_transactions_expiry_idx
  on public.loyalty_point_transactions (restaurant_id, expires_at)
  where expires_at is not null and points_delta > 0;

create trigger loyalty_accounts_set_updated_at
before update on public.loyalty_accounts
for each row execute function public.set_updated_at();

create or replace function app_private.prepare_loyalty_point_transaction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account public.loyalty_accounts%rowtype;
  v_new_balance bigint;
begin
  select * into v_account
  from public.loyalty_accounts
  where id = new.account_id
  for update;

  if not found then
    raise exception using errcode = '23503', message = 'Loyalty account not found';
  end if;

  new.restaurant_id := v_account.restaurant_id;
  new.program_id := v_account.program_id;
  new.customer_id := v_account.customer_id;
  new.created_at := now();

  if jsonb_typeof(new.metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'Loyalty transaction metadata must be a JSON object';
  end if;

  v_new_balance := v_account.points_balance + new.points_delta;
  if v_new_balance < 0 then
    raise exception using errcode = '23514', message = 'Insufficient loyalty points';
  end if;

  new.balance_after := v_new_balance;

  update public.loyalty_accounts
  set
    points_balance = v_new_balance,
    lifetime_earned = lifetime_earned + case when new.transaction_type = 'earn' then new.points_delta else 0 end,
    lifetime_redeemed = lifetime_redeemed + case when new.transaction_type = 'redeem' then abs(new.points_delta) else 0 end,
    lifetime_expired = lifetime_expired + case when new.transaction_type = 'expire' then abs(new.points_delta) else 0 end
  where id = v_account.id;

  return new;
end;
$$;

create or replace function app_private.guard_loyalty_point_transaction_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$;
begin
  raise exception using errcode = '55000', message = 'Loyalty point transactions are immutable';
end;
$$;

create trigger loyalty_transactions_prepare
before insert on public.loyalty_point_transactions
for each row execute function app_private.prepare_loyalty_point_transaction();

create trigger loyalty_transactions_immutable
before update or delete on public.loyalty_point_transactions
for each row execute function app_private.guard_loyalty_point_transaction_immutable();

revoke all on function app_private.prepare_loyalty_point_transaction() from public, anon, authenticated;
revoke all on function app_private.guard_loyalty_point_transaction_immutable() from public, anon, authenticated;

alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_point_transactions enable row level security;

revoke all on table public.loyalty_accounts from public, anon, authenticated;
revoke all on table public.loyalty_point_transactions from public, anon, authenticated;

grant select on table public.loyalty_accounts to authenticated;
grant select on table public.loyalty_point_transactions to authenticated;
grant all on table public.loyalty_accounts to service_role;
grant all on table public.loyalty_point_transactions to service_role;

create policy "Members read loyalty accounts"
on public.loyalty_accounts
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = loyalty_accounts.restaurant_id
      and rm.user_id = (select auth.uid())
  )
);

create policy "Members read loyalty point transactions"
on public.loyalty_point_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = loyalty_point_transactions.restaurant_id
      and rm.user_id = (select auth.uid())
  )
);

comment on table public.loyalty_accounts is 'Restaurant-scoped loyalty wallet with materialized balance and lifetime counters.';
comment on table public.loyalty_point_transactions is 'Immutable audit ledger for loyalty point credits, debits, expirations and adjustments.';
comment on column public.loyalty_point_transactions.expires_at is 'Expiration timestamp attached to positive point lots; future consumption allocation can reference these immutable credits.';
