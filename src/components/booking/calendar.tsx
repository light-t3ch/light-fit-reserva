import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

import { getTenantAvailability } from "@/server/availability";

function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${format(start, "M/d (EEE) HH:mm", { locale: ja })} - ${format(end, "HH:mm", { locale: ja })}`;
}

type BookingCalendarProps = {
  tenantId?: string;
  basePath?: string;
};

function normalizeBasePath(basePath?: string) {
  if (!basePath) return "/bookings";
  if (!basePath.startsWith("/")) {
    return `/${basePath}`;
  }
  return basePath.replace(/\/$/, "");
}

export async function BookingCalendar({ tenantId, basePath }: BookingCalendarProps = {}) {
  const availability = await getTenantAvailability(tenantId ?? "demo-tenant");
  const normalizedBasePath = normalizeBasePath(basePath);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">STEP 1</span>
            <h2 className="mt-3 text-xl font-bold text-slate-900">トレーナーと店舗を選ぶ</h2>
            <p className="mt-1 text-sm text-slate-600">
              ご希望のトレーナー・店舗をお選びください。空き枠は下のリストから選択できます。
            </p>
          </div>
          <p className="text-xs font-medium text-slate-500">
            予約可能枠: {availability.reduce((count, trainer) => count + trainer.slots.filter((slot) => slot.isBookable).length, 0)} 件
          </p>
        </header>
      </section>
      {availability.map((trainer) => (
        <article
          key={trainer.trainerId}
          className="rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex flex-col gap-6 border-b border-slate-100 px-8 pb-6 pt-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">{trainer.locationName}</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">{trainer.trainerName}</h3>
              <p className="mt-1 text-sm text-slate-600">パーソナルトレーナー</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full bg-slate-100 px-4 py-1 font-medium">
                予約可能 {trainer.slots.filter((slot) => slot.isBookable).length}件
              </span>
              <span className="hidden md:inline">/</span>
              <span className="rounded-full bg-white px-4 py-1 font-medium text-slate-400 md:bg-slate-50">
                全{trainer.slots.length}枠
              </span>
            </div>
          </div>
          <div className="space-y-1 px-4 py-4">
            {trainer.slots.map((slot) =>
              slot.isBookable ? (
                <Link
                  key={slot.slotId}
                  href={`${normalizedBasePath}/confirm?slot=${encodeURIComponent(slot.slotId)}`}
                  className="flex w-full flex-col items-start gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-slate-900 transition hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
                      {slot.durationMinutes === 55 ? "55分" : "25分"}
                    </span>
                    <span className="text-sm font-medium">{formatTimeRange(slot.start, slot.end)}</span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {slot.bookingType}
                    </span>
                  </div>
                  <p className="text-xs text-brand-600">この枠を予約する</p>
                </Link>
              ) : (
                <div
                  key={slot.slotId}
                  className="flex w-full flex-col items-start gap-1 rounded-2xl border border-dashed border-slate-200 bg-slate-100 px-4 py-4 text-left text-slate-400"
                  aria-disabled
                >
                  <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
                      {slot.durationMinutes === 55 ? "55分" : "25分"}
                    </span>
                    <span className="text-sm font-medium">{formatTimeRange(slot.start, slot.end)}</span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {slot.bookingType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">この枠は満席です</p>
                </div>
              ),
            )}
          </div>
        </article>
      ))}
      <section className="rounded-3xl border border-dashed border-brand-200 bg-brand-50/50 p-6 text-sm text-brand-700">
        次の画面でお客様情報と決済方法をご確認いただきます。ご希望の日時を選択後、「予約内容の確認」に進んでください。
      </section>
    </div>
  );
}
