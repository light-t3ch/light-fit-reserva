import { addDays, addMinutes, addMonths, endOfMonth, set, startOfDay, startOfMonth } from "date-fns";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { LOCATION_SEEDS } from "@/server/location-seeds";
import { getPlanDefinition, resolvePlanSeeds } from "@/server/plan-catalog";

const PLAN_SEEDS = resolvePlanSeeds();

const TRAINER_SEEDS = [
  {
    email: "taro.yamada@example.com",
    name: "山田 太郎",
    locationSlug: "awaza",
    bio: "肩こり解消とボディメイクを得意とするトレーナー。",
  },
  {
    email: "hanako.sato@example.com",
    name: "佐藤 花子",
    locationSlug: "fukushima",
    bio: "女性向けの姿勢改善とコンディショニングを担当。",
  },
];


const SLOT_PATTERN_MINUTES = [55, 25];

function buildShiftTime(dayOffset: number, hour: number, minute = 0) {
  return set(addDays(new Date(), dayOffset), {
    hours: hour,
    minutes: minute,
    seconds: 0,
    milliseconds: 0,
  });
}

export async function ensureDemoTenantData(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { demoBootstrappedAt: true },
  });

  const locations = await ensureLocations(tenantId);

  if (tenant?.demoBootstrappedAt) {
    return;
  }

  const [trainerCount, planCount, shiftCount, purchaseCount] = await Promise.all([
    prisma.trainer.count({ where: { tenantId } }),
    prisma.plan.count({ where: { tenantId, slug: { in: PLAN_SEEDS.map((plan) => plan.slug) } } }),
    prisma.trainerShift.count({
      where: {
        tenantId,
        startsAt: {
          gte: startOfDay(new Date()),
        },
      },
    }),
    prisma.planPurchase.count({ where: { tenantId } }),
  ]);

  const alreadyBootstrapped =
    trainerCount >= TRAINER_SEEDS.length &&
    planCount >= PLAN_SEEDS.length &&
    shiftCount > 0 &&
    purchaseCount > 0;

  if (alreadyBootstrapped) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { demoBootstrappedAt: new Date() },
    });
    return;
  }

  const trainers = await ensureTrainers(tenantId, locations);
  await ensurePlans(tenantId);
  await ensureShifts(tenantId, trainers, locations);
  const { customer } = await ensureDemoCustomer(tenantId, locations);
  await ensureDemoPurchasesAndBookings(tenantId, customer.id, trainers, locations);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { demoBootstrappedAt: new Date() },
  });
}

type LocationMap = Record<string, { id: string; name: string; slug: string }>;

export async function ensureLocations(tenantId: string): Promise<LocationMap> {
  const existing = await prisma.location.findMany({ where: { tenantId } });

  const bySlug = new Map(existing.map((location) => [location.slug, location] as const));
  const byName = new Map(existing.map((location) => [location.name, location] as const));

  const ensured: LocationMap = {};

  for (const seed of LOCATION_SEEDS) {
    let location = bySlug.get(seed.slug);

    if (location) {
      if (
        location.name !== seed.name ||
        location.timezone !== seed.timezone ||
        location.address !== seed.address
      ) {
        location = await prisma.location.update({
          where: { id: location.id },
          data: { name: seed.name, timezone: seed.timezone, address: seed.address },
        });
      }
    } else {
      const matchByName = byName.get(seed.name);
      if (matchByName) {
        location = await prisma.location.update({
          where: { id: matchByName.id },
          data: { slug: seed.slug, timezone: seed.timezone, address: seed.address },
        });
      } else {
        location = await prisma.location.upsert({
          where: { tenantId_slug: { tenantId, slug: seed.slug } },
          update: { name: seed.name, timezone: seed.timezone, address: seed.address },
          create: {
            tenantId,
            slug: seed.slug,
            name: seed.name,
            timezone: seed.timezone,
            address: seed.address,
          },
        });
      }
    }

    bySlug.set(location.slug, location);
    byName.set(location.name, location);

    ensured[location.slug] = { id: location.id, name: location.name, slug: location.slug };
  }

  return ensured;
}

async function ensureTrainers(tenantId: string, locations: LocationMap) {
  const trainers: Record<string, Awaited<ReturnType<typeof prisma.trainer.findFirst>>> = {};

  for (const seed of TRAINER_SEEDS) {
    let trainer = await prisma.trainer.findFirst({
      where: {
        tenantId,
        email: seed.email,
      },
    });

    const targetLocationId = locations[seed.locationSlug]?.id;

    if (!trainer) {
      trainer = await prisma.trainer.create({
        data: {
          tenantId,
          name: seed.name,
          email: seed.email,
          bio: seed.bio,
          locationId: targetLocationId,
        },
      });
    } else if (targetLocationId && trainer.locationId !== targetLocationId) {
      trainer = await prisma.trainer.update({
        where: { id: trainer.id },
        data: { locationId: targetLocationId },
      });
    }

    trainers[seed.email] = trainer;
  }

  return trainers as Record<string, NonNullable<typeof trainers[string]>>;
}

async function ensurePlans(tenantId: string) {
  for (const seed of PLAN_SEEDS) {
    await prisma.plan.upsert({
      where: { slug: seed.slug },
      create: {
        tenantId,
        name: seed.name,
        slug: seed.slug,
        description: seed.description ?? seed.name,
        category: seed.category,
        sessionCategory: seed.sessionCategory,
        durationMinutes: seed.durationMinutes,
        billingCadence: seed.billingCadence,
        baseCredits: seed.baseCredits,
        stripePriceId: seed.stripePriceId,
        allocations: {
          create: seed.allocations.map((allocation) => ({
            bucket: allocation.bucket,
            creditType: allocation.creditType,
            quantity: allocation.quantity,
            effectiveDay: allocation.effectiveDay,
          })),
        },
      },
      update: {
        tenantId,
        name: seed.name,
        description: seed.description ?? seed.name,
        category: seed.category,
        sessionCategory: seed.sessionCategory,
        durationMinutes: seed.durationMinutes,
        billingCadence: seed.billingCadence,
        baseCredits: seed.baseCredits,
        stripePriceId: seed.stripePriceId,
        allocations: {
          deleteMany: {},
          create: seed.allocations.map((allocation) => ({
            bucket: allocation.bucket,
            creditType: allocation.creditType,
            quantity: allocation.quantity,
            effectiveDay: allocation.effectiveDay,
          })),
        },
      },
    });
  }
}

async function ensureShifts(
  tenantId: string,
  trainers: Record<string, { id: string; locationId: string | null }>,
  locations: LocationMap,
) {
  const today = startOfDay(new Date());
  const existingCount = await prisma.trainerShift.count({
    where: {
      tenantId,
      startsAt: {
        gte: today,
      },
    },
  });

  if (existingCount > 0) {
    return;
  }

  const shiftSeeds = [
    {
      trainerEmail: "taro.yamada@example.com",
      locationSlug: "awaza",
      start: buildShiftTime(1, 9),
      end: buildShiftTime(1, 14),
    },
    {
      trainerEmail: "hanako.sato@example.com",
      locationSlug: "fukushima",
      start: buildShiftTime(1, 12),
      end: buildShiftTime(1, 18),
    },
    {
      trainerEmail: "taro.yamada@example.com",
      locationSlug: "awaza",
      start: buildShiftTime(2, 10),
      end: buildShiftTime(2, 15),
    },
  ];

  await prisma.trainerShift.createMany({
    data: shiftSeeds.map((seed) => ({
      tenantId,
      trainerId: trainers[seed.trainerEmail]?.id ?? Object.values(trainers)[0].id,
      locationId: locations[seed.locationSlug]?.id ?? Object.values(locations)[0]?.id,
      startsAt: seed.start,
      endsAt: seed.end,
      capacity: 1,
    })),
  });
}

async function ensureDemoCustomer(tenantId: string, locations: LocationMap) {
  const customerEmail = process.env.DEMO_CUSTOMER_EMAIL ?? "customer@example.com";
  const firstName = process.env.DEMO_CUSTOMER_FIRST_NAME ?? "太郎";
  const lastName = process.env.DEMO_CUSTOMER_LAST_NAME ?? "予約";
  const defaultLocation = locations["awaza"] ?? Object.values(locations)[0];

  let user = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: customerEmail,
        name: `${lastName} ${firstName}`,
        role: "CUSTOMER",
        tenantId,
        managedLocationId: null,
      },
    });
  } else if (user.tenantId !== tenantId || user.role !== "CUSTOMER") {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        tenantId,
        role: "CUSTOMER",
        managedLocationId: null,
      },
    });
  }

  const customer = await prisma.customer.upsert({
    where: { userId: user.id },
    update: {
      tenantId,
      firstName,
      lastName,
      email: customerEmail,
      locationId: defaultLocation?.id,
    },
    create: {
      tenantId,
      userId: user.id,
      firstName,
      lastName,
      email: customerEmail,
      locationId: defaultLocation?.id,
    },
  });

  return { user, customer };
}

async function ensureDemoPurchasesAndBookings(
  tenantId: string,
  customerId: string,
  trainers: Record<string, { id: string }>,
  locations: LocationMap,
) {
  const plans = await prisma.plan.findMany({
    where: { slug: { in: PLAN_SEEDS.map((p) => p.slug) } },
  });
  const planMap = plans.reduce<Record<string, typeof plans[number]>>((acc, plan) => {
    acc[plan.slug] = plan;
    return acc;
  }, {});

  const now = new Date();
  const currentPeriodStart = startOfMonth(now);
  const currentPeriodEnd = endOfMonth(now);
  const nextBilling = set(addMonths(currentPeriodStart, 1), {
    date: 22,
    hours: 21,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });

  const subscriptionSeeds = [
    {
      planSlug: "pt-55-monthly-4",
      amount: 39600,
      locationSlug: "awaza",
    },
    {
      planSlug: "pt-25-monthly-4",
      amount: 26400,
      locationSlug: "fukushima",
    },
  ];

  const purchases = [] as { planSlug: string; purchaseId: string; locationId: string }[];

  for (const seed of subscriptionSeeds) {
    const plan = planMap[seed.planSlug];
    if (!plan) continue;

    const targetLocationId =
      locations[seed.locationSlug]?.id ?? Object.values(locations)[0]?.id;

    if (!targetLocationId) {
      continue;
    }

    let purchase = await prisma.planPurchase.findFirst({
      where: {
        tenantId,
        customerId,
        planId: plan.id,
        status: "active",
      },
    });

    if (!purchase) {
      purchase = await prisma.planPurchase.create({
        data: {
          tenantId,
          customerId,
          planId: plan.id,
          locationId: targetLocationId,
          billingCadence: plan.billingCadence,
          status: "active",
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingAt: nextBilling,
          stripePriceId: plan.stripePriceId,
          metadata: {
            amount: seed.amount,
            currency: "JPY",
          },
        },
      });
    } else if (purchase.locationId !== targetLocationId) {
      purchase = await prisma.planPurchase.update({
        where: { id: purchase.id },
        data: { locationId: targetLocationId },
      });
    }

    purchases.push({ planSlug: seed.planSlug, purchaseId: purchase.id, locationId: targetLocationId });
  }

  const bookingSeeds = [
    {
      planSlug: "pt-55-monthly-4",
      trainerEmail: "taro.yamada@example.com",
      locationSlug: "awaza",
      start: buildShiftTime(1, 10),
      duration: 55,
      creditType: "PT_55" as const,
    },
    {
      planSlug: "pt-25-monthly-4",
      trainerEmail: "hanako.sato@example.com",
      locationSlug: "fukushima",
      start: buildShiftTime(3, 14),
      duration: 25,
      creditType: "PT_25" as const,
    },
  ];

  const bookings = [] as {
    id: string;
    planSlug: string;
    creditType: "PT_55" | "PT_25";
    locationId: string;
  }[];

  for (const seed of bookingSeeds) {
    const purchase = purchases.find((p) => p.planSlug === seed.planSlug);
    if (!purchase) continue;

    const existing = await prisma.booking.findFirst({
      where: {
        tenantId,
        customerId,
        startsAt: seed.start,
      },
      select: { id: true, locationId: true },
    });

    if (existing) {
      bookings.push({
        id: existing.id,
        planSlug: seed.planSlug,
        creditType: seed.creditType,
        locationId: existing.locationId,
      });
      continue;
    }

    const bookingLocationId =
      locations[seed.locationSlug]?.id ?? Object.values(locations)[0]?.id;

    if (!bookingLocationId) {
      continue;
    }

    const booking = await prisma.booking.create({
      data: {
        tenantId,
        customerId,
        locationId: bookingLocationId,
        trainerId: trainers[seed.trainerEmail]?.id,
        planPurchaseId: purchase.purchaseId,
        creditType: seed.creditType,
        startsAt: seed.start,
        endsAt: addMinutes(seed.start, seed.duration),
        status: "BOOKED",
        allowTrainerChoice: true,
      },
    });

    bookings.push({
      id: booking.id,
      planSlug: seed.planSlug,
      creditType: seed.creditType,
      locationId: bookingLocationId,
    });
  }

  await ensureLedgerEntries(tenantId, customerId, purchases, bookings, currentPeriodStart);
}

async function ensureLedgerEntries(
  tenantId: string,
  customerId: string,
  purchases: { planSlug: string; purchaseId: string; locationId: string }[],
  bookings: { id: string; planSlug: string; creditType: "PT_55" | "PT_25"; locationId: string }[],
  currentPeriodStart: Date,
) {
  const existingCount = await prisma.creditLedgerEntry.count({
    where: {
      tenantId,
      customerId,
      occurredAt: {
        gte: addMonths(currentPeriodStart, -1),
      },
    },
  });

  if (existingCount > 0) {
    return;
  }

  const now = new Date();
  const nextMonthStart = addMonths(currentPeriodStart, 1);

  const entries: Prisma.CreditLedgerEntryCreateManyInput[] = [];

  for (const purchase of purchases) {
    const planSlug = purchase.planSlug;
    const is55 = planSlug === "pt-55-monthly-4";
    const creditType = is55 ? "PT_55" : "PT_25";
    const allocationQuantity = is55 ? 4 : 4;

    entries.push({
      tenantId,
      customerId,
      planPurchaseId: purchase.purchaseId,
      locationId: purchase.locationId,
      bucket: "CURRENT",
      creditType,
      quantity: allocationQuantity,
      eventType: "PURCHASE_ALLOCATION",
      occurredAt: currentPeriodStart,
      memo: "月次クレジット付与",
    });

    entries.push({
      tenantId,
      customerId,
      planPurchaseId: purchase.purchaseId,
      locationId: purchase.locationId,
      bucket: "NEXT",
      creditType,
      quantity: allocationQuantity,
      eventType: "PURCHASE_ALLOCATION",
      occurredAt: nextMonthStart,
      memo: "来月分クレジット予約",
    });
  }

  for (const booking of bookings) {
    const matchedPurchase = purchases.find((p) => p.planSlug === booking.planSlug);
    entries.push({
      tenantId,
      customerId,
      planPurchaseId: matchedPurchase?.purchaseId,
      bookingId: booking.id,
      locationId: booking.locationId,
      bucket: "CURRENT",
      creditType: booking.creditType,
      quantity: -1,
      eventType: "BOOKING_CONSUME",
      occurredAt: now,
      memo: "予約による消化",
    });
  }

  await prisma.creditLedgerEntry.createMany({ data: entries });
}

export function generateShiftSlots(startsAt: Date, endsAt: Date) {
  const slots: { start: Date; end: Date; duration: number; creditType: "PT_55" | "PT_25" }[] = [];
  let cursor = startsAt;
  let patternIndex = 0;

  while (cursor < endsAt) {
    const duration = SLOT_PATTERN_MINUTES[patternIndex % SLOT_PATTERN_MINUTES.length];
    const end = addMinutes(cursor, duration);
    if (end > endsAt) {
      break;
    }

    slots.push({
      start: cursor,
      end,
      duration,
      creditType: duration === 55 ? "PT_55" : "PT_25",
    });

    cursor = end;
    patternIndex += 1;
  }

  return slots;
}
