import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  "src/app/admin/(painel)/promotions/loyalty/page.tsx",
  "utf8",
);
const wallet = fs.readFileSync(
  "src/app/admin/(painel)/promotions/loyalty/LoyaltyWalletLedger.tsx",
  "utf8",
);
const migration = fs.readFileSync(
  "supabase/migrations/20260906160000_loyalty_wallet_ledger.sql",
  "utf8",
);

test("Página de fidelidade exibe carteira e extrato", () => {
  assert.match(page, /LoyaltyWalletLedger/);
  assert.match(wallet, /Saldo por cliente/);
  assert.match(wallet, /Extrato auditável/);
  assert.match(wallet, /Somente leitura no painel/);
});

test("Carteiras são isoladas por programa, restaurante e cliente", () => {
  assert.match(migration, /create table public\.loyalty_accounts/);
  assert.match(migration, /foreign key \(program_id, restaurant_id\)/);
  assert.match(migration, /foreign key \(customer_id, restaurant_id\)/);
  assert.match(migration, /unique \(program_id, customer_id\)/);
  assert.match(migration, /points_balance >= 0/);
});

test("Ledger registra saldo posterior, idempotência e origem do pedido", () => {
  assert.match(migration, /create table public\.loyalty_point_transactions/);
  assert.match(migration, /balance_after bigint not null/);
  assert.match(migration, /source_order_id uuid/);
  assert.match(migration, /unique \(restaurant_id, idempotency_key\)/);
  assert.match(migration, /transaction_type in \('earn','redeem','expire','adjustment_credit','adjustment_debit'\)/);
});

test("Trigger serializa saldo e rejeita saldo negativo", () => {
  assert.match(migration, /for update/);
  assert.match(migration, /v_account\.points_balance \+ new\.points_delta/);
  assert.match(migration, /Insufficient loyalty points/);
  assert.match(migration, /new\.balance_after := v_new_balance/);
  assert.match(migration, /lifetime_earned = lifetime_earned/);
  assert.match(migration, /lifetime_redeemed = lifetime_redeemed/);
  assert.match(migration, /lifetime_expired = lifetime_expired/);
});

test("Ledger é imutável e escrita de pontos permanece server-side", () => {
  assert.match(migration, /Loyalty point transactions are immutable/);
  assert.match(migration, /before update or delete on public\.loyalty_point_transactions/);
  assert.match(migration, /grant select on table public\.loyalty_accounts to authenticated/);
  assert.match(migration, /grant select on table public\.loyalty_point_transactions to authenticated/);
  assert.doesNotMatch(migration, /grant insert[^\n]*loyalty_point_transactions to authenticated/);
  assert.match(migration, /grant all on table public\.loyalty_point_transactions to service_role/);
});

test("Painel consulta somente dados do restaurante atual", () => {
  assert.match(wallet, /from\("loyalty_accounts"\)/);
  assert.match(wallet, /from\("loyalty_point_transactions"\)/);
  assert.match(wallet, /\.eq\("restaurant_id", restaurant\.id\)/);
  assert.match(wallet, /\.limit\(50\)/);
});
