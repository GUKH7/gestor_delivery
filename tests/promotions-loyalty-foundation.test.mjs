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

test("Página de fidelidade mantém a jornada e passa a oferecer configuração persistida", () => {
  assert.match(workspace, /Programa de fidelidade/);
  assert.match(workspace, /Forma de acúmulo/);
  assert.match(workspace, /Por valor gasto/);
  assert.match(workspace, /Por pedido concluído/);
  assert.match(workspace, /Validade dos pontos/);
  assert.match(workspace, /Configuração persistida/);
});

test("Fidelidade continua isolada da Roleta e prepara carteira própria", () => {
  assert.match(workspace, /não mistura pontos com cupons ou giros da Roleta/);
  assert.match(workspace, /Carteira e extrato/);
  assert.match(workspace, /saldo e extrato auditável/i);
});
