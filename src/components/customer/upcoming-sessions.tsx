import { format } from "date-fns";
import { ja } from "date-fns/locale";

import { cancelBookingAction } from "../../../app/(customer)/portal/actions";
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
          <li key={session.id} className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{session.menu}</p>
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">{session.status}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700">
                {format(new Date(session.start), "M/d (EEE) HH:mm", { locale: ja })}・{session.locationName}
              </p>
              <p className="mt-1 text-xs text-slate-500">担当トレーナー: {session.trainerName}</p>
            </div>
            {session.canCancel ? (
              <div className="rounded-2xl border border-brand-100 bg-white p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">
                  キャンセル期限: {format(new Date(session.cancellationDeadline), "M/d (EEE) HH:mm", { locale: ja })} まで
                </p>
                <p className="mt-1">
                  {session.refundEligible
                    ? "この時間までにキャンセルするとチケットはお戻しできます。"
                    : "キャンセルは可能ですがチケットは消化扱いとなります。"}
                </p>
                <form action={cancelBookingAction} className="mt-3">
                  <input type="hidden" name="bookingId" value={session.id} />
                  <input type="hidden" name="redirectTo" value="/portal" />
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-brand-600 shadow-sm ring-1 ring-inset ring-brand-200 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    この予約をキャンセルする
                  </button>
                </form>
              </div>
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
                キャンセル期限（{format(new Date(session.cancellationDeadline), "M/d (EEE) HH:mm", { locale: ja })}）を過ぎています。
                変更が必要な場合は店舗までお問い合わせください。
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
