import {
  Award,
  BadgeCheck,
  Gift,
  History,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminPageShell,
} from "@/components/ui/admin-primitives";

const LOYALTY_STEPS = [
  {
    title: "Acumular pontos",
    description:
      "O cliente acumulará pontos a partir de pedidos elegíveis. A regra de acúmulo será configurada pela loja.",
    icon: ShoppingBag,
  },
  {
    title: "Trocar por recompensas",
    description:
      "Os pontos poderão ser convertidos em benefícios definidos pela loja, como descontos, frete grátis ou produtos.",
    icon: Gift,
  },
  {
    title: "Voltar a comprar",
    description:
      "O programa passa a criar um incentivo contínuo de recorrência sem depender de códigos promocionais.",
    icon: Sparkles,
  },
];

const FOUNDATION_ITEMS = [
  {
    label: "Configuração do programa",
    description: "Nome, status, forma de acúmulo, validade e regras de participação.",
  },
  {
    label: "Carteira do cliente",
    description: "Saldo, extrato de movimentações e histórico de pontos por loja.",
  },
  {
    label: "Catálogo de recompensas",
    description: "Benefícios resgatáveis com custo em pontos e regras próprias.",
  },
  {
    label: "Métricas de fidelização",
    description: "Participantes, pontos emitidos e usados, recompra e receita associada.",
  },
];

export default function LoyaltyProgramWorkspace() {
  return (
    <AdminPageShell className="space-y-6 pb-12">
      <AdminPageHeader
        title="Programa de fidelidade"
        description="Crie uma relação de recorrência com seus clientes por meio de pontos e recompensas configuradas pela loja."
        icon={<Award size={24} />}
      />

      <section className="surface-card overflow-hidden rounded-3xl">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-black text-[var(--brand)]">
                <BadgeCheck size={14} />
                Estrutura criada
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500">
                Próxima etapa: configuração
              </span>
            </div>

            <h2 className="mt-5 max-w-2xl text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
              Fidelidade integrada ao ecossistema de Promoções
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
              A mecânica terá carteira própria de pontos e histórico auditável, enquanto a identificação do cliente e o uso de benefícios seguirão os mesmos padrões seguros já adotados pelo Shifuh.
            </p>
          </div>

          <div className="rounded-3xl border border-orange-100 bg-[linear-gradient(145deg,#ffffff_0%,#fff6ef_100%)] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[var(--brand)] shadow-sm">
                <Users size={19} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-[var(--brand)]">
                  Objetivo
                </p>
                <p className="mt-1 font-black text-gray-950">Aumentar recorrência</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-500">
              Recompensar compras concluídas e dar ao cliente um motivo claro para retornar à mesma loja.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">
            Jornada do cliente
          </p>
          <h2 className="mt-2 text-xl font-black text-gray-950">Como o programa vai funcionar</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {LOYALTY_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="surface-card rounded-3xl p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
                    <Icon size={19} />
                  </span>
                  <span className="text-xs font-black text-gray-300">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-black text-gray-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">{step.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
            <History size={19} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">
              Fundação do módulo
            </p>
            <h2 className="mt-1 text-xl font-black text-gray-950">Estrutura prevista</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Nesta primeira frente a navegação e a área administrativa foram abertas. As próximas frentes conectarão configuração, banco de dados, acúmulo, resgate e métricas sem misturar o saldo de fidelidade com os giros da Roleta.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {FOUNDATION_ITEMS.map((item) => (
            <article key={item.label} className="rounded-2xl border border-[var(--line)] bg-[#fffdfa] p-4">
              <div className="flex gap-3">
                <Award size={17} className="mt-0.5 shrink-0 text-[var(--brand)]" />
                <div>
                  <h3 className="font-black text-gray-950">{item.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-500">{item.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AdminPageShell>
  );
}
