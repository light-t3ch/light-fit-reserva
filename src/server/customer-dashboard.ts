import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  getCustomerCancellationWindows,
  isCustomerCancellableStatus,
} from "@/server/bookings";

export type CustomerUpcomingSession = {
  id: string;
  trainerName: string;
  locationName: string;
  menu: string;
  start: string;
  status: "BOOKED" | "PENDING" | "COMPLETED" | "CANCELLED";
  canCancel: boolean;
  refundEligible: boolean;
  cancellationDeadline: string;
  refundDeadline: string;
};

const UPCOMING_STATUSES = ["BOOKED", "PENDING_PAYMENT"] as const;

export async function getCustomerUpcomingSessions(
  userId: string,
): Promise<CustomerUpcomingSession[]> {
  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, tenantId: true },
  });

  if (!customer) {
    return [];
  }

  const bookings = await prisma.booking.findMany({
    where: {
      customerId: customer.id,
      tenantId: customer.tenantId,
      status: { in: [...UPCOMING_STATUSES] },
      startsAt: {
        gte: new Date(),
      },
    },
    include: {
      trainer: { select: { name: true } },
      location: { select: { name: true } },
      planPurchase: {
        select: {
          plan: { select: { name: true, sessionCategory: true } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 6,
  });

  return bookings.map((booking) => ({
    id: booking.id,
    trainerName: booking.trainer?.name ?? "指名なし",
    locationName: booking.location?.name ?? "店舗未設定",
    menu:
      booking.planPurchase?.plan?.name ??
      (booking.creditType === "PT_55"
        ? "55分パーソナルトレーニング"
        : booking.creditType === "PT_25"
          ? "25分パーソナルトレーニング"
          : "予約"),
    start: booking.startsAt.toISOString(),
    status: booking.status === "PENDING_PAYMENT" ? "PENDING" : "BOOKED",
    ...(() => {
      const { cancelUntil, refundUntil } = getCustomerCancellationWindows(booking.startsAt);
      const now = new Date();
      const canCancel =
        isCustomerCancellableStatus(booking.status) && now <= cancelUntil;
      const refundEligible = now < refundUntil;

      return {
        canCancel,
        refundEligible,
        cancellationDeadline: cancelUntil.toISOString(),
        refundDeadline: refundUntil.toISOString(),
      };
    })(),
  }));
}
