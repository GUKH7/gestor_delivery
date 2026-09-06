"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  Gift,
  RefreshCw,
  RotateCw,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { getCurrentRestaurant } from "@/lib/supabase/restaurant";
import { AdminButton, AdminPageShell } from "@/components/ui/admin-primitives";
import { AdminErrorState, AdminPageSkeleton } from "@/components/ui/admin-page-states";

const PAGE_SIZE = 1000;
const ORDER_CHUNK_SIZE = 120;
const WHEEL_CAMPAIGN_SAVED_EVENT = "shifuh:promotion-wheel-saved";

type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "ended";

type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
  max_awards: number | null;
  budget_limit: number | null;
  created_at: string;
};

type SpinRow = {
  id: string;
  customer_id: string;
  status: "pending" | "resolved" | "expired";
  created_at: string;
  resolved_at: string | null;
};

type ResultRow = {
  id: string;
  prize_id: string;
  prize_type: string;
  prize_label: string;
  customer_id: string;
  created_at: string;
};

type RewardRow = {
  id: string;
  prize_id: string;
  customer_id: string;
  reward_type: string;
  label: string;
  status: "available" | "redeemed" | "expired" | "cancelled";
  redeemed_order_id: string | null;
  redeemed_at: string | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  total: number | null;
  discount: number | null;
  status: string | null;
  created_at: string;
};

type Snapshot = {
  campaign: CampaignRow;
  spins: SpinRow[];
  results: ResultRow[];
  rewards: RewardRow[];
  orders: OrderRow[];
};

type Metric = {
  label: string;
  value: string;
  helper: string;
  icon: typeof Activity;
};

type PrizePerformance = {
  prizeId: string;
  label: string;
  type: string;
  outcomes: number;
  used: number;
  conversion: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: value > 0 && value < 10 ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: CampaignStatus) {
  if (status === "active") return "Ativa";
  if (status === "scheduled") return "Agendada";
  if (status === "paused") return "Pausada";
  if (status === "ended") return "Encerrada";
  return "Rascunho";
}

function statusClass(status: CampaignStatus) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "paused") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "ended") return "border-gray-200 bg-gray-100 text-gray-600";
  return "border-orange-200 bg-orange-50 text-orange-700";
}

function prizeTypeLabel(type: string) {
  if (type === "percent") return "Desconto %";
  if (type === "fixed") return "Desconto fixo";
  if (type === "free_shipping") return "Frete grátis";
  if (type === "free_product") return "Produto grátis";
  if (type === "no_prize") return "Sem prêmio";
  return "Prêmio";
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

async function fetchPaginated<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function MetricTile({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  return (
    <article className="surface-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-gray-400">{metric.label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">{metric.value}</p>
          <p className="mt-2 text-xs leading-5 text-gray-500">{metric.helper}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
          <Icon size={19} />
        </span>
      </div>
    </article>
  );
}

function FunnelRow({
  label,
  value,
  helper,
  width,
}: {
  label: string;
  value: string;
  helper: string;
  width: number;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-black text-gray-900">{label}</p>
          <p className="mt-0.5 text-xs text-gray-500">{helper}</p>
        </div>
        <strong className="text-sm text-gray-950">{value}</strong>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, width))}%` }}
        />
      </div>
    </div>
  );
}

export default function WheelCampaignMetrics() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const loadMetrics = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setErrorMsg("");

    try {
      const { restaurant, user } = await getCurrentRestaurant(supabase);
      if (!user) {
        router.push("/admin/login");
        return;
      }
      if (!restaurant) throw new Error("Não foi possível localizar a loja.");

      const { data: campaignData, error: campaignError } = await (supabase as any)
        .from("promotion_campaigns")
        .select("id, name, status, starts_at, ends_at, max_awards, budget_limit, created_at")
        .eq("restaurant_id", restaurant.id)
        .eq("kind", "roulette")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (campaignError) throw campaignError;
      const campaign = campaignData as CampaignRow | null;
      if (!campaign) {
        setSnapshot(null);
        return;
      }

      const [spins, results, rewards] = await Promise.all([
        fetchPaginated<SpinRow>((from, to) =>
          (supabase as any)
            .from("promotion_spins")
            .select("id, customer_id, status, created_at, resolved_at")
            .eq("restaurant_id", restaurant.id)
            .eq("campaign_id", campaign.id)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchPaginated<ResultRow>((from, to) =>
          (supabase as any)
            .from("promotion_spin_results")
            .select("id, prize_id, prize_type, prize_label, customer_id, created_at")
            .eq("restaurant_id", restaurant.id)
            .eq("campaign_id", campaign.id)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchPaginated<RewardRow>((from, to) =>
          (supabase as any)
            .from("customer_rewards")
            .select("id, prize_id, customer_id, reward_type, label, status, redeemed_order_id, redeemed_at, created_at")
            .eq("restaurant_id", restaurant.id)
            .eq("campaign_id", campaign.id)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        ),
      ]);

      const redeemedOrderIds = Array.from(
        new Set(
          rewards
            .filter((reward) => reward.status === "redeemed" && reward.redeemed_order_id)
            .map((reward) => reward.redeemed_order_id as string),
        ),
      );

      const orderPages = await Promise.all(
        chunk(redeemedOrderIds, ORDER_CHUNK_SIZE).map(async (ids) => {
          const { data, error } = await (supabase as any)
            .from("orders")
            .select("id, total, discount, status, created_at")
            .eq("restaurant_id", restaurant.id)
            .in("id", ids);
          if (error) throw error;
          return (data || []) as OrderRow[];
        }),
      );

      setSnapshot({
        campaign,
        spins,
        results,
        rewards,
        orders: orderPages.flat(),
      });
    } catch (error) {
      console.error("Falha ao carregar métricas da roleta:", error);
      setErrorMsg("Não foi possível carregar as métricas da campanha.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadMetrics(false);

    const refreshAfterSave = () => void loadMetrics(true);
    window.addEventListener(WHEEL_CAMPAIGN_SAVED_EVENT, refreshAfterSave);
    return () => window.removeEventListener(WHEEL_CAMPAIGN_SAVED_EVENT, refreshAfterSave);
  }, [loadMetrics]);

  const analytics = useMemo(() => {
    if (!snapshot) return null;

    const resolvedSpins = snapshot.spins.filter((spin) => spin.status === "resolved");
    const pendingSpins = snapshot.spins.filter((spin) => spin.status === "pending").length;
    const participants = new Set(resolvedSpins.map((spin) => spin.customer_id));
    const awardedResults = snapshot.results.filter((result) => result.prize_type !== "no_prize");

    const validOrders = new Map(
      snapshot.orders
        .filter((order) => order.status !== "canceled")
        .map((order) => [order.id, order] as const),
    );

    const usedRewards = snapshot.rewards.filter(
      (reward) =>
        reward.status === "redeemed" &&
        reward.redeemed_order_id &&
        validOrders.has(reward.redeemed_order_id),
    );

    const repurchaseCustomers = new Set(usedRewards.map((reward) => reward.customer_id));
    const associatedOrders = Array.from(
      new Map(
        usedRewards
          .map((reward) =>
            reward.redeemed_order_id ? validOrders.get(reward.redeemed_order_id) : undefined,
          )
          .filter((order): order is OrderRow => Boolean(order))
          .map((order) => [order.id, order] as const),
      ).values(),
    );

    const promotionalCost = associatedOrders.reduce(
      (sum, order) => sum + Number(order.discount || 0),
      0,
    );
    const associatedRevenue = associatedOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0,
    );
    const repurchaseRate = participants.size > 0
      ? (repurchaseCustomers.size / participants.size) * 100
      : 0;
    const returnMultiple = promotionalCost > 0 ? associatedRevenue / promotionalCost : null;
    const awardRate = resolvedSpins.length > 0
      ? (awardedResults.length / resolvedSpins.length) * 100
      : 0;
    const usageRate = awardedResults.length > 0
      ? (usedRewards.length / awardedResults.length) * 100
      : 0;

    const usedByPrize = new Map<string, number>();
    usedRewards.forEach((reward) => {
      usedByPrize.set(reward.prize_id, (usedByPrize.get(reward.prize_id) || 0) + 1);
    });

    const performance = new Map<string, PrizePerformance>();
    snapshot.results.forEach((result) => {
      const current = performance.get(result.prize_id) || {
        prizeId: result.prize_id,
        label: result.prize_label,
        type: result.prize_type,
        outcomes: 0,
        used: 0,
        conversion: 0,
      };
      current.outcomes += 1;
      performance.set(result.prize_id, current);
    });

    const prizePerformance = Array.from(performance.values())
      .map((item) => {
        const used = usedByPrize.get(item.prizeId) || 0;
        return {
          ...item,
          used,
          conversion: item.type === "no_prize" || item.outcomes === 0
            ? 0
            : (used / item.outcomes) * 100,
        };
      })
      .sort((a, b) => b.outcomes - a.outcomes || a.label.localeCompare(b.label, "pt-BR"));

    return {
      resolvedSpins: resolvedSpins.length,
      pendingSpins,
      participants: participants.size,
      prizesDistributed: awardedResults.length,
      prizesUsed: usedRewards.length,
      promotionalCost,
      associatedRevenue,
      repurchaseCustomers: repurchaseCustomers.size,
      repurchaseRate,
      returnMultiple,
      awardRate,
      usageRate,
      prizePerformance,
    };
  }, [snapshot]);

  if (loading) {
    return <AdminPageSkeleton ariaLabel="Carregando métricas da Roleta da Sorte" metrics={8} />;
  }

  if (errorMsg) {
    return (
      <AdminPageShell className="mb-6">
        <AdminErrorState description={errorMsg} />
      </AdminPageShell>
    );
  }

  if (!snapshot || !analytics) {
    return (
      <AdminPageShell className="mb-6">
        <section className="surface-card rounded-3xl p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
              <Activity size={22} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">Resultados da campanha</p>
              <h2 className="mt-1 text-xl font-black text-gray-950">As métricas aparecem após salvar a primeira Roleta da Sorte</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                Configure a campanha abaixo. Assim que existirem giros e recompensas, este painel passa a acompanhar desempenho, recompra e retorno automaticamente.
              </p>
            </div>
          </div>
        </section>
      </AdminPageShell>
    );
  }

  const campaign = snapshot.campaign;
  const metrics: Metric[] = [
    {
      label: "Giros realizados",
      value: String(analytics.resolvedSpins),
      helper: analytics.pendingSpins > 0
        ? `${analytics.pendingSpins} giro(s) liberado(s) aguardando o cliente`
        : "Somente giros com resultado persistido",
      icon: RotateCw,
    },
    {
      label: "Participantes",
      value: String(analytics.participants),
      helper: "Clientes únicos que efetivamente giraram",
      icon: Users,
    },
    {
      label: "Prêmios distribuídos",
      value: String(analytics.prizesDistributed),
      helper: `${formatPercent(analytics.awardRate)} dos giros terminaram com benefício`,
      icon: Gift,
    },
    {
      label: "Prêmios utilizados",
      value: String(analytics.prizesUsed),
      helper: `${formatPercent(analytics.usageRate)} dos benefícios já viraram recompra válida`,
      icon: BadgeCheck,
    },
    {
      label: "Custo promocional",
      value: formatMoney(analytics.promotionalCost),
      helper: "Descontos e fretes concedidos em pedidos válidos; produto grátis não entra sem custo cadastrado",
      icon: CircleDollarSign,
    },
    {
      label: "Receita associada",
      value: formatMoney(analytics.associatedRevenue),
      helper: "Receita dos pedidos não cancelados que resgataram prêmio da campanha",
      icon: TrendingUp,
    },
    {
      label: "Recompra",
      value: formatPercent(analytics.repurchaseRate),
      helper: `${analytics.repurchaseCustomers} participante(s) voltaram e utilizaram um prêmio`,
      icon: Users,
    },
    {
      label: "Retorno da campanha",
      value: analytics.returnMultiple === null
        ? "—"
        : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(analytics.returnMultiple)}x`,
      helper: analytics.returnMultiple === null
        ? "O retorno aparece quando houver benefício monetário contabilizado"
        : "Receita associada para cada R$ 1 de custo promocional contabilizado",
      icon: Trophy,
    },
  ];

  const funnelBase = Math.max(analytics.resolvedSpins, 1);

  return (
    <AdminPageShell className="mb-8 space-y-4">
      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">Dashboard da Roleta</p>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(campaign.status)}`}>
                {statusLabel(campaign.status)}
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950">{campaign.name}</h2>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} /> {formatDate(campaign.starts_at)} até {formatDate(campaign.ends_at)}
              </span>
              {campaign.max_awards ? <span>Limite: {campaign.max_awards} prêmios</span> : null}
              {campaign.budget_limit ? <span>Orçamento: {formatMoney(Number(campaign.budget_limit))}</span> : null}
            </div>
          </div>
          <AdminButton
            variant="secondary"
            onClick={() => void loadMetrics(true)}
            disabled={refreshing}
            className="shrink-0"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Atualizando" : "Atualizar métricas"}
          </AdminButton>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MetricTile key={metric.label} metric={metric} />)}
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="surface-card rounded-3xl p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
              <Activity size={19} />
            </span>
            <div>
              <h3 className="text-base font-black text-gray-950 sm:text-lg">Funil da campanha</h3>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Mostra quantos giros avançaram para premiação e, depois, para uma nova compra.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <FunnelRow
              label="Giros concluídos"
              value={String(analytics.resolvedSpins)}
              helper="Base do funil"
              width={100}
            />
            <FunnelRow
              label="Prêmios distribuídos"
              value={String(analytics.prizesDistributed)}
              helper={formatPercent(analytics.awardRate)}
              width={(analytics.prizesDistributed / funnelBase) * 100}
            />
            <FunnelRow
              label="Prêmios utilizados"
              value={String(analytics.prizesUsed)}
              helper={`${formatPercent(analytics.repurchaseRate)} dos participantes recompraram`}
              width={(analytics.prizesUsed / funnelBase) * 100}
            />
          </div>
        </section>

        <section className="surface-card overflow-hidden rounded-3xl">
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
                <Trophy size={19} />
              </span>
              <div>
                <h3 className="text-base font-black text-gray-950 sm:text-lg">Desempenho por resultado</h3>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Compare frequência de sorteio e conversão dos benefícios em novos pedidos.
                </p>
              </div>
            </div>
          </div>

          {analytics.prizePerformance.length === 0 ? (
            <div className="border-t border-[var(--line)] px-5 py-8 text-center text-sm text-gray-500">
              Ainda não há resultados de giro para comparar.
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-[var(--line)]">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-[#fbf7f2] text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                  <tr>
                    <th className="px-5 py-3">Resultado</th>
                    <th className="px-4 py-3 text-right">Sorteados</th>
                    <th className="px-4 py-3 text-right">Utilizados</th>
                    <th className="px-5 py-3 text-right">Conversão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {analytics.prizePerformance.map((item) => (
                    <tr key={item.prizeId} className="text-sm">
                      <td className="px-5 py-4">
                        <p className="font-black text-gray-900">{item.label}</p>
                        <p className="mt-1 text-xs text-gray-500">{prizeTypeLabel(item.type)}</p>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-gray-700">{item.outcomes}</td>
                      <td className="px-4 py-4 text-right font-bold text-gray-700">
                        {item.type === "no_prize" ? "—" : item.used}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-gray-950">
                        {item.type === "no_prize" ? "—" : formatPercent(item.conversion)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}
