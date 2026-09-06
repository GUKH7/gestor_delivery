"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  CirclePause,
  Coins,
  Gift,
  Loader2,
  Save,
  ShoppingBag,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import {
  AdminButton,
  AdminInput,
  AdminPageHeader,
  AdminPageShell,
  AdminSelect,
} from "@/components/ui/admin-primitives";
import { AdminErrorState, AdminPageSkeleton } from "@/components/ui/admin-page-states";
import { getCurrentRestaurant } from "@/lib/supabase/restaurant";

type LoyaltyStatus = "draft" | "active" | "paused";
type EarnMode = "amount" | "order";

type LoyaltyProgramRow = {
  id: string;
  name: string;
  status: LoyaltyStatus;
  earn_mode: EarnMode;
  spend_amount: number;
  points_per_spend: number;
  points_per_order: number;
  minimum_order_amount: number;
  points_expire_days: number | null;
};

type LoyaltyForm = {
  name: string;
  status: LoyaltyStatus;
  earnMode: EarnMode;
  spendAmount: string;
  pointsPerSpend: string;
  pointsPerOrder: string;
  minimumOrderAmount: string;
  expires: boolean;
  expiryDays: string;
};

const DEFAULT_FORM: LoyaltyForm = {
  name: "Clube de Fidelidade",
  status: "draft",
  earnMode: "amount",
  spendAmount: "1,00",
  pointsPerSpend: "1",
  pointsPerOrder: "10",
  minimumOrderAmount: "0,00",
  expires: false,
  expiryDays: "90",
};

const STATUS_META: Record<LoyaltyStatus, { label: string; helper: string }> = {
  draft: {
    label: "Rascunho",
    helper: "A configuração fica salva, mas pedidos ainda não devem gerar pontos.",
  },
  active: {
    label: "Ativo",
    helper: "O programa fica pronto para pontuar pedidos elegíveis quando o motor de acúmulo estiver conectado.",
  },
  paused: {
    label: "Pausado",
    helper: "Mantém a configuração e o histórico, sem novas emissões de pontos.",
  },
};

function parseDecimal(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

function formatDecimal(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function positiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function LoyaltyProgramWorkspace() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const [form, setForm] = useState<LoyaltyForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadProgram = async () => {
      try {
        const { restaurant, user } = await getCurrentRestaurant(supabase);
        if (!user) {
          router.push("/admin/login");
          return;
        }
        if (!restaurant) {
          if (active) setErrorMsg("Não foi possível localizar a loja.");
          return;
        }

        if (active) setRestaurantId(restaurant.id);

        const { data, error } = await (supabase as any)
          .from("loyalty_programs")
          .select(
            "id, name, status, earn_mode, spend_amount, points_per_spend, points_per_order, minimum_order_amount, points_expire_days",
          )
          .eq("restaurant_id", restaurant.id)
          .maybeSingle();

        if (error) throw error;
        if (!active || !data) return;

        const program = data as LoyaltyProgramRow;
        setProgramId(program.id);
        setForm({
          name: program.name,
          status: program.status,
          earnMode: program.earn_mode,
          spendAmount: formatDecimal(Number(program.spend_amount)),
          pointsPerSpend: String(program.points_per_spend),
          pointsPerOrder: String(program.points_per_order),
          minimumOrderAmount: formatDecimal(Number(program.minimum_order_amount)),
          expires: program.points_expire_days != null,
          expiryDays: String(program.points_expire_days || 90),
        });
      } catch (error) {
        console.error(error);
        if (active) setErrorMsg("Erro ao carregar a configuração do programa de fidelidade.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProgram();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const updateForm = <K extends keyof LoyaltyForm>(key: K, value: LoyaltyForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccessMsg("");
  };

  const validate = () => {
    const name = form.name.trim();
    if (name.length < 3 || name.length > 80) {
      return "O nome do programa deve ter entre 3 e 80 caracteres.";
    }

    const minimumOrderAmount = parseDecimal(form.minimumOrderAmount);
    if (!Number.isFinite(minimumOrderAmount) || minimumOrderAmount < 0) {
      return "Informe um valor mínimo de pedido válido.";
    }

    if (form.earnMode === "amount") {
      const spendAmount = parseDecimal(form.spendAmount);
      if (!Number.isFinite(spendAmount) || spendAmount <= 0) {
        return "Informe um valor gasto maior que zero para a regra de acúmulo.";
      }
      if (!positiveInteger(form.pointsPerSpend)) {
        return "Informe uma quantidade inteira de pontos por valor gasto.";
      }
    } else if (!positiveInteger(form.pointsPerOrder)) {
      return "Informe uma quantidade inteira de pontos por pedido.";
    }

    if (form.expires) {
      const expiryDays = positiveInteger(form.expiryDays);
      if (!expiryDays || expiryDays > 3650) {
        return "A validade dos pontos deve ficar entre 1 e 3650 dias.";
      }
    }

    return "";
  };

  const saveProgram = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }
    if (!restaurantId) {
      setErrorMsg("Não foi possível localizar a loja.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        name: form.name.trim(),
        status: form.status,
        earn_mode: form.earnMode,
        spend_amount: form.earnMode === "amount" ? parseDecimal(form.spendAmount) : 1,
        points_per_spend: form.earnMode === "amount" ? positiveInteger(form.pointsPerSpend) : 1,
        points_per_order: form.earnMode === "order" ? positiveInteger(form.pointsPerOrder) : 1,
        minimum_order_amount: parseDecimal(form.minimumOrderAmount),
        points_expire_days: form.expires ? positiveInteger(form.expiryDays) : null,
      };

      const { data, error } = await (supabase as any)
        .from("loyalty_programs")
        .upsert(payload, { onConflict: "restaurant_id" })
        .select("id")
        .single();

      if (error) throw error;
      setProgramId(data.id);
      setSuccessMsg("Configuração do programa salva com sucesso.");
    } catch (error) {
      console.error(error);
      setErrorMsg("Não foi possível salvar o programa de fidelidade.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminPageSkeleton ariaLabel="Carregando programa de fidelidade" metrics={3} />;
  }

  if (errorMsg && !restaurantId) {
    return <AdminErrorState description={errorMsg} />;
  }

  const earningPreview =
    form.earnMode === "amount"
      ? `${form.pointsPerSpend || "0"} ponto(s) a cada R$ ${form.spendAmount || "0,00"}`
      : `${form.pointsPerOrder || "0"} ponto(s) por pedido concluído`;

  return (
    <AdminPageShell className="space-y-6 pb-12">
      <AdminPageHeader
        title="Programa de fidelidade"
        description="Defina como seus clientes acumulam pontos e por quanto tempo eles permanecem disponíveis."
        icon={<Award size={24} />}
        action={
          <AdminButton onClick={saveProgram} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Salvando..." : "Salvar programa"}
          </AdminButton>
        }
      />

      {errorMsg ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMsg}
        </div>
      ) : null}
      {successMsg ? (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMsg}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <article className="surface-card rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">Configuração</p>
              <h2 className="mt-2 text-xl font-black text-gray-950">Regras do programa</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                Existe um único programa por loja. Alterar as regras não mistura pontos com cupons ou giros da Roleta.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${form.status === "active" ? "bg-emerald-100 text-emerald-700" : form.status === "paused" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
              {STATUS_META[form.status].label}
            </span>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-gray-700">Nome do programa</span>
              <AdminInput
                value={form.name}
                maxLength={80}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="Ex.: Clube Shifuh"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold text-gray-700">Status</span>
              <AdminSelect
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value as LoyaltyStatus)}
              >
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
              </AdminSelect>
              <span className="mt-2 block text-xs leading-5 text-gray-400">{STATUS_META[form.status].helper}</span>
            </label>

            <label>
              <span className="mb-2 block text-sm font-bold text-gray-700">Forma de acúmulo</span>
              <AdminSelect
                value={form.earnMode}
                onChange={(event) => updateForm("earnMode", event.target.value as EarnMode)}
              >
                <option value="amount">Por valor gasto</option>
                <option value="order">Por pedido concluído</option>
              </AdminSelect>
              <span className="mt-2 block text-xs leading-5 text-gray-400">
                Pedidos cancelados não serão considerados elegíveis para pontuação.
              </span>
            </label>

            {form.earnMode === "amount" ? (
              <>
                <label>
                  <span className="mb-2 block text-sm font-bold text-gray-700">Pontos concedidos</span>
                  <AdminInput
                    type="number"
                    min="1"
                    step="1"
                    value={form.pointsPerSpend}
                    onChange={(event) => updateForm("pointsPerSpend", event.target.value)}
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-gray-700">A cada valor gasto</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">R$</span>
                    <AdminInput
                      className="pl-11"
                      inputMode="decimal"
                      value={form.spendAmount}
                      onChange={(event) => updateForm("spendAmount", event.target.value)}
                    />
                  </div>
                </label>
              </>
            ) : (
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-gray-700">Pontos por pedido concluído</span>
                <AdminInput
                  type="number"
                  min="1"
                  step="1"
                  value={form.pointsPerOrder}
                  onChange={(event) => updateForm("pointsPerOrder", event.target.value)}
                />
              </label>
            )}

            <label>
              <span className="mb-2 block text-sm font-bold text-gray-700">Pedido mínimo para pontuar</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">R$</span>
                <AdminInput
                  className="pl-11"
                  inputMode="decimal"
                  value={form.minimumOrderAmount}
                  onChange={(event) => updateForm("minimumOrderAmount", event.target.value)}
                />
              </div>
              <span className="mt-2 block text-xs leading-5 text-gray-400">Use R$ 0,00 para não exigir valor mínimo.</span>
            </label>

            <div>
              <span className="mb-2 block text-sm font-bold text-gray-700">Validade dos pontos</span>
              <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4">
                <input
                  type="checkbox"
                  checked={form.expires}
                  onChange={(event) => updateForm("expires", event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-[var(--brand)]"
                />
                <span className="text-sm font-bold text-gray-700">Os pontos expiram</span>
              </label>
              {form.expires ? (
                <div className="mt-2 flex items-center gap-2">
                  <AdminInput
                    type="number"
                    min="1"
                    max="3650"
                    step="1"
                    value={form.expiryDays}
                    onChange={(event) => updateForm("expiryDays", event.target.value)}
                  />
                  <span className="shrink-0 text-sm font-bold text-gray-500">dias</span>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-5 text-gray-400">Sem vencimento automático.</p>
              )}
            </div>
          </div>
        </article>

        <aside className="surface-card rounded-3xl p-5 sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
            <Coins size={19} />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">Resumo</p>
          <h2 className="mt-2 text-xl font-black text-gray-950">{form.name.trim() || "Programa de fidelidade"}</h2>
          <p className="mt-3 text-sm leading-6 text-gray-500">{earningPreview}</p>

          <div className="mt-5 space-y-3 border-t border-[var(--line)] pt-5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500">Pedido mínimo</span>
              <strong className="text-gray-900">R$ {form.minimumOrderAmount || "0,00"}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500">Validade</span>
              <strong className="text-right text-gray-900">{form.expires ? `${form.expiryDays || "0"} dias` : "Sem expiração"}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500">Persistência</span>
              <strong className="text-gray-900">{programId ? "Salvo" : "Novo"}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-card rounded-3xl p-5">
          <ShoppingBag size={19} className="text-[var(--brand)]" />
          <h3 className="mt-4 font-black text-gray-950">Pedido concluído</h3>
          <p className="mt-2 text-sm leading-6 text-gray-500">A emissão futura será vinculada a pedidos elegíveis e concluídos, evitando pontuar pedidos cancelados.</p>
        </article>
        <article className="surface-card rounded-3xl p-5">
          <Users size={19} className="text-[var(--brand)]" />
          <h3 className="mt-4 font-black text-gray-950">Saldo por cliente e loja</h3>
          <p className="mt-2 text-sm leading-6 text-gray-500">A carteira será isolada por restaurante e seguirá a identidade segura do cliente já usada em Promoções.</p>
        </article>
        <article className="surface-card rounded-3xl p-5">
          {form.status === "paused" ? <CirclePause size={19} className="text-[var(--brand)]" /> : <BadgeCheck size={19} className="text-[var(--brand)]" />}
          <h3 className="mt-4 font-black text-gray-950">Configuração persistida</h3>
          <p className="mt-2 text-sm leading-6 text-gray-500">A carteira, o extrato e o motor de acúmulo entram nas próximas frentes sem alterar os resultados históricos da Roleta.</p>
        </article>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
            <WalletCards size={19} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">Próximas estruturas</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">Da configuração para a carteira</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Com as regras do programa persistidas, a próxima etapa cria saldo e extrato auditável. Depois conectaremos catálogo de recompensas, resgate e checkout.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { icon: WalletCards, title: "Carteira e extrato", text: "Saldo e movimentações por cliente." },
            { icon: Gift, title: "Recompensas", text: "Benefícios com custo definido em pontos." },
            { icon: Sparkles, title: "Recompra", text: "Uso dos pontos como incentivo de retorno." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-2xl border border-[var(--line)] bg-[#fffdfa] p-4">
                <Icon size={17} className="text-[var(--brand)]" />
                <h3 className="mt-3 font-black text-gray-950">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-gray-500">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    </AdminPageShell>
  );
}
