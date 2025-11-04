import { RevenueBreakdown } from "@/components/dashboard/revenue-breakdown";
import { UpcomingBookings } from "@/components/dashboard/upcoming-bookings";

export default function DashboardPage() {
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-900">ダッシュボード</h1>
          <p className="mt-2 text-sm text-slate-600">売上と予約状況をリアルタイムで把握できます。</p>
        </header>
        <RevenueBreakdown />
      </section>
      <aside className="space-y-6">
        <UpcomingBookings />
      </aside>
    </main>
  );
}
