import { getCustomerCreditSummary } from "@/server/credits";

const CREDIT_LABELS: Record<string, string> = {
  PT_55: "55分パーソナルトレーニング",
  PT_25: "25分パーソナルトレーニング",
  COUNSELING: "無料カウンセリング",
  TRIAL: "体験トレーニング",
};

export async function BookingSummary({ userId }: { userId?: string } = {}) {
  const credits = await getCustomerCreditSummary(userId ?? "demo-user");

  const grouped = credits.reduce<Record<string, typeof credits[number][]>>((acc, credit) => {
    const key = credit.creditType;
    acc[key] = acc[key] ? [...acc[key], credit] : [credit];
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">保有クレジット</h2>
        <div className="mt-4 space-y-3">
          {Object.entries(grouped).map(([creditType, rows]) => (
            <div key={creditType} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">{CREDIT_LABELS[creditType] ?? creditType}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                {rows.map((row) => (
                  <div key={`${creditType}-${row.bucket}`} className="rounded-lg bg-white p-3 shadow-inner">
                    <dt className="font-semibold text-slate-500">{row.bucket === "CURRENT" ? "今月の枠" : "来月の枠"}</dt>
                    <dd className="mt-1 text-lg font-bold text-slate-900">{row.remaining} 枠</dd>
                    <p className="mt-1 text-[11px] text-slate-500">消化済み: {row.consumedThisMonth} 枠</p>
                    {!row.rolloverEligible && (
                      <p className="mt-1 text-[11px] text-rose-500">翌月繰越不可</p>
                    )}
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">プランポリシー</h2>
        <ul className="mt-3 space-y-2 text-xs text-slate-600">
          <li>・24日21:00以降に来月の予約が解放されます。</li>
          <li>・前日22:00以降のキャンセルは消化扱いとなります。</li>
          <li>・22日24:00以降のサブスク課金は来月枠に加算されます。</li>
          <li>・「特別追加1回」プランのみ当月枠へ即時加算されます。</li>
        </ul>
      </section>
    </div>
  );
}
