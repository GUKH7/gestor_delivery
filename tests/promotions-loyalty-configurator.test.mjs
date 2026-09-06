import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspace = fs.readFileSync(
  "src/app/admin/(painel)/promotions/loyalty/LoyaltyProgramWorkspace.tsx",
  "utf8",
);
const migration = fs.readFileSync(
  "supabase/migrations/20260906125000_loyalty_program_configuration.sql",
  "utf8",
);

test("Configurador cobre nome, status, acúmulo, pedido mínimo e validade", () => {
  assert.match(workspace, /Nome do programa/);
  assert.match(workspace, />Status</);
  assert.match(workspace, /Por valor gasto/);
  assert.match(workspace, /Por pedido/);
  assert.match(workspace, /Pedido mínimo para pontuar/);
  assert.match(workspace, /Validade dos pontos/);
  assert.match(workspace, /Pontos não expiram/);
});

test("Configuração é carregada e salva por restaurante com upsert idempotente", () => {
  assert.match(workspace, /from\("loyalty_programs"\)/);
  assert.match(workspace, /\.eq\("restaurant_id", restaurant\.id\)/);
  assert.match(workspace, /\.upsert\(payload, \{ onConflict: "restaurant_id" \}\)/);
  assert.match(workspace, /Configuração do programa salva com sucesso/);
});

test("Banco mantém um programa por loja e valida os dois modos de acúmulo", () => {
  assert.match(migration, /create table public\.loyalty_programs/);
  assert.match(migration, /unique \(restaurant_id\)/);
  assert.match(migration, /earning_mode in \('spend','order'\)/);
  assert.match(migration, /points_per_spend_unit/);
  assert.match(migration, /points_per_order/);
  assert.match(migration, /minimum_order_amount >= 0/);
  assert.match(migration, /points_validity_days is null or points_validity_days > 0/);
});

test("RLS limita leitura e escrita aos membros da própria loja", () => {
  assert.match(migration, /alter table public\.loyalty_programs enable row level security/);
  assert.match(migration, /Members read loyalty program/);
  assert.match(migration, /Members create loyalty program/);
  assert.match(migration, /Members update loyalty program/);
  assert.match(migration, /rm\.restaurant_id = loyalty_programs\.restaurant_id/);
  assert.match(migration, /rm\.user_id = \(select auth\.uid\(\)\)/);
});

test("Interface deixa claro que o crédito automático entra nas próximas frentes", () => {
  assert.match(workspace, /pedidos concluídos e elegíveis/);
  assert.match(workspace, /execução automática e a carteira auditável entram nas próximas frentes/i);
});
