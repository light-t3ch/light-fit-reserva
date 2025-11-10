import { getCustomerCreditSummary } from "@/server/credits";

const CREDIT_LABELS: Record<string, string> = {
  PT_55: "55分パーソナル",
  PT_25: "25分パーソナル",
  COUNSELING: "カウンセリング",
  TRIAL: "体験トレーニング",
};

export async function BookingSummary({
  userId,
  locationId,
}: {
  userId?: string;
  locationId?: string | null;
} = {}) {
  const credits = locationId
    ? await getCustomerCreditSummary(userId ?? "demo-user", { locationId })
    : [];

  const grouped = credits.reduce<Record<string, typeof credits[number][]>>((acc, credit) => {
    const key = credit.creditType;
    acc[key] = acc[key] ? [...acc[key], credit] : [credit];
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">STEP 2</span>
            <h2 className="mt-3 text-lg font-bold text-slate-900">保有チケット</h2>
          </div>
          <span className="text-xs text-slate-500">現在の残数を確認</span>
        </header>
        <div className="mt-5 space-y-4">
          {Object.entries(grouped).map(([creditType, rows]) => (
            <div key={creditType} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">{CREDIT_LABELS[creditType] ?? creditType}</p>
              <dl className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600">
                {rows.map((row) => (
                  <div key={`${creditType}-${row.bucket}`} className="flex items-baseline justify-between rounded-xl bg-white px-4 py-3">
                    <dt className="text-xs font-semibold text-slate-500">
                      {row.bucket === "CURRENT" ? "今月ご利用可能" : "来月ご利用可能"}
                    </dt>
                    <dd className="text-lg font-bold text-slate-900">{row.remaining} 枠</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-slate-500">消化済み {rows.reduce((sum, row) => sum + row.consumedThisMonth, 0)} 枠</p>
            </div>
          ))}
          {credits.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
              現在ご利用可能なチケットはありません。プランをご購入ください。
            </p>
          )}
        </div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <header className="flex items-center gap-3">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">STEP 3</span>
          <h2 className="text-lg font-bold text-slate-900">ご予約前の注意事項</h2>
        </header>
        <ul className="mt-4 space-y-3 text-xs leading-5 text-slate-600">
          <li>・24日21:00以降に来月の予約枠が公開されます。</li>
          <li>・前日22:00まではマイページからキャンセル可能です。それ以降はチケット消化扱いとなります。</li>
          <li>・月額プランは毎月22日24:00に決済され、来月分の枠が追加されます。</li>
          <li>・特別追加チケットは購入直後から当月の枠としてご利用いただけます。</li>
        </ul>
      </section>
    </div>
  );
}
