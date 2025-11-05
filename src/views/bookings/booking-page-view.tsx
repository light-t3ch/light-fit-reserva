import { Suspense } from "react";
import { redirect } from "next/navigation";

import { BookingCalendar } from "@/components/booking/calendar";
import { BookingSummary } from "@/components/booking/summary";
import { getServerAuthSession } from "@/lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  slot_missing: "予約枠が見つかりませんでした。別の枠をお試しください。",
  slot_unavailable: "選択した枠は満席となりました。別の時間をお選びください。",
  no_credit: "利用可能なチケットが残っていません。プランをご確認ください。",
  no_customer: "お客様情報を取得できませんでした。サポートへご連絡ください。",
  unknown: "エラーが発生しました。時間をおいて再度お試しください。",
};

type BookingPageViewProps = {
  searchParams?: { error?: string };
  basePath: string;
};

function normalizeBasePath(basePath: string) {
  if (!basePath.startsWith("/")) {
    return `/${basePath}`;
  }
  return basePath.replace(/\/$/, "");
}

export async function BookingPageView({ searchParams, basePath }: BookingPageViewProps) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const tenantId = session.user.tenantId ?? "demo-tenant";
  const userId = session.user.id ?? "demo-user";

  const errorKey = typeof searchParams?.error === "string" ? searchParams.error : undefined;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown : null;

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
        {errorMessage && (
          <p className="mx-auto w-full max-w-2xl rounded-2xl border border-dashed border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
          <section className="space-y-6">
            <Suspense fallback={<div className="rounded-3xl bg-white p-8 shadow-sm">読み込み中...</div>}>
              <BookingCalendar tenantId={tenantId} basePath={normalizedBasePath} />
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
