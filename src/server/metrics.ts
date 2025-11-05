import { endOfDay, startOfDay, startOfMonth, subMonths } from "date-fns";

import { prisma } from "@/lib/prisma";
import type { BookingStatus as PrismaBookingStatus } from "@prisma/client";

export type RevenueItem = {
  label: string;
  amount: number;
  deltaPercentage: number;
};

export type UpcomingBooking = {
  id: string;
  customerName: string;
  trainerName: string;
  locationName: string;
  menu: string;
  start: string;
  status: "BOOKED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED";
};

function extractAmount(metadata: unknown): number {
  if (typeof metadata !== "object" || metadata === null) {
    return 0;
  }
  if ("amount" in metadata) {
    const value = Number((metadata as { amount?: unknown }).amount);
    return Number.isFinite(value) ? value : 0;
  }
  return 0;
}

function calculateDelta(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
}

export async function getRevenueBreakdown(
  tenantId: string,
  options?: { locationId?: string },
): Promise<RevenueItem[]> {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const previousMonthStart = subMonths(currentMonthStart, 1);
  const purchases = await prisma.planPurchase.findMany({
    where: {
      tenantId,
      ...(options?.locationId ? { customer: { locationId: options.locationId } } : {}),
      OR: [
        { currentPeriodStart: { gte: previousMonthStart } },
        { createdAt: { gte: previousMonthStart } },
      ],
    },
    include: {
      plan: { select: { category: true } },
    },
  });

  const aggregate = purchases.reduce(
    (acc, purchase) => {
      const amount = extractAmount(purchase.metadata ?? undefined);
      const periodStart = purchase.currentPeriodStart ?? purchase.createdAt;
      const isCurrentMonth = periodStart >= currentMonthStart;
      const isPreviousMonth = periodStart >= previousMonthStart && periodStart < currentMonthStart;

      if (isCurrentMonth) {
        acc.current.total += amount;
        if (purchase.plan?.category === "SUBSCRIPTION") {
          acc.current.subscription += amount;
        } else {
          acc.current.other += amount;
        }
      }

      if (isPreviousMonth) {
        acc.previous.total += amount;
        if (purchase.plan?.category === "SUBSCRIPTION") {
          acc.previous.subscription += amount;
        } else {
          acc.previous.other += amount;
        }
      }

      return acc;
    },
    {
      current: { total: 0, subscription: 0, other: 0 },
      previous: { total: 0, subscription: 0, other: 0 },
    },
  );

  return [
    {
      label: "今月の売上",
      amount: aggregate.current.total,
      deltaPercentage: calculateDelta(aggregate.current.total, aggregate.previous.total),
    },
    {
      label: "サブスク",
      amount: aggregate.current.subscription,
      deltaPercentage: calculateDelta(
        aggregate.current.subscription,
        aggregate.previous.subscription,
      ),
    },
    {
      label: "都度利用",
      amount: aggregate.current.other,
      deltaPercentage: calculateDelta(aggregate.current.other, aggregate.previous.other),
    },
  ];
}

function isUpcomingBookingStatus(
  status: PrismaBookingStatus,
): status is UpcomingBooking["status"] {
  return (
    status === "BOOKED" ||
    status === "CHECKED_IN" ||
    status === "COMPLETED" ||
    status === "CANCELLED"
  );
}

export async function getUpcomingBookings(
  tenantId: string,
  options?: { locationId?: string },
): Promise<UpcomingBooking[]> {
  const start = startOfDay(new Date());
  const end = endOfDay(new Date());

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      ...(options?.locationId ? { locationId: options.locationId } : {}),
      status: { in: ["BOOKED", "CHECKED_IN"] },
      startsAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      trainer: { select: { name: true } },
      location: { select: { name: true } },
      planPurchase: {
        select: {
          plan: { select: { name: true } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return bookings.map((booking) => {
    const customerName = [booking.customer?.lastName, booking.customer?.firstName]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .join(" ") || "顧客";

    const fallbackMenu =
      booking.creditType === "PT_55"
        ? "55分パーソナルトレーニング"
        : booking.creditType === "PT_25"
          ? "25分パーソナルトレーニング"
          : "セッション";

    return {
      id: booking.id,
      customerName,
      trainerName: booking.trainer?.name ?? "指名なし",
      locationName: booking.location?.name ?? "店舗未設定",
      menu: booking.planPurchase?.plan?.name ?? fallbackMenu,
      start: booking.startsAt.toISOString(),
      status: isUpcomingBookingStatus(booking.status) ? booking.status : "BOOKED",
    } satisfies UpcomingBooking;
  });
}
