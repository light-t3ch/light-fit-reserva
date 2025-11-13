import { format } from "date-fns";
import { ja } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CompletePageProps = {
  searchParams?: {
    bookingId?: string;
  };
  basePath: string;
};

const MENU_LABELS: Record<string, string> = {
  PT_55: "55分パーソナルトレーニング",
  PT_25: "25分パーソナルトレーニング",
  TRIAL: "体験トレーニング",
  TRIAL_90: "体験トレーニング90分",
  COUNSELING: "無料カウンセリング",
  ENROLLMENT: "入会手続き",
};

function normalizeBasePath(basePath: string) {
  if (!basePath.startsWith("/")) {
    return `/${basePath}`;
  }
  return basePath.replace(/\/$/, "");
}

export async function BookingCompletePageView({ searchParams, basePath }: CompletePageProps) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const bookingId = typeof searchParams?.bookingId === "string" ? searchParams.bookingId : null;

  if (!bookingId) {
    redirect(normalizedBasePath);
  }

  const userId = session.user.id;

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, tenantId: true },
  });

  if (!customer) {
    redirect(normalizedBasePath);
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      tenantId: customer.tenantId,
      customerId: customer.id,
    },
    include: {
      trainer: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  if (!booking) {
    redirect(normalizedBasePath);
  }

  const formattedDate = format(booking.startsAt, "M月d日(EEE) HH:mm", { locale: ja });
  const formattedEnd = format(booking.endsAt, "HH:mm", { locale: ja });
  const label = MENU_LABELS[booking.creditType] ?? "ご予約";

  const isCustomerFlow = normalizedBasePath === "/portal/bookings";
  const homeHref = isCustomerFlow ? "/portal" : "/dashboard";
  const homeLabel = isCustomerFlow ? "マイページで予約を確認する" : "ダッシュボードで予約を確認する";
  const continueLabel = isCustomerFlow ? "続けて別の枠を探す" : "別のお客様を予約する";

  return (
    <main className="min-h-screen bg-slate-50 pb-16 pt-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 text-center">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">Reservation Complete</p>
          <h1 className="text-3xl font-bold text-slate-900">ご予約が完了しました</h1>
          <p className="text-sm text-slate-600">
            予約内容はマイページ「ご予約一覧」からいつでも確認できます。メールでも内容をお送りしました。
          </p>
        </div>
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-left shadow-sm">
          <dl className="space-y-4 text-sm text-slate-700">
            <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <dt className="font-semibold text-slate-500">日時</dt>
              <dd className="text-lg font-bold text-slate-900">
                {formattedDate} 〜 {formattedEnd}
              </dd>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <dt className="font-semibold text-slate-500">メニュー</dt>
              <dd className="text-base font-semibold">{label}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <dt className="font-semibold text-slate-500">担当トレーナー</dt>
              <dd className="text-base font-semibold">{booking.trainer?.name ?? "指名なし"}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <dt className="font-semibold text-slate-500">店舗</dt>
              <dd className="text-base font-semibold">{booking.location?.name ?? "店舗未設定"}</dd>
            </div>
          </dl>
        </section>
        <div className="flex flex-col gap-3 text-sm text-slate-600">
          <Link
            href={homeHref}
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-white transition hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {homeLabel}
          </Link>
          <Link
            href={normalizedBasePath}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-slate-700 transition hover:border-brand-400 hover:text-brand-500"
          >
            {continueLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
