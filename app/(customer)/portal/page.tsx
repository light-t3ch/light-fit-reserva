import Link from "next/link";

import { BookingSummary } from "@/components/booking/summary";
import { CustomerUpcomingSessions } from "@/components/customer/upcoming-sessions";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: {
    cancelled?: string;
    cancel_error?: string;
  };
};

function buildAlert(searchParams?: PageProps["searchParams"]) {
  const successKey = typeof searchParams?.cancelled === "string" ? searchParams.cancelled : undefined;
  if (successKey) {
    if (successKey === "refunded") {
      return {
        tone: "success" as const,
        message: "予約をキャンセルし、チケットをお戻ししました。",
      };
    }

    if (successKey === "consumed") {
      return {
        tone: "warning" as const,
        message: "予約をキャンセルしましたが、前日22:00以降のためチケットは消化扱いとなります。",
      };
    }
  }

  const errorKey = typeof searchParams?.cancel_error === "string" ? searchParams.cancel_error : undefined;
  if (errorKey) {
    const messages: Record<string, string> = {
      missing: "キャンセル対象の予約が選択されていません。",
      not_found: "該当する予約が見つかりませんでした。",
      not_cancellable: "この予約はオンラインでキャンセルできません。",
      window_closed: "キャンセル期限を過ぎています。店舗までお問い合わせください。",
      no_customer: "お客様情報を確認できませんでした。再度ログインしてください。",
      unknown: "キャンセル処理で問題が発生しました。時間をおいて再度お試しください。",
      slot_missing: "予約情報を取得できませんでした。",
      slot_unavailable: "すでに処理済みの予約です。",
      no_credit: "チケット情報を確認できませんでした。",
      location_mismatch: "ご契約店舗以外の予約は処理できません。",
    };

    return {
      tone: "error" as const,
      message: messages[errorKey] ?? messages.unknown,
    };
  }

  return null;
}

export default async function CustomerPortalPage({ searchParams }: PageProps) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  if (session.user.role !== "CUSTOMER") {
    redirect("/dashboard");
  }

  const userId = session.user.id ?? "demo-user";

  const alert = buildAlert(searchParams);

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          {alert && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                alert.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : alert.tone === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-red-200 bg-red-50 text-red-600"
              }`}
            >
              {alert.message}
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-500">Customer Portal</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">ようこそ、{session.user.name ?? "お客様"}さん</h1>
          <p className="mt-3 text-sm text-slate-600">
            現在のチケット残数とご予約状況をご確認いただけます。すぐに予約したい場合は、以下のボタンから予約画面へお進みください。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/portal/bookings"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              予約画面へ進む
            </Link>
          </div>
        </header>
        <BookingSummary userId={userId} />
      </section>
      <aside className="space-y-6">
        <CustomerUpcomingSessions userId={userId} />
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">予約に関するお問い合わせ</h2>
          <p className="mt-2">
            予約内容の変更やキャンセル、追加購入についてご不明点があれば、店舗スタッフまでお気軽にご相談ください。
          </p>
        </section>
      </aside>
    </main>
  );
}
