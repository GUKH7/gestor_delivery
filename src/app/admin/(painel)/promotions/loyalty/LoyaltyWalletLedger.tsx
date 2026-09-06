"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, History, ShieldCheck, WalletCards } from "lucide-react";
import { AdminPageShell } from "@/components/ui/admin-primitives";
import { AdminErrorState, AdminPageSkeleton } from "@/components/ui/admin-page-states";
import { getCurrentRestaurant } from "@/lib/supabase/restaurant";

type LoyaltyAccount = {
  id: string;
  customer_id: string;
  points_balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  lifetime_expired: number;
  updated_at: string;
};

type LoyaltyTransaction = {
  id: string;
  customer_id: string;
  transaction_type: "earn" | "redeem" | "expire" | "adjustment_credit" | "adjustment_debit";
  points_delta: number;
  balance_after: number;
  description: string | null;
  expires_at: string | null;
  created_at: string;
};

type CustomerIdentity = {
  id: string;
  phone: string | null;
};

const TRANSACTION_LABELS: Record<LoyaltyTransaction["transaction_type"], string> = {
  earn: "Pontos recebidos",
  redeem: "Resgate",
  expire: "Pontos expirados",
  adjustment_credit: "Ajuste de crédito",
  adjustment_debit: "Ajuste de débito",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPhone(value: string | null | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return value || "Cliente sem telefone";
}

export default function LoyaltyWalletLedger() {
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
  const [errorMsg, setErrorMsg] = useState("");
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [customers, setCustomers] = useState<CustomerIdentity[]>([]);

  useEffect(() => {
    let active = true;

    const loadWallets = async () => {
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

        const [{ data: accountRows, error: accountError }, { data: transactionRows, error: transactionError }] =
          await Promise.all([
            (supabase as any)
              .from("loyalty_accounts")
              .select("id, customer_id, points_balance, lifetime_earned, lifetime_redeemed, lifetime_expired, updated_at")
              .eq("restaurant_id", restaurant.id)
              .order("updated_at", { ascending: false })
              .limit(50),
            (supabase as any)
              .from("loyalty_point_transactions")
              .select("id, customer_id, transaction_type, points_delta, balance_after, description, expires_at, created_at")
              .eq("restaurant_id", restaurant.id)
              .order("created_at", { ascending: false })
              .limit(50),
          ]);

        if (accountError) throw accountError;
        if (transactionError) throw transactionError;

        const loadedAccounts = (accountRows || []) as LoyaltyAccount[];
        const loadedTransactions = (transactionRows || []) as LoyaltyTransaction[];
        const customerIds = Array.from(
          new Set([
            ...loadedAccounts.map((account) => account.customer_id),
            ...loadedTransactions.map((transaction) => transaction.customer_id),
          ]),
        );

        let customerRows: CustomerIdentity[] = [];
        if (customerIds.length) {
          const { data, error } = await (supabase as any)
            .from("customers")
            .select("id, phone")
            .eq("restaurant_id", restaurant.id)
            .in("id", customerIds);
          if (error) throw error;
          customerRows = (data || []) as CustomerIdentity[];
        }

        if (!active) return;
        setAccounts(loadedAccounts);
        setTransactions(loadedTransactions);
        setCustomers(customerRows);
      } catch (error) {
        console.error(error);
        if (active) setErrorMsg("Erro ao carregar as carteiras de fidelidade.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadWallets();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const phoneByCustomerId = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.phone] as const)),
    [customers],
  );

  if (loading) {
    return <AdminPageSkeleton ariaLabel="Carregando carteiras de fidelidade" metrics={2} />;
  }

  if (errorMsg) return <AdminErrorState description={errorMsg} />;

  return (
    <AdminPageShell className="space-y-6 pb-12">
      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">Carteiras</p>
            <h2 className="mt-2 text-xl font-black text-gray-950">Saldo por cliente</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              O saldo é materializado para leitura rápida e sempre acompanhado por um extrato imutável de movimentações.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
            <ShieldCheck size={14} />
            Somente leitura no painel
          </span>
        </div>

        {accounts.length ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {accounts.map((account) => (
              <article key={account.id} className="rounded-2xl border border-[var(--line)] bg-[#fffdfa] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-gray-950">
                      {formatPhone(phoneByCustomerId.get(account.customer_id))}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">Atualizado em {formatDate(account.updated_at)}</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--brand)] shadow-sm">
                    <WalletCards size={17} />
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400">Saldo disponível</p>
                    <p className="mt-1 text-2xl font-black text-gray-950">{account.points_balance} pts</p>
                  </div>
                  <div className="text-right text-xs leading-5 text-gray-500">
                    <p>{account.lifetime_earned} ganhos</p>
                    <p>{account.lifetime_redeemed} usados</p>
                    <p>{account.lifetime_expired} expirados</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-[#fffdfa] px-5 py-8 text-center">
            <WalletCards size={22} className="mx-auto text-gray-300" />
            <p className="mt-3 font-black text-gray-700">Nenhuma carteira criada ainda</p>
            <p className="mt-1 text-sm text-gray-400">As carteiras serão abertas automaticamente quando o acúmulo de pontos entrar em operação.</p>
          </div>
        )}
      </section>

      <section className="surface-card rounded-3xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff2ea] text-[var(--brand)]">
            <History size={19} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">Extrato auditável</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">Movimentações recentes</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">Créditos, resgates, expirações e ajustes ficam registrados sem edição ou exclusão.</p>
          </div>
        </div>

        {transactions.length ? (
          <div className="mt-5 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            {transactions.map((transaction) => {
              const positive = transaction.points_delta > 0;
              const Icon = positive ? ArrowUpRight : ArrowDownRight;
              return (
                <article key={transaction.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${positive ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"}`}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-black text-gray-900">{TRANSACTION_LABELS[transaction.transaction_type]}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {formatPhone(phoneByCustomerId.get(transaction.customer_id))} • {formatDate(transaction.created_at)}
                      </p>
                      {transaction.description ? <p className="mt-1 text-sm text-gray-500">{transaction.description}</p> : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className={`font-black ${positive ? "text-emerald-600" : "text-orange-600"}`}>
                      {positive ? "+" : ""}{transaction.points_delta} pts
                    </p>
                    <p className="mt-1 text-xs text-gray-400">Saldo: {transaction.balance_after} pts</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-[#fffdfa] px-5 py-8 text-center">
            <History size={22} className="mx-auto text-gray-300" />
            <p className="mt-3 font-black text-gray-700">Nenhuma movimentação registrada</p>
            <p className="mt-1 text-sm text-gray-400">O extrato será preenchido pelas próximas etapas de acúmulo e resgate.</p>
          </div>
        )}
      </section>
    </AdminPageShell>
  );
}
