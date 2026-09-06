"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  Gift,
  History,
  Loader2,
  PauseCircle,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Timer,
} from "lucide-react";
import {
  AdminButton,
  AdminInput,
  AdminPageHeader,
  AdminPageShell,
  AdminSelect,
} from "@/components/ui/admin-primitives";
import {
  AdminErrorState,
  AdminPageSkeleton,
} from "@/components/ui/admin-page-states";
import { getCurrentRestaurant } from "@/lib/supabase/restaurant";

type LoyaltyStatus = "draft" | "active" | "paused";
type EarningMode = "spend" | "order";

type LoyaltyProgramRow = {
  id: string;
  name: string;
  status: LoyaltyStatus;
  earning_mode: EarningMode;
  spend_unit_amount: number | null;
  points_per_spend_unit: number | null;
  points_per_order: number | null;
  minimum_order_amount: number;
  points_validity_days: number | null;
  updated_at: string;
};

type LoyaltyForm = {
  name: string;
  status: LoyaltyStatus;
  earningMode: EarningMode;
  spendUnitAmount: string;
  pointsPerSpendUnit: string;
  pointsPerOrder: string;
  minimumOrderAmount: string;
  pointsExpire: boolean;
  pointsValidityDays: string;
};

const DEFAULT_FORM: LoyaltyForm = {
  name: "Clube de fidelidade",
  status: "draft",
  earningMode: "spend",
  spendUnitAmount: "1",
  pointsPerSpendUnit: "1",
  pointsPerOrder: "10",
  minimumOrderAmount: "0",
  pointsExpire: false,
  pointsValidityDays: "90",
};

const LOYALTY_STEPS = [
  {
    title: "Acumular pontos",
    description: "Pedidos elegíveis alimentam a carteira do cliente conforme a regra definida pela loja.",
    icon: ShoppingBag,
  },
  {
    title: "Trocar por recompensas",
    description: "O saldo poderá ser convertido em descontos, frete grátis ou produtos do catálogo de fidelidade.",
    icon: Gift,
  },
  {
    title: "Voltar a comprar",
    description: "A progressão visível cria um incentivo contínuo para o cliente retornar à mesma loja.",
    icon: Sparkles,
  },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parseNumber(value: string) {
  return Number(value.replace(",", "."));
}

function positiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function statusMeta(status: LoyaltyStatus) {
  if (status === "active") {
    return {
      label: "Ativo",
      className: "bg-emerald-100 text-emerald-700",
      icon: CheckCircle2,
    };
  }

  if (status === "paused") {
    return {
      label: "Pausado",
      className: "bg-amber-100 text-amber-700",
      icon: PauseCircle,
    };
  }

  return {
    label: "Rascunho",
    className: "bg-gray-100 text-gray-600",
    icon: History,
  };
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

  const [restaurantId, setRestaurantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [programId, setProgramId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [form, setForm] = useState<LoyaltyForm>(DEFAULT_FORM);

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
          if (active) setLoadError("Não foi possível localizar a loja.");
          return;
        }

        if (active) setRestaurantId(restaurant.id);

        const { data, error } = await (supabase as any)
          .from("loyalty_programs")
          .select(
            "id, name, status, earning_mode, spend_unit_amount, points_per_spend_unit, points_per_order, minimum_order_amount, points_validity_days, updated_at",
          )
          .eq("restaurant_id", restaurant.id)
          .maybeSingle();

        if (error) throw error;
        if (!active) return;

        if (data) {
          const row = data as LoyaltyProgramRow;
          setProgramId(row.id);
          setUpdatedAt(row.updated_at);
          setForm({
            name: row.name,
            status: row.status,
            earningMode: row.earning_mode,
            spendUnitAmount: row.spend_unit_amount == null ? "1" : String(row.spend_unit_amount),
            pointsPerSpendUnit:
              row.points_per_spend_unit == null ? "1" : String(row.points_per_spend_unit),
            pointsPerOrder: row.points_per_order == null ? "10" : String(row.points_per_order),
            minimumOrderAmount: String(row.minimum_order_amount || 0),
            pointsExpire: row.points_validity_days != null,
            pointsValidityDays:
              row.points_validity_days == null ? "90" : String(row.points_validity_days),
          });
        }
      } catch (error) {
        console.error(error);
        if (active) setLoadError("Erro ao carregar a configuração do programa de fidelidade.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProgram();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const earningPreview = useMemo(() => {
    if (form.earningMode === "order") {
      const points = positiveInteger(form.pointsPerOrder) || 0;
      return `${points} ponto${points === 1 ? "" : "s"} por pedido concluído`;
    }

    const amount = parseNumber(form.spendUnitAmount);
    const points = positiveInteger(form.pointsPerSpendUnit) || 0;
    return `${points} ponto${points === 1 ? "" : "s"} a cada ${formatMoney(Number.isFinite(amount) ? amount : 0)} gasto`;
  }, [form.earningMode, form.pointsPerOrder, form.pointsPerSpendUnit, form.spendUnitAmount]);

  const updateForm = <K extends keyof LoyaltyForm>(key: K, value: LoyaltyForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
    setSuccessMessage("");
  };

  const validateForm = () => {
    const name = form.name.trim();
    if (name.length < 3 || name.length > 80) {
      return "O nome do programa deve ter entre 3 e 80 caracteres.";
    }

    const minimumOrder = parseNumber(form.minimumOrderAmount);
    if (!Number.isFinite(minimumOrder) || minimumOrder < 0) {
      return "Informe um valor mínimo de pedido válido.";
    }

    if (form.earningMode === "spend") {
      const spendUnit = parseNumber(form.spendUnitAmount);
      if (!Number.isFinite(spendUnit) || spendUnit <= 0) {
        return "O valor usado como base para acumular pontos deve ser maior que zero.";
      }

      if (!positiveInteger(form.pointsPerSpendUnit)) {
        return "A quantidade de pontos por valor gasto deve ser um número inteiro maior que zero.";
      }
    } else if (!positiveInteger(form.pointsPerOrder)) {
      return "A quantidade de pontos por pedido deve ser um número inteiro maior que zero.";
    }

    if (form.pointsExpire && !positiveInteger(form.pointsValidityDays)) {
      return "A validade dos pontos deve ser informada em dias inteiros maiores que zero.";
    }

    return "";
  };

  const saveProgram = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (!restaurantId) {
      setFormError("Não foi possível identificar a loja para salvar o programa.");
      return;
    }

    setSaving(true);
    setFormError("");
    setSuccessMessage("");

    try {
      const spendUnitAmount = parseNumber(form.spendUnitAmount);
      const minimumOrderAmount = parseNumber(form.minimumOrderAmount);
      const pointsPerSpendUnit = positiveInteger(form.pointsPerSpendUnit);
      const pointsPerOrder = positiveInteger(form.pointsPerOrder);
      const pointsValidityDays = positiveInteger(form.pointsValidityDays);

      const payload = {
        restaurant_id: restaurantId,
        name: form.name.trim(),
        status: form.status,
        earning_mode: form.earningMode,
        spend_unit_amount: form.earningMode === "spend" ? spendUnitAmount : null,
        points_per_spend_unit: form.earningMode === "spend" ? pointsPerSpendUnit : null,
        points_per_order: form.earningMode === "order" ? pointsPerOrder : null,
        minimum_order_amount: minimumOrderAmount,
        points_validity_days: form.pointsExpire ? pointsValidityDays : null,
      };

      const { data, error } = await (supabase as any)
        .from("loyalty_programs")
        .upsert(payload, { onConflict: "restaurant_id" })
        .select("id, updated_at")
        .single();

      if (error) throw error;

      setProgramId(data.id);
      setUpdatedAt(data.updated_at);
      setSuccessMessage("Configuração do programa salva com sucesso.");
    } catch (error) {
      console.error(error);
      setFormError("Não foi possível salvar o programa de fidelidade.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminPageSkeleton ariaLabel="Carregando programa de fidelidade" metrics={3} />;
  }

  if (loadError) return <AdminErrorState description={loadError} />;

  const currentStatus = statusMeta(form.status);
  const StatusIcon = currentStatus.icon;

  return (
    <AdminPageShell className="space-y-6 pb-12">
      <AdminPageHeader
        title="Programa de fidelidade"
        description="Defina como seus clientes acumulam pontos e por quanto tempo o saldo permanece válido."
        icon={<Award size={24} />}
        action={
          <AdminButton onClick={saveProgram} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Salvando..." : "Salvar programa"}
          </AdminButton>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-card rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
              <StatusIcon size={19} />
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${currentStatus.className}`}>
              {currentStatus.label}
            </span>
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.1em] text-gray-400">Status</p>
          <p className="mt-1 font-black text-gray-950">{programId ? "Programa configurado" : "Configuração inicial"}</p>
        </article>

        <article className="surface-card rounded-3xl p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
            <Coins size={19} />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.1em] text-gray-400">Regra de acúmulo</p>
          <p className="mt-1 font-black text-gray-950">{earningPreview}</p>
        </article>

        <article className="surface-card rounded-3xl p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
            <Timer size={19} />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.1em] text-gray-400">Validade</p>
          <p className="mt-1 font-black text-gray-950">
            {form.pointsExpire ? `${form.pointsValidityDays || 0} dias` : "Pontos não expiram"}
          </p>
        </article>
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-2 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">Configuração</p>
            <h2 className="mt-2 text-xl font-black text-gray-950">Regras do programa</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Esta configuração será usada pelo motor de acúmulo automático quando os créditos de pontos forem conectados aos pedidos concluídos.
            </p>
          </div>
          {updatedAt ? (
            <p className="text-xs font-medium text-gray-400">
              Atualizado em {new Date(updatedAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-gray-700">Nome do programa</span>
            <AdminInput
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              maxLength={80}
              placeholder="Ex.: Clube Shifuh"
            />
            <span className="mt-1.5 block text-xs text-gray-400">Nome exibido ao cliente nas próximas etapas.</span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-gray-700">Status</span>
            <AdminSelect
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value as LoyaltyStatus)}
            >
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
            </AdminSelect>
            <span className="mt-1.5 block text-xs text-gray-400">Pausar preserva a configuração sem apagar o programa.</span>
          </label>
        </div>

        <div className="mt-7">
          <span className="text-sm font-black text-gray-700">Como os clientes acumulam pontos?</span>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => updateForm("earningMode", "spend")}
              aria-pressed={form.earningMode === "spend"}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                form.earningMode === "spend"
                  ? "border-orange-300 bg-orange-50"
                  : "border-[var(--line)] bg-white hover:bg-[#fffdfa]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--brand)] shadow-sm">
                  <CircleDollarSign size={18} />
                </span>
                <div>
                  <p className="font-black text-gray-950">Por valor gasto</p>
                  <p className="mt-1 text-sm text-gray-500">Ex.: a cada R$ 1,00 = 1 ponto.</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => updateForm("earningMode", "order")}
              aria-pressed={form.earningMode === "order"}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                form.earningMode === "order"
                  ? "border-orange-300 bg-orange-50"
                  : "border-[var(--line)] bg-white hover:bg-[#fffdfa]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--brand)] shadow-sm">
                  <ShoppingBag size={18} />
                </span>
                <div>
                  <p className="font-black text-gray-950">Por pedido</p>
                  <p className="mt-1 text-sm text-gray-500">Ex.: cada pedido concluído = 10 pontos.</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {form.earningMode === "spend" ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-gray-700">A cada valor gasto</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-bold text-gray-400">R$</span>
                <AdminInput
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="pl-11"
                  value={form.spendUnitAmount}
                  onChange={(event) => updateForm("spendUnitAmount", event.target.value)}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-gray-700">Pontos concedidos</span>
              <AdminInput
                type="number"
                min="1"
                step="1"
                value={form.pointsPerSpendUnit}
                onChange={(event) => updateForm("pointsPerSpendUnit", event.target.value)}
              />
            </label>
          </div>
        ) : (
          <div className="mt-5 max-w-md">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-gray-700">Pontos por pedido concluído</span>
              <AdminInput
                type="number"
                min="1"
                step="1"
                value={form.pointsPerOrder}
                onChange={(event) => updateForm("pointsPerOrder", event.target.value)}
              />
            </label>
          </div>
        )}

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-gray-700">Pedido mínimo para pontuar</span>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-bold text-gray-400">R$</span>
              <AdminInput
                type="number"
                min="0"
                step="0.01"
                className="pl-11"
                value={form.minimumOrderAmount}
                onChange={(event) => updateForm("minimumOrderAmount", event.target.value)}
              />
            </div>
            <span className="mt-1.5 block text-xs text-gray-400">Use R$ 0 para permitir qualquer pedido elegível.</span>
          </label>

          <div>
            <span className="mb-2 block text-sm font-black text-gray-700">Validade dos pontos</span>
            <button
              type="button"
              onClick={() => updateForm("pointsExpire", !form.pointsExpire)}
              aria-pressed={form.pointsExpire}
              className="flex min-h-11 w-full items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-black text-gray-800">Os pontos expiram</p>
                <p className="mt-1 text-xs text-gray-400">Controle por quanto tempo cada crédito poderá ser usado.</p>
              </div>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.pointsExpire ? "bg-[var(--brand)]" : "bg-gray-200"}`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${form.pointsExpire ? "translate-x-6" : "translate-x-1"}`}
                />
              </span>
            </button>

            {form.pointsExpire ? (
              <div className="mt-3">
                <AdminInput
                  type="number"
                  min="1"
                  step="1"
                  aria-label="Validade dos pontos em dias"
                  value={form.pointsValidityDays}
                  onChange={(event) => updateForm("pointsValidityDays", event.target.value)}
                />
                <span className="mt-1.5 block text-xs text-gray-400">Validade em dias a partir de cada crédito de pontos.</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-7 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
          <div className="flex gap-3">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[var(--brand)]" />
            <div>
              <p className="font-black text-gray-950">Regra operacional preparada</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Os pontos serão creditados somente por pedidos concluídos e elegíveis. A execução automática e a carteira auditável entram nas próximas frentes; esta etapa salva apenas a regra que o motor deverá obedecer.
              </p>
            </div>
          </div>
        </div>

        {formError ? (
          <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {formError}
          </div>
        ) : null}

        {successMessage ? (
          <div role="status" className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            <BadgeCheck size={17} />
            {successMessage}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <AdminButton onClick={saveProgram} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Salvando..." : "Salvar configuração"}
          </AdminButton>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">Jornada do cliente</p>
          <h2 className="mt-2 text-xl font-black text-gray-950">Como o programa será percebido</h2>
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
    </AdminPageShell>
  );
}
