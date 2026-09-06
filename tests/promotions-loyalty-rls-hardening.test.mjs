import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  "supabase/migrations/20260906155500_harden_loyalty_program_member_updates.sql",
  "utf8",
);

test("qualquer membro da mesma loja pode atualizar o programa", () => {
  assert.match(migration, /Members update loyalty programs/);
  assert.match(migration, /rm\.restaurant_id = loyalty_programs\.restaurant_id/);
  assert.match(migration, /rm\.user_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /created_by = \(select auth\.uid\(\)\)/);
});

test("campos de identidade e auditoria permanecem imutáveis no update", () => {
  assert.match(migration, /new\.id := old\.id/);
  assert.match(migration, /new\.restaurant_id := old\.restaurant_id/);
  assert.match(migration, /new\.created_by := old\.created_by/);
  assert.match(migration, /new\.created_at := old\.created_at/);
});

test("criação registra o usuário autenticado e exclusão não é exposta ao admin", () => {
  assert.match(migration, /new\.created_by := auth\.uid\(\)/);
  assert.match(migration, /revoke delete on table public\.loyalty_programs from authenticated/);
  assert.match(migration, /Members create loyalty programs/);
  assert.match(migration, /Members read loyalty programs/);
});
