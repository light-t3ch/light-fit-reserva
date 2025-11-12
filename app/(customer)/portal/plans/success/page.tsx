import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { getPlanDefinition } from "@/server/plan-catalog";

export default async function PlanPurchaseSuccessPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  if (session.user.role !== "CUSTOMER") {
    redirect("/dashboard");
  }

  const planSlug = typeof searchParams?.plan === "string" ? searchParams.plan : undefined;
  const definition = planSlug ? getPlanDefinition(planSlug) : undefined;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-sm font-semibold text-emerald-700">
        決済が完了しました
      </div>
      <h1 className="text-3xl font-semibold text-slate-900">ご購入ありがとうございます</h1>
      <p className="max-w-xl text-sm leading-relaxed text-slate-600">
        Stripeでの決済が完了しました。{definition ? `${definition.name}のチケットが` : "チケットが"}付与され、
        数分以内にチケット残数へ反映されます。残数が反映されない場合は店舗スタッフまでお問い合わせください。
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/portal"
          className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          ポータルに戻る
        </Link>
        <Link
          href="/portal/bookings"
          className="inline-flex items-center justify-center rounded-full border border-brand-200 bg-white px-6 py-3 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          予約画面に進む
        </Link>
      </div>
    </main>
  );
}
