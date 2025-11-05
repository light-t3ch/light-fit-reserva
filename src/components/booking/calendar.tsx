import { BookingCalendarFlow } from "./calendar-flow";

import { getTenantAvailability } from "@/server/availability";

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

  if (availability.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        現在表示できる予約枠がありません。しばらく時間を置いてから再度ご確認ください。
      </div>
    );
  }

  return <BookingCalendarFlow availability={availability} basePath={normalizedBasePath} />;
}
