import { addDays, formatISO } from "date-fns";

import { prisma } from "@/lib/prisma";
import { generateShiftSlots } from "@/server/bootstrap";

export type TrainerAvailabilitySlot = {
  slotId: string;
  start: string;
  end: string;
  durationMinutes: number;
  isBookable: boolean;
  bookingType: "PT_55" | "PT_25" | "COUNSELING" | "TRIAL_90" | "ENROLLMENT";
};

export type TrainerAvailability = {
  trainerId: string;
  trainerName: string;
  locationName: string;
  slots: TrainerAvailabilitySlot[];
};

const BOOKED_STATUSES = ["BOOKED", "PENDING_PAYMENT", "CHECKED_IN"] as const;

function overlaps(
  slotStart: Date,
  slotEnd: Date,
  booking: { startsAt: Date; endsAt: Date },
) {
  return slotStart < booking.endsAt && slotEnd > booking.startsAt;
}

export async function getTenantAvailability(
  tenantId: string,
  options?: { locationId?: string },
): Promise<TrainerAvailability[]> {
  const now = new Date();
  const shifts = await prisma.trainerShift.findMany({
    where: {
      tenantId,
      ...(options?.locationId ? { locationId: options.locationId } : {}),
      endsAt: {
        gte: now,
      },
      startsAt: {
        lte: addDays(now, 7),
      },
    },
    include: {
      trainer: {
        select: { id: true, name: true },
      },
      location: {
        select: { id: true, name: true },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 12,
  });

  if (shifts.length === 0) {
    return [];
  }

  const trainerIds = Array.from(new Set(shifts.map((shift) => shift.trainerId)));
  const shiftWindowEnd = shifts.reduce(
    (latest, shift) => (shift.endsAt > latest ? shift.endsAt : latest),
    shifts[0].endsAt,
  );

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      trainerId: { in: trainerIds },
      status: { in: [...BOOKED_STATUSES] },
      startsAt: {
        gte: now,
        lte: shiftWindowEnd,
      },
    },
    select: {
      id: true,
      trainerId: true,
      startsAt: true,
      endsAt: true,
    },
  });

  type BookingForShift = (typeof bookings)[number];

  const bookingsByTrainer = bookings.reduce<Record<string, BookingForShift[]>>((acc, booking) => {
    if (!booking.trainerId) {
      return acc;
    }
    const list = acc[booking.trainerId] ?? [];
    list.push(booking);
    acc[booking.trainerId] = list;
    return acc;
  }, {});

  return shifts.map((shift) => {
    const trainerBookings = bookingsByTrainer[shift.trainerId] ?? [];
    const slots = generateShiftSlots(shift.startsAt, shift.endsAt)
      .filter((slot) => slot.end > now)
      .map((slot) => {
        const isBookable = trainerBookings.every((booking) => !overlaps(slot.start, slot.end, booking));

        return {
          slotId: `${shift.trainerId}_${formatISO(slot.start)}`,
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          durationMinutes: slot.duration,
          bookingType: slot.creditType,
          isBookable,
        } satisfies TrainerAvailabilitySlot;
      });

    return {
      trainerId: shift.trainer.id,
      trainerName: shift.trainer.name,
      locationName: shift.location.name,
      slots,
    } satisfies TrainerAvailability;
  });
}
