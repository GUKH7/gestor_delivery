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

test("Promoções expõe a nova aba Fidelidade", () => {
  assert.match(tabs, /label: "Fidelidade"/);
  assert.match(tabs, /href: "\/admin\/promotions\/loyalty"/);
  assert.match(page, /LoyaltyProgramWorkspace/);
});

test("Página base comunica a jornada de fidelidade sem prometer persistência ainda", () => {
  assert.match(workspace, /Programa de fidelidade/);
  assert.match(workspace, /Acumular pontos/);
  assert.match(workspace, /Trocar por recompensas/);
  assert.match(workspace, /Voltar a comprar/);
  assert.match(workspace, /Próxima etapa: configuração/);
});

test("Fundação separa carteira de fidelidade da Roleta", () => {
  assert.match(workspace, /Carteira do cliente/);
  assert.match(workspace, /Catálogo de recompensas/);
  assert.match(workspace, /Métricas de fidelização/);
  assert.match(workspace, /sem misturar o saldo de fidelidade com os giros da Roleta/);
});
