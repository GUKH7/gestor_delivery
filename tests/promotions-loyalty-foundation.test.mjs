import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const tabs = fs.readFileSync(
  "src/app/admin/(painel)/promotions/PromotionsTabs.tsx",
  "utf8",
);
const page = fs.readFileSync(
  "src/app/admin/(painel)/promotions/loyalty/page.tsx",
  "utf8",
);
const workspace = fs.readFileSync(
  "src/app/admin/(painel)/promotions/loyalty/LoyaltyProgramWorkspace.tsx",
  "utf8",
);

test("Promoções expõe a aba Fidelidade", () => {
  assert.match(tabs, /label: "Fidelidade"/);
  assert.match(tabs, /href: "\/admin\/promotions\/loyalty"/);
  assert.match(page, /LoyaltyProgramWorkspace/);
});

test("Página de fidelidade mantém a jornada e agora expõe configuração persistida", () => {
  assert.match(workspace, /Programa de fidelidade/);
  assert.match(workspace, /Acumular pontos/);
  assert.match(workspace, /Trocar por recompensas/);
  assert.match(workspace, /Voltar a comprar/);
  assert.match(workspace, /Salvar programa/);
  assert.match(workspace, /loyalty_programs/);
});

test("Fidelidade continua independente do motor de giros da Roleta", () => {
  assert.match(workspace, /carteira do cliente/i);
  assert.doesNotMatch(workspace, /promotion_spins/);
  assert.doesNotMatch(workspace, /promotion_spin_results/);
});
