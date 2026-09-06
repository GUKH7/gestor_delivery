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

test("Página de Fidelidade mantém a jornada e agora expõe configuração real", () => {
  assert.match(workspace, /Programa de fidelidade/);
  assert.match(workspace, /Forma de acúmulo/);
  assert.match(workspace, /Por valor gasto/);
  assert.match(workspace, /Por pedido concluído/);
  assert.match(workspace, /Pedido mínimo para pontuar/);
  assert.match(workspace, /Definir validade dos pontos/);
});

test("Fidelidade continua separada da Roleta", () => {
  assert.match(workspace, /Carteira separada/);
  assert.match(workspace, /sem misturar dados com os giros da Roleta/);
});
