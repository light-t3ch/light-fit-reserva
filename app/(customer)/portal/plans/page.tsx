import Link from "next/link";
import { redirect } from "next/navigation";

import { startPlanCheckout } from "./actions";
import { getServerAuthSession } from "@/lib/auth";
import { listPlanCatalogForCustomer, type PlanCatalogItem } from "@/server/plan-purchases";

const CATEGORY_LABELS: Record<string, string> = {
  SUBSCRIPTION: "月額プラン",
  PACKAGE: "回数チケット",
  ADDON: "追加チケット",
  TRIAL: "体験・カウンセリング",
  ENROLLMENT: "入会手続き",
};

function formatPrice(plan: PlanCatalogItem) {
  if (!plan.price || plan.price.amount == null || !plan.price.currency) {
    if (plan.isPurchasable) {
      return "Stripeで金額を表示";
    }

    if (plan.unavailableReason === "PRICE_LOOKUP_FAILED") {
      return "Stripe価格IDを確認してください";
    }

    return "オンライン決済の設定が必要です";
  }

  const formatter = new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: plan.price.currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const base = formatter.format(plan.price.amount / 100);

  if (plan.price.isRecurring && plan.billingCadence === "MONTHLY") {
    return `${base} / 月`;
  }

  return base;
}

function buildAlert(searchParams?: Record<string, string | string[]>) {
  const errorKey = typeof searchParams?.error === "string" ? searchParams.error : undefined;

  if (errorKey) {
    const messages: Record<string, string> = {
      plan_required: "プランが選択されていません。",
      customer_missing: "お客様情報を確認できませんでした。店舗にお問い合わせください。",
      plan_unavailable: "現在購入できないプランです。",
      plan_location: "ご契約店舗では購入できないプランです。",
      metadata: "決済情報の確認に失敗しました。再度お試しください。",
      checkout_unavailable: "Stripe決済の開始に失敗しました。少し時間をおいてお試しください。",
      price_config: "決済の設定が完了していません。店舗スタッフまでお問い合わせください。",
      price_lookup:
        "Stripeの価格IDが確認できませんでした。Price ID とシークレットキーのモード（テスト／本番）が一致しているかご確認ください。",
      unknown: "購入処理でエラーが発生しました。",
    };

    return {
      tone: "error" as const,
      message: messages[errorKey] ?? messages.unknown,
    };
  }

  const cancelled = typeof searchParams?.cancelled === "string" ? searchParams.cancelled : undefined;

  if (cancelled) {
    return {
      tone: "info" as const,
      message: "決済をキャンセルしました。再度購入する場合はプランを選択してください。",
    };
  }

  return null;
}

export default async function PlanStorePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  if (session.user.role !== "CUSTOMER") {
    redirect("/dashboard");
  }

  const { customer, plans } = await listPlanCatalogForCustomer(session.user.id);

  if (!customer) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center text-slate-600">
        <h1 className="text-2xl font-semibold text-slate-900">店舗の設定が必要です</h1>
        <p className="text-sm leading-relaxed">
          お客様の店舗情報を確認できませんでした。先にマイページまたは店舗スタッフにご連絡のうえ、契約店舗を登録してください。
        </p>
        <Link
          href="/portal"
          className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          ポータルに戻る
        </Link>
      </main>
    );
  }

  const alert = buildAlert(searchParams ?? {});

  const grouped = plans.reduce<Record<string, PlanCatalogItem[]>>((acc, plan) => {
    if (!acc[plan.category]) {
      acc[plan.category] = [];
    }
    acc[plan.category].push(plan);
    return acc;
  }, {});

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const order = ["SUBSCRIPTION", "PACKAGE", "ADDON", "TRIAL", "ENROLLMENT"];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-500">Purchase Tickets</p>
        <h1 className="text-3xl font-semibold text-slate-900">オンラインでチケット・プランを購入</h1>
        <p className="text-sm text-slate-600">
          クレジットカード決済で即時にチケットを追加できます。購入後はチケット残数に反映され、すぐに予約が可能です。
        </p>
        {customer && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            ご利用店舗：<span className="font-semibold text-slate-900">{customer.locationName}</span>
          </div>
        )}
        {alert && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              alert.tone === "error"
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {alert.message}
          </div>
        )}
      </header>

      <div className="space-y-12">
        {sortedCategories.map((category) => {
          const plansInCategory = grouped[category];
          if (!plansInCategory || plansInCategory.length === 0) {
            return null;
          }

          return (
            <section key={category} className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {CATEGORY_LABELS[category] ?? category}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {category === "SUBSCRIPTION"
                    ? "毎月のご利用回数を管理する定額プランです。"
                    : category === "PACKAGE"
                      ? "有効期限なく使える回数チケットです。"
                      : category === "ADDON"
                        ? "今月分の残数が足りないときに追加で購入できます。"
                        : category === "TRIAL"
                          ? "初回体験やカウンセリング専用のプランです。"
                          : "入会手続きに必要な費用です。"}
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {plansInCategory.map((plan) => (
                  <form
                    key={plan.id}
                    action={startPlanCheckout}
                    className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-300"
                  >
                    <input type="hidden" name="plan" value={plan.slug} />
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
                          <p className="mt-2 text-sm text-slate-600">
                            {plan.description ?? `${plan.baseCredits}回分 / ${plan.durationMinutes}分`}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                            {plan.sessionCategory === "PT_55"
                              ? "55分セッション"
                              : plan.sessionCategory === "PT_25"
                                ? "25分セッション"
                                : plan.sessionCategory === "TRIAL_90"
                                  ? "体験90分"
                                  : plan.sessionCategory === "COUNSELING"
                                    ? "カウンセリング"
                                    : "入会関連"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-slate-900">{formatPrice(plan)}</p>
                          {plan.price?.isRecurring ? (
                            <p className="mt-1 text-xs text-slate-500">Stripeサブスクリプション決済</p>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">Stripeワンタイム決済</p>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-1 text-sm text-slate-600">
                        {plan.baseCredits > 0 && (
                          <li>・チケット付与数：{plan.baseCredits}回</li>
                        )}
                        {plan.billingCadence === "MONTHLY" && (
                          <li>・毎月自動更新 / 22日以降のご購入は翌月分から適用</li>
                        )}
                        {category === "ADDON" && (
                          <li>・購入後すぐに今月の残数へ反映されます</li>
                        )}
                      </ul>
                    </div>
                    <div className="mt-6 space-y-3">
                      <button
                        type="submit"
                        disabled={!plan.isPurchasable}
                        className={`inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                          plan.isPurchasable
                            ? "bg-brand-600 text-white transition hover:bg-brand-500"
                            : "cursor-not-allowed bg-slate-200 text-slate-500"
                        }`}
                      >
                        {plan.isPurchasable ? "Stripeで購入手続きを進める" : "現在オンラインでは購入できません"}
                      </button>
                      {!plan.isPurchasable && (
                        <p className="text-xs leading-relaxed text-slate-500">
                          {plan.unavailableReason === "PRICE_LOOKUP_FAILED"
                            ? "Stripeの価格IDが見つかりませんでした。Price ID が存在し、シークレットキーと同じテスト／本番モードかご確認ください。"
                            : "オンライン決済の設定が完了していません。店舗スタッフまでお問い合わせください。"}
                        </p>
                      )}
                    </div>
                  </form>
                ))}
              </div>
            </section>
          );
        })}

        {plans.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
            現在オンラインで購入可能なプランがありません。店舗スタッフまでお問い合わせください。
          </div>
        )}
      </div>
    </main>
  );
}
