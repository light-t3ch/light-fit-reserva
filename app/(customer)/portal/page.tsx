import Link from "next/link";

import { BookingSummary } from "@/components/booking/summary";
import { CustomerUpcomingSessions } from "@/components/customer/upcoming-sessions";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CustomerPortalPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  if (session.user.role !== "CUSTOMER") {
    redirect("/dashboard");
  }

  const userId = session.user.id ?? "demo-user";

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
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
            <Link
              href="/bookings"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-500"
            >
              管理者の代理予約画面を見る
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
