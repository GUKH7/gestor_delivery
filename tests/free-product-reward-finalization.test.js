import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const finalMigration = fs.readFileSync(
  new URL("../supabase/migrations/20260905205703_finalize_free_product_reward_guards.sql", import.meta.url),
  "utf8",
);
const reconciliationMigration = fs.readFileSync(
  new URL("../supabase/migrations/20260902192924_reconcile_free_product_availability_after_guard.sql", import.meta.url),
  "utf8",
);
const menuPage = fs.readFileSync(
  new URL("../src/app/admin/(painel)/menu/page.tsx", import.meta.url),
  "utf8",
);

test("final reconciliation serializes all free-product dependency tables", () => {
  assert.match(finalMigration, /lock table public\.products,[\s\S]*public\.promotion_prizes,[\s\S]*public\.customer_rewards,[\s\S]*public\.promotion_campaigns[\s\S]*share row exclusive mode/i);
  assert.match(reconciliationMigration, /lock table public\.products,[\s\S]*share row exclusive mode/i);
});

test("legacy add-on JSON is expanded only through an array-safe expression", () => {
  assert.match(finalMigration, /when jsonb_typeof\(p\.addons\) = 'array' then p\.addons[\s\S]*else '\[\]'::jsonb/i);
  assert.match(reconciliationMigration, /when jsonb_typeof\(p\.addons\) = 'array' then p\.addons[\s\S]*else '\[\]'::jsonb/i);
});

test("guards cover prize configuration, issued rewards, expiry and product availability", () => {
  assert.match(finalMigration, /before insert or update of prize_type, product_id, active, restaurant_id/i);
  assert.match(finalMigration, /before insert or update of reward_type, product_id, status, expires_at, restaurant_id/i);
  assert.match(finalMigration, /before update of addons, is_active/i);
  assert.match(finalMigration, /pg_advisory_xact_lock\([\s\S]*promotion-free-product:/i);
});

test("final cleanup cancels incompatible rewards and pauses/deactivates incompatible prizes", () => {
  assert.match(finalMigration, /update public\.customer_rewards cr[\s\S]*set status = 'cancelled'/i);
  assert.match(finalMigration, /update public\.promotion_campaigns pc[\s\S]*set status = 'paused'/i);
  assert.match(finalMigration, /update public\.promotion_prizes pp[\s\S]*set active = false/i);
});

test("menu restores optimistic product status and explains reward conflicts", () => {
  assert.match(menuPage, /const previousStatus = Boolean\(product\.is_active\)/);
  assert.match(menuPage, /item\.id === product\.id \? \{ \.\.\.item, is_active: previousStatus \} : item/);
  assert.match(menuPage, /Este produto está vinculado a um prêmio ativo ou a uma recompensa já entregue/);
  assert.match(menuPage, /tone: "error"/);
});
