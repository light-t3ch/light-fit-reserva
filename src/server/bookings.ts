import { addMonths, startOfMonth } from "date-fns";

import { prisma } from "@/lib/prisma";
import { generateShiftSlots } from "@/server/bootstrap";

type SupportedCreditBucket = "CURRENT" | "NEXT" | "IMMEDIATE";
type SupportedCreditType = "PT_55" | "PT_25" | "COUNSELING" | "TRIAL_90" | "ENROLLMENT";

export class BookingError extends Error {
  constructor(
    public code: "SLOT_NOT_FOUND" | "SLOT_UNAVAILABLE" | "NO_AVAILABLE_CREDIT" | "CUSTOMER_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

type ParsedSlotId = { trainerId: string; start: Date };

function parseSlotId(slotId: string): ParsedSlotId {
  const separatorIndex = slotId.indexOf("_");
  if (separatorIndex === -1) {
    throw new BookingError("SLOT_NOT_FOUND", "不正な予約枠IDです。");
  }

  const trainerId = slotId.slice(0, separatorIndex);
  const iso = slotId.slice(separatorIndex + 1);
  const start = new Date(iso);

  if (!trainerId || Number.isNaN(start.getTime())) {
    throw new BookingError("SLOT_NOT_FOUND", "予約枠の情報を取得できませんでした。");
  }

  return { trainerId, start };
}

const BOOKED_STATUSES = ["BOOKED", "PENDING_PAYMENT", "CHECKED_IN"] as const;

export type SlotDetail = {
  slotId: string;
  trainerId: string;
  trainerName: string;
  trainerEmail?: string | null;
  locationId: string;
  locationName: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  creditType: SupportedCreditType;
  isBookable: boolean;
  existingBookingId: string | null;
  ownedByCurrentCustomer: boolean;
};

export async function getSlotDetail(
  tenantId: string,
  slotId: string,
  options?: { customerUserId?: string },
): Promise<SlotDetail | null> {
  const { trainerId, start } = parseSlotId(slotId);

  const shift = await prisma.trainerShift.findFirst({
    where: {
      tenantId,
      trainerId,
      startsAt: { lte: start },
      endsAt: { gt: start },
    },
    include: {
      trainer: { select: { id: true, name: true, email: true } },
      location: { select: { id: true, name: true } },
    },
  });

  if (!shift) {
    return null;
  }

  const slots = generateShiftSlots(shift.startsAt, shift.endsAt);
  const slot = slots.find((candidate) => Math.abs(candidate.start.getTime() - start.getTime()) < 1000);

  if (!slot) {
    return null;
  }

  let currentCustomerId: string | null = null;

  if (options?.customerUserId) {
    const customer = await prisma.customer.findFirst({
      where: { tenantId, userId: options.customerUserId },
      select: { id: true },
    });

    currentCustomerId = customer?.id ?? null;
  }

  const existingBooking = await prisma.booking.findFirst({
    where: {
      tenantId,
      trainerId,
      startsAt: slot.start,
      status: { in: [...BOOKED_STATUSES] },
    },
    select: { id: true, customerId: true },
  });

  const ownedByCurrentCustomer = Boolean(
    existingBooking && currentCustomerId && existingBooking.customerId === currentCustomerId,
  );

  return {
    slotId,
    trainerId: shift.trainer.id,
    trainerName: shift.trainer.name ?? "トレーナー",
    trainerEmail: shift.trainer.email,
    locationId: shift.location.id,
    locationName: shift.location.name,
    start: slot.start,
    end: slot.end,
    durationMinutes: slot.duration,
    creditType: slot.creditType,
    isBookable: !existingBooking || ownedByCurrentCustomer,
    existingBookingId: existingBooking?.id ?? null,
    ownedByCurrentCustomer,
  };
}

type CreditCandidate = {
  bucket: SupportedCreditBucket;
  planPurchaseId: string | null;
  remaining: number;
};

function determineBucketPriority(start: Date): SupportedCreditBucket[] {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const nextMonthStart = startOfMonth(addMonths(currentMonthStart, 1));
  const slotMonthStart = startOfMonth(start);

  if (slotMonthStart.getTime() === currentMonthStart.getTime()) {
    return ["CURRENT", "IMMEDIATE", "NEXT"];
  }

  if (slotMonthStart.getTime() === nextMonthStart.getTime()) {
    return ["NEXT", "CURRENT", "IMMEDIATE"];
  }

  return ["IMMEDIATE", "CURRENT", "NEXT"];
}

async function findCustomer(userId: string) {
  return prisma.customer.findFirst({
    where: { userId },
    select: { id: true, tenantId: true },
  });
}

async function resolveCredit(
  customerId: string,
  tenantId: string,
  creditType: SupportedCreditType,
  slotStart: Date,
): Promise<CreditCandidate | null> {
  const creditGroups = await prisma.creditLedgerEntry.groupBy({
    by: ["bucket", "creditType", "planPurchaseId"],
    where: {
      tenantId,
      customerId,
      creditType,
    },
    _sum: { quantity: true },
    orderBy: { bucket: "asc" },
  });

  const priorities = determineBucketPriority(slotStart);

  const candidates = creditGroups
    .map((group) => ({
      bucket: group.bucket as CreditCandidate["bucket"],
      planPurchaseId: group.planPurchaseId,
      remaining: group._sum.quantity ?? 0,
    }))
    .filter((group) => group.remaining > 0);

  for (const bucket of priorities) {
    const match = candidates.find((candidate) => candidate.bucket === bucket);
    if (match) {
      return match;
    }
  }

  return candidates[0] ?? null;
}

export async function createBookingFromSlot(options: { slotId: string; userId: string }) {
  const customer = await findCustomer(options.userId);

  if (!customer) {
    throw new BookingError("CUSTOMER_NOT_FOUND", "お客様情報が見つかりませんでした。");
  }

  const slotDetail = await getSlotDetail(customer.tenantId, options.slotId, {
    customerUserId: options.userId,
  });

  if (!slotDetail) {
    throw new BookingError("SLOT_NOT_FOUND", "予約枠を取得できませんでした。");
  }

  const existingBookingForCustomer = await prisma.booking.findFirst({
    where: {
      tenantId: customer.tenantId,
      trainerId: slotDetail.trainerId,
      customerId: customer.id,
      startsAt: slotDetail.start,
      status: { in: [...BOOKED_STATUSES] },
    },
  });

  if (existingBookingForCustomer) {
    return existingBookingForCustomer;
  }

  if (!slotDetail.isBookable) {
    throw new BookingError("SLOT_UNAVAILABLE", "選択した枠はすでに予約済みです。");
  }

  const credit = await resolveCredit(customer.id, customer.tenantId, slotDetail.creditType, slotDetail.start);

  if (!credit) {
    throw new BookingError("NO_AVAILABLE_CREDIT", "利用可能なチケットがありません。");
  }

  const booking = await prisma.$transaction(async (tx) => {
    const overlapping = await tx.booking.findFirst({
      where: {
        tenantId: customer.tenantId,
        trainerId: slotDetail.trainerId,
        startsAt: slotDetail.start,
        status: { in: [...BOOKED_STATUSES] },
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new BookingError("SLOT_UNAVAILABLE", "選択した枠は既に確保されています。");
    }

    const createdBooking = await tx.booking.create({
      data: {
        tenantId: customer.tenantId,
        customerId: customer.id,
        locationId: slotDetail.locationId,
        trainerId: slotDetail.trainerId,
        planPurchaseId: credit.planPurchaseId ?? undefined,
        creditType: slotDetail.creditType,
        startsAt: slotDetail.start,
        endsAt: slotDetail.end,
        status: "BOOKED",
        allowTrainerChoice: true,
      },
    });

    await tx.creditLedgerEntry.create({
      data: {
        tenantId: customer.tenantId,
        customerId: customer.id,
        planPurchaseId: credit.planPurchaseId ?? undefined,
        bookingId: createdBooking.id,
        bucket: credit.bucket,
        creditType: slotDetail.creditType,
        quantity: -1,
        eventType: "BOOKING_CONSUME",
        occurredAt: new Date(),
        memo: "オンライン予約",
      },
    });

    return createdBooking;
  });

  return booking;
}
