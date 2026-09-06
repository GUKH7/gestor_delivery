import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const readMigration = (name) =>
  fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

const finalMigration = readMigration(
  "20260905205703_finalize_free_product_reward_guards.sql",
);
const reconciliationMigration = readMigration(
  "20260902192924_reconcile_free_product_availability_after_guard.sql",
);
const activeDecimalParserMigration = readMigration(
  "20260906095553_parse_decimal_free_product_addon_minimums.sql",
);
const decimalParserMigrations = [
  "20260902183011_guard_free_product_reward_required_addons.sql",
  "20260902183843_strengthen_free_product_reward_guards.sql",
  "20260902184658_validate_existing_free_product_rewards_and_expiry.sql",
  "20260902190812_deactivate_incompatible_free_product_prizes.sql",
  "20260902191700_guard_free_product_product_availability.sql",
  "20260902192924_reconcile_free_product_availability_after_guard.sql",
  "20260905205703_finalize_free_product_reward_guards.sql",
  "20260906095553_parse_decimal_free_product_addon_minimums.sql",
].map(readMigration);
const menuPage = fs.readFileSync(
  new URL("../src/app/admin/(painel)/menu/page.tsx", import.meta.url),
  "utf8",
);

test("final reconciliation serializes all free-product dependency tables inside explicit transactions", () => {
  for (const migration of [
    finalMigration,
    reconciliationMigration,
    activeDecimalParserMigration,
  ]) {
    assert.match(migration, /\bbegin\s*;/i);
    assert.match(migration, /\bcommit\s*;/i);
  }
  assert.match(
    finalMigration,
    /lock table public\.products,[\s\S]*public\.promotion_prizes,[\s\S]*public\.customer_rewards,[\s\S]*public\.promotion_campaigns[\s\S]*share row exclusive mode/i,
  );
  assert.match(
    reconciliationMigration,
    /lock table public\.products,[\s\S]*share row exclusive mode/i,
  );
});

test("legacy add-on JSON is expanded only through an array-safe expression", () => {
  assert.match(
    finalMigration,
    /when jsonb_typeof\(p\.addons\) = 'array' then p\.addons[\s\S]*else '\[\]'::jsonb/i,
  );
  assert.match(
    reconciliationMigration,
    /when jsonb_typeof\(p\.addons\) = 'array' then p\.addons[\s\S]*else '\[\]'::jsonb/i,
  );
});

test("legacy decimal add-on minimums never use an integer cast", () => {
  for (const migration of decimalParserMigrations) {
    assert.doesNotMatch(
      migration,
      /min_options[\s\S]{0,160}::integer/i,
      "min_options must not be cast directly to integer",
    );
    assert.match(
      migration,
      /min_options[\s\S]{0,260}::numeric/i,
      "min_options must be parsed as numeric after validation",
    );
  }

  assert.match(
    finalMigration,
    /\[0-9\]\+\(\[\.\]\[0-9\]\*\)\?\|\[\.\]\[0-9\]\+/,
    "final guard must recognize decimal numeric strings such as 1.5, 1. and .5",
  );
  assert.match(
    activeDecimalParserMigration,
    /\[eE\]\[\+\-\]\?\[0-9\]\+/,
    "active guard must safely recognize scientific numeric strings",
  );
});

test("guards cover prize configuration, issued rewards, expiry and product availability", () => {
  assert.match(
    finalMigration,
    /before insert or update of prize_type, product_id, active, restaurant_id/i,
  );
  assert.match(
    finalMigration,
    /before insert or update of reward_type, product_id, status, expires_at, restaurant_id/i,
  );
  assert.match(finalMigration, /before update of addons, is_active/i);
  assert.match(
    finalMigration,
    /pg_advisory_xact_lock\([\s\S]*promotion-free-product:/i,
  );
});

test("final cleanup cancels incompatible rewards and pauses/deactivates incompatible prizes", () => {
  assert.match(
    finalMigration,
    /update public\.customer_rewards cr[\s\S]*set status = 'cancelled'/i,
  );
  assert.match(
    finalMigration,
    /update public\.promotion_campaigns pc[\s\S]*set status = 'paused'/i,
  );
  assert.match(
    finalMigration,
    /update public\.promotion_prizes pp[\s\S]*set active = false/i,
  );
});

test("menu restores optimistic product status and explains reward conflicts", () => {
  assert.match(menuPage, /const previousStatus = Boolean\(product\.is_active\)/);
  assert.match(
    menuPage,
    /item\.id === product\.id \? \{ \.\.\.item, is_active: previousStatus \} : item/,
  );
  assert.match(
    menuPage,
    /Este produto está vinculado a um prêmio ativo ou a uma recompensa já entregue/,
  );
  assert.match(menuPage, /tone: "error"/);
});
