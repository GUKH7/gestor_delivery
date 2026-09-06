import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("src/app/admin/(painel)/promotions/wheel/page.tsx", "utf8");
const metrics = fs.readFileSync("src/app/admin/(painel)/promotions/wheel/WheelCampaignMetrics.tsx", "utf8");

test("wheel page renders campaign metrics before configuration", () => {
  assert.match(page, /WheelCampaignMetrics/);
  assert.match(page, /<WheelCampaignMetrics \/>/);
  assert.ok(page.indexOf("<WheelCampaignMetrics />") < page.indexOf("<WheelCampaignWorkspace />"));
});

test("campaign dashboard reads tenant-scoped roulette data", () => {
  assert.match(metrics, /from\("promotion_campaigns"\)/);
  assert.match(metrics, /from\("promotion_spins"\)/);
  assert.match(metrics, /from\("promotion_spin_results"\)/);
  assert.match(metrics, /from\("customer_rewards"\)/);
  assert.match(metrics, /from\("orders"\)/);
  assert.match(metrics, /\.eq\("restaurant_id", restaurant\.id\)/);
  assert.match(metrics, /\.eq\("campaign_id", campaign\.id\)/);
});

test("campaign dashboard exposes the eight requested business metrics", () => {
  for (const label of [
    "Giros realizados",
    "Participantes",
    "Prêmios distribuídos",
    "Prêmios utilizados",
    "Custo promocional",
    "Receita associada",
    "Recompra",
    "Retorno da campanha",
  ]) {
    assert.match(metrics, new RegExp(label));
  }
});

test("financial metrics exclude canceled redemption orders", () => {
  assert.match(metrics, /order\.status !== "canceled"/);
  assert.match(metrics, /associatedRevenue/);
  assert.match(metrics, /promotionalCost/);
  assert.match(metrics, /returnMultiple/);
});

test("repurchase requires a participant to redeem a reward in a valid order", () => {
  assert.match(metrics, /repurchaseCustomers/);
  assert.match(metrics, /usedRewards/);
  assert.match(metrics, /repurchaseRate/);
  assert.match(metrics, /reward\.status === "redeemed"/);
});

test("prize performance preserves historical label and type snapshots", () => {
  assert.match(metrics, /function performanceSnapshotKey\(prizeId: string, label: string, type: string\)/);
  assert.match(metrics, /performanceSnapshotKey\(reward\.prize_id, reward\.label, reward\.reward_type\)/);
  assert.match(metrics, /performanceSnapshotKey\(result\.prize_id, result\.prize_label, result\.prize_type\)/);
  assert.match(metrics, /usedBySnapshot/);
});

test("metrics refresh after the wheel configuration is saved", () => {
  assert.match(metrics, /shifuh:promotion-wheel-saved/);
  assert.match(metrics, /addEventListener\(WHEEL_CAMPAIGN_SAVED_EVENT/);
  assert.match(metrics, /Atualizar métricas/);
});

test("dashboard documents free-product cost limitation instead of inventing COGS", () => {
  assert.match(metrics, /produto grátis não entra sem custo cadastrado/);
});
