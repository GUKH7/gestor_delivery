import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspace = fs.readFileSync(
  "src/app/admin/(painel)/promotions/loyalty/LoyaltyProgramWorkspace.tsx",
  "utf8",
);
const migration = fs.readFileSync(
  "supabase/migrations/20260906155000_loyalty_program_configuration.sql",
  "utf8",
);

test("Programa de fidelidade possui persistência própria por restaurante", () => {
  assert.match(migration, /create table public\.loyalty_programs/);
  assert.match(migration, /unique \(restaurant_id\)/);
  assert.match(migration, /unique \(id, restaurant_id\)/);
  assert.doesNotMatch(migration, /promotion_campaigns/);
});

test("Banco valida status, formas de acúmulo, pedido mínimo e validade", () => {
  assert.match(migration, /status in \('draft','active','paused'\)/);
  assert.match(migration, /earn_mode in \('amount','order'\)/);
  assert.match(migration, /spend_amount > 0/);
  assert.match(migration, /points_per_spend > 0/);
  assert.match(migration, /points_per_order > 0/);
  assert.match(migration, /minimum_order_amount >= 0/);
  assert.match(migration, /points_expire_days between 1 and 3650/);
});

test("Configuração respeita isolamento por tenant com RLS", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /Members manage loyalty program/);
  assert.match(migration, /public\.restaurant_members/);
  assert.match(migration, /rm\.restaurant_id = loyalty_programs\.restaurant_id/);
  assert.match(migration, /rm\.user_id = \(select auth\.uid\(\)\)/);
});

test("Workspace carrega e salva configuração por upsert", () => {
  assert.match(workspace, /from\("loyalty_programs"\)/);
  assert.match(workspace, /\.eq\("restaurant_id", restaurant\.id\)/);
  assert.match(workspace, /\.upsert\(payload, \{ onConflict: "restaurant_id" \}\)/);
  assert.match(workspace, /Configuração do programa salva com sucesso/);
});

test("Configurador cobre os dois modelos de pontuação sem ativar acúmulo no cliente", () => {
  assert.match(workspace, /ponto\(s\) a cada R\$/);
  assert.match(workspace, /ponto\(s\) por pedido concluído/);
  assert.match(workspace, /Pedidos cancelados não serão considerados elegíveis/);
  assert.match(workspace, /motor de acúmulo estiver conectado/);
  assert.doesNotMatch(workspace, /customer_rewards/);
});
