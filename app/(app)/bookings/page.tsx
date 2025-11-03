import { Suspense } from "react";
import { BookingCalendar } from "@/components/booking/calendar";
import { BookingSummary } from "@/components/booking/summary";

export default function BookingPage() {
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">予約を作成</h1>
          <p className="mt-2 text-sm text-slate-600">
            保有クレジットを確認しながら、希望のトレーナーとメニューを選択してください。
          </p>
        </header>
        <Suspense fallback={<div className="rounded-xl bg-white p-8 shadow">読み込み中...</div>}>
          <BookingCalendar />
        </Suspense>
      </section>
      <aside className="space-y-6">
        <Suspense fallback={<div className="rounded-xl bg-white p-6 shadow">読み込み中...</div>}>
          <BookingSummary />
        </Suspense>
      </aside>
    </main>
  );
}
