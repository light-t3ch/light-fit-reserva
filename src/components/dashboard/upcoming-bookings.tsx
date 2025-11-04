import { getUpcomingBookings } from "@/server/metrics";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export async function UpcomingBookings() {
  const bookings = await getUpcomingBookings("demo-tenant");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">本日の予約</h2>
      <ul className="mt-4 space-y-3">
        {bookings.map((booking) => (
          <li key={booking.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{booking.customerName}</p>
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">{booking.status}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {format(new Date(booking.start), "M/d (EEE) HH:mm", { locale: ja })}・{booking.locationName}
            </p>
            <p className="mt-1 text-xs text-slate-500">担当: {booking.trainerName}</p>
            <p className="mt-2 text-sm font-medium text-slate-700">{booking.menu}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
