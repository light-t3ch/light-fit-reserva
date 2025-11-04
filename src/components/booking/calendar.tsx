import { getTenantAvailability } from "@/server/availability";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${format(start, "M/d (EEE) HH:mm", { locale: ja })} - ${format(end, "HH:mm", { locale: ja })}`;
}

export async function BookingCalendar({ tenantId }: { tenantId?: string } = {}) {
  const availability = await getTenantAvailability(tenantId ?? "demo-tenant");

  return (
    <div className="space-y-6">
      {availability.map((trainer) => (
        <article key={trainer.trainerId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-brand-600">{trainer.locationName}</p>
              <h2 className="text-xl font-semibold text-slate-900">{trainer.trainerName}</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              予約可能枠 {trainer.slots.filter((slot) => slot.isBookable).length} / {trainer.slots.length}
            </span>
          </header>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trainer.slots.map((slot) => (
              <button
                key={slot.slotId}
                type="button"
                className={`flex flex-col rounded-xl border px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                  slot.isBookable
                    ? "border-brand-200 bg-white text-slate-900 hover:border-brand-400 hover:bg-brand-50"
                    : "border-slate-200 bg-slate-100 text-slate-400"
                }`}
                disabled={!slot.isBookable}
              >
                <span className="font-semibold">{slot.durationMinutes === 55 ? "55分" : "25分"}</span>
                <span className="mt-1 text-xs text-slate-500">{formatTimeRange(slot.start, slot.end)}</span>
                <span className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {slot.bookingType}
                </span>
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
