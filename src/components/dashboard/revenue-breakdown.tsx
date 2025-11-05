import { getRevenueBreakdown } from "@/server/metrics";
const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export async function RevenueBreakdown({
  tenantId,
  locationId,
}: {
  tenantId?: string;
  locationId?: string | null;
} = {}) {
  const revenue = await getRevenueBreakdown(tenantId ?? "demo-tenant", {
    locationId: locationId ?? undefined,
  });

  if (revenue.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">売上サマリー</h2>
        <p className="mt-4">まだ売上データがありません。プラン購入が記録されるとこちらに表示されます。</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">売上サマリー</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {revenue.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-3 text-2xl font-bold text-slate-900">{currencyFormatter.format(item.amount)}</p>
            <p
              className={`mt-2 text-xs font-semibold ${
                item.deltaPercentage >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {item.deltaPercentage >= 0 ? "+" : ""}
              {item.deltaPercentage.toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
