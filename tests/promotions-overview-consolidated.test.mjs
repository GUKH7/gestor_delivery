import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const overview = fs.readFileSync(
  "src/app/admin/(painel)/promotions/PromotionsOverview.tsx",
  "utf8",
);

test("promotions overview consolidates coupons and lucky wheel data", () => {
  for (const table of [
    "coupons",
    "orders",
    "promotion_campaigns",
    "promotion_spins",
    "customer_rewards",
    "customers",
  ]) {
    assert.match(overview, new RegExp(`from\\(\"${table}\"\\)`));
  }

  assert.match(overview, /activePromotions: activeCoupons \+ activeWheelCampaigns/);
  assert.match(overview, /resolvedWheelSpins/);
  assert.match(overview, /wheelPrizesUsed/);
});

test("overview keeps promotion reads scoped to the current restaurant", () => {
  const tenantFilters = overview.match(/\.eq\("restaurant_id", restaurant\.id\)/g) || [];
  assert.ok(tenantFilters.length >= 7);
});

test("overview deduplicates promotional revenue and investment by order id", () => {
  assert.match(overview, /const promotionalOrders = new Map<string, PromotionOrder>\(\)/);
  assert.match(overview, /validCouponOrders\.forEach\(\(order\) => promotionalOrders\.set\(order\.id, order\)\)/);
  assert.match(overview, /validWheelOrders\.forEach\(\(order\) => promotionalOrders\.set\(order\.id, order\)\)/);
  assert.match(overview, /promotionalOrders\.values\(\)/);
  assert.match(overview, /order\.status !== "canceled"/);
});

test("impacted customers are deduplicated across mechanisms through normalized phone", () => {
  assert.match(overview, /function normalizePhone/);
  assert.match(overview, /customerPhoneById/);
  assert.match(overview, /phone:\$\{phone\}/);
  assert.match(overview, /customer:\$\{spin\.customer_id\}/);
});

test("active wheel campaigns respect status and campaign window", () => {
  assert.match(overview, /campaign\.status !== "active"/);
  assert.match(overview, /startsAt > now/);
  assert.match(overview, /endsAt <= now/);
});

test("front 2 still exposes the requested consolidated metrics and mechanics", () => {
  for (const label of [
    "Promoções ativas",
    "Clientes impactados",
    "Receita gerada",
    "Investimento promocional",
    "Cupons",
    "Roleta da Sorte",
    "Próximas mecânicas",
  ]) {
    assert.match(overview, new RegExp(label));
  }

  assert.match(overview, /produto grátis sem CMV cadastrado/);
});
