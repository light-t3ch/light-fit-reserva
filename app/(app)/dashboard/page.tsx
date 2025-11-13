import { RevenueBreakdown } from "@/components/dashboard/revenue-breakdown";
import { UpcomingBookings } from "@/components/dashboard/upcoming-bookings";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const tenantId = session.user.tenantId ?? "demo-tenant";
  const locationId = session.user.locationId ?? null;
  const locationName = session.user.locationName ?? "店舗未設定";

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-900">ダッシュボード</h1>
          <p className="mt-2 text-sm text-slate-600">
            {locationName} の売上と予約状況をリアルタイムで把握できます。
          </p>
        </header>
        <RevenueBreakdown tenantId={tenantId} locationId={locationId} />
      </section>
      <aside className="space-y-6">
        <UpcomingBookings tenantId={tenantId} locationId={locationId} />
      </aside>
    </main>
  );
}
