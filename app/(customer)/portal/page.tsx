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
        <header>
          <h1 className="text-3xl font-semibold text-slate-900">ようこそ、{session.user.name ?? "お客様"}さん</h1>
          <p className="mt-2 text-sm text-slate-600">
            保有しているクレジットとルールを確認し、必要に応じて管理画面または店舗にご連絡ください。
          </p>
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
