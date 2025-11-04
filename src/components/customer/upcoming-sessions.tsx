import { format } from "date-fns";
import { ja } from "date-fns/locale";

import { getCustomerUpcomingSessions } from "@/server/customer-dashboard";

export async function CustomerUpcomingSessions({
  userId,
}: {
  userId: string;
}) {
  const sessions = await getCustomerUpcomingSessions(userId);

  if (sessions.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        <p>現在予約済みのセッションはありません。新しい予約を作成するとこちらに表示されます。</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">これからの予約</h2>
      <ul className="mt-4 space-y-3">
        {sessions.map((session) => (
          <li key={session.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{session.menu}</p>
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">{session.status}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {format(new Date(session.start), "M/d (EEE) HH:mm", { locale: ja })}・{session.locationName}
            </p>
            <p className="mt-1 text-xs text-slate-500">担当トレーナー: {session.trainerName}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
