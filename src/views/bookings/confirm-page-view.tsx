import { format } from "date-fns";
import { ja } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { getSlotDetail } from "@/server/bookings";

import { confirmBookingAction } from "@/app/(app)/bookings/confirm/actions";

type ConfirmPageProps = {
  searchParams?: {
    slot?: string;
    error?: string;
  };
  basePath: string;
};

const CREDIT_LABELS: Record<string, string> = {
  PT_55: "55分パーソナル",
  PT_25: "25分パーソナル",
  TRIAL: "体験トレーニング",
  TRIAL_90: "体験トレーニング90分",
  COUNSELING: "カウンセリング",
  ENROLLMENT: "入会手続き",
};

const ERROR_MESSAGES: Record<string, string> = {
  slot_missing: "予約枠を取得できませんでした。もう一度お試しください。",
  slot_unavailable: "申し訳ございません。こちらの枠はすでに満席です。",
  no_credit: "該当メニューに利用できるチケットが残っていません。",
  no_customer: "お客様情報が見つかりませんでした。サポートへご連絡ください。",
  unknown: "処理中にエラーが発生しました。時間をおいて再度お試しください。",
};

function normalizeBasePath(basePath: string) {
  if (!basePath.startsWith("/")) {
    return `/${basePath}`;
  }
  return basePath.replace(/\/$/, "");
}

export async function ConfirmBookingPageView({ searchParams, basePath }: ConfirmPageProps) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const slotId = typeof searchParams?.slot === "string" ? searchParams.slot : null;

  if (!slotId) {
    redirect(normalizedBasePath);
  }

  const tenantId = session.user.tenantId ?? "demo-tenant";
  const slot = await getSlotDetail(tenantId, slotId, {
    customerUserId: session.user.id,
  });

  if (!slot) {
    redirect(`${normalizedBasePath}?error=slot_missing`);
  }

  if (slot.ownedByCurrentCustomer && slot.existingBookingId) {
    redirect(`${normalizedBasePath}/complete?bookingId=${slot.existingBookingId}`);
  }

  const errorKey = typeof searchParams?.error === "string" ? searchParams.error : undefined;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown : null;

  const startLabel = format(slot.start, "M月d日(EEE) HH:mm", { locale: ja });
  const endLabel = format(slot.end, "HH:mm", { locale: ja });
  const creditLabel = CREDIT_LABELS[slot.creditType] ?? slot.creditType;

  return (
    <main className="min-h-screen bg-slate-50 pb-16 pt-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6">
        <Link href={normalizedBasePath} className="text-sm font-semibold text-brand-600 transition hover:text-brand-500">
          ← 予約枠一覧に戻る
        </Link>
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">STEP 2</p>
            <h1 className="text-2xl font-bold text-slate-900">選択した内容を確認</h1>
            <p className="text-sm text-slate-600">
              下記の内容で予約を確定します。よろしければ「この内容で予約する」を押してください。
            </p>
          </header>
          <dl className="mt-6 space-y-4 text-sm text-slate-700">
            <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <dt className="font-semibold text-slate-500">日時</dt>
              <dd className="text-lg font-bold text-slate-900">
                {startLabel} 〜 {endLabel}
              </dd>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <dt className="font-semibold text-slate-500">メニュー</dt>
              <dd className="text-base font-semibold">{creditLabel}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <dt className="font-semibold text-slate-500">担当トレーナー</dt>
              <dd className="text-base font-semibold">{slot.trainerName}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <dt className="font-semibold text-slate-500">店舗</dt>
              <dd className="text-base font-semibold">{slot.locationName}</dd>
            </div>
          </dl>
          {!slot.isBookable && !slot.ownedByCurrentCustomer && (
            <p className="mt-6 rounded-2xl border border-dashed border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              大変申し訳ございません。こちらの枠はすでにご予約済みです。別の枠をご選択ください。
            </p>
          )}
          {errorMessage && (
            <p className="mt-6 rounded-2xl border border-dashed border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </p>
          )}
          {slot.isBookable && (
            <form action={confirmBookingAction} className="mt-8 space-y-4">
              <input type="hidden" name="slotId" value={slot.slotId} />
              <input type="hidden" name="basePath" value={normalizedBasePath} />
              <button
                type="submit"
                className="w-full rounded-full bg-brand-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                この内容で予約する
              </button>
              <p className="text-xs text-slate-500">
                予約確定後、利用可能チケットから自動的に1枠分が減算されます。前日22時以降のキャンセルは消化扱いとなります。
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
