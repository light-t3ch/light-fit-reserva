import { Suspense } from "react";
import { BookingCalendar } from "@/components/booking/calendar";
import { BookingSummary } from "@/components/booking/summary";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function BookingPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const tenantId = session.user.tenantId ?? "demo-tenant";
  const userId = session.user.id ?? "demo-user";

  return (
    <main className="min-h-screen bg-slate-50 pb-16 pt-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Light Fit Reserva</p>
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">ご予約手続き</h1>
          <p className="text-sm text-slate-600 md:text-base">
            下記のステップに沿ってトレーナー・メニュー・日時をお選びください。予約内容は最後に確認できます。
          </p>
        </header>
        <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
          <section className="space-y-6">
            <Suspense fallback={<div className="rounded-3xl bg-white p-8 shadow-sm">読み込み中...</div>}>
              <BookingCalendar tenantId={tenantId} />
            </Suspense>
          </section>
          <aside className="space-y-6">
            <Suspense fallback={<div className="rounded-3xl bg-white p-6 shadow-sm">読み込み中...</div>}>
              <BookingSummary userId={userId} />
            </Suspense>
          </aside>
        </div>
      </div>
    </main>
  );
}
