import { addDays, addMinutes, addMonths, endOfMonth, set, startOfDay, startOfMonth } from "date-fns";

import { prisma } from "@/lib/prisma";

const TRAINER_SEEDS = [
  {
    email: "taro.yamada@example.com",
    name: "山田 太郎",
    locationName: "阿波座店",
    bio: "肩こり解消とボディメイクを得意とするトレーナー。",
  },
  {
    email: "hanako.sato@example.com",
    name: "佐藤 花子",
    locationName: "本町店",
    bio: "女性向けの姿勢改善とコンディショニングを担当。",
  },
];

const LOCATION_SEEDS = [
  { name: "阿波座店", timezone: "Asia/Tokyo", address: "大阪市西区阿波座" },
  { name: "本町店", timezone: "Asia/Tokyo", address: "大阪市中央区本町" },
];

const PLAN_SEEDS = [
  {
    slug: "pt-55-monthly-4",
    name: "55分 × 4回 / 月",
    category: "SUBSCRIPTION" as const,
    sessionCategory: "PT_55" as const,
    durationMinutes: 55,
    billingCadence: "MONTHLY" as const,
    baseCredits: 4,
    stripePriceId: "price_pt55_monthly4",
    allocations: [
      { bucket: "CURRENT" as const, creditType: "PT_55" as const, quantity: 4 },
      { bucket: "NEXT" as const, creditType: "PT_55" as const, quantity: 4, effectiveDay: 22 },
    ],
  },
  {
    slug: "pt-25-monthly-4",
    name: "25分 × 4回 / 月",
    category: "SUBSCRIPTION" as const,
    sessionCategory: "PT_25" as const,
    durationMinutes: 25,
    billingCadence: "MONTHLY" as const,
    baseCredits: 4,
    stripePriceId: "price_pt25_monthly4",
    allocations: [
      { bucket: "CURRENT" as const, creditType: "PT_25" as const, quantity: 4 },
      { bucket: "NEXT" as const, creditType: "PT_25" as const, quantity: 4, effectiveDay: 22 },
    ],
  },
  {
    slug: "counseling-once",
    name: "無料カウンセリング35分 × 1回",
    category: "TRIAL" as const,
    sessionCategory: "COUNSELING" as const,
    durationMinutes: 35,
    billingCadence: "ONE_TIME" as const,
    baseCredits: 1,
    stripePriceId: "price_counseling_once",
    allocations: [{ bucket: "IMMEDIATE" as const, creditType: "COUNSELING" as const, quantity: 1 }],
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
  const locations = await ensureLocations(tenantId);
  const trainers = await ensureTrainers(tenantId, locations);
  await ensurePlans(tenantId);
  await ensureShifts(tenantId, trainers, locations);
  const { customer } = await ensureDemoCustomer(tenantId);
  await ensureDemoPurchasesAndBookings(tenantId, customer.id, trainers, locations);
}

async function ensureLocations(tenantId: string) {
  const existing = await prisma.location.findMany({ where: { tenantId } });
  if (existing.length >= LOCATION_SEEDS.length) {
    return existing.reduce<Record<string, typeof existing[number]>>((acc, loc) => {
      acc[loc.name] = loc;
      return acc;
    }, {});
  }

  const created = await Promise.all(
    LOCATION_SEEDS.filter((seed) => !existing.find((loc) => loc.name === seed.name)).map((seed) =>
      prisma.location.create({
        data: {
          tenantId,
          name: seed.name,
          timezone: seed.timezone,
          address: seed.address,
        },
      }),
    ),
  );

  return [...existing, ...created].reduce<Record<string, typeof existing[number]>>((acc, loc) => {
    acc[loc.name] = loc;
    return acc;
  }, {});
}

async function ensureTrainers(
  tenantId: string,
  locations: Record<string, { id: string }>,
) {
  const trainers: Record<string, Awaited<ReturnType<typeof prisma.trainer.findFirst>>> = {};

  for (const seed of TRAINER_SEEDS) {
    let trainer = await prisma.trainer.findFirst({
      where: {
        tenantId,
        email: seed.email,
      },
    });

    if (!trainer) {
      trainer = await prisma.trainer.create({
        data: {
          tenantId,
          name: seed.name,
          email: seed.email,
          bio: seed.bio,
          locationId: locations[seed.locationName]?.id,
        },
      });
    }

    trainers[seed.email] = trainer;
  }

  return trainers as Record<string, NonNullable<typeof trainers[string]>>;
}

async function ensurePlans(tenantId: string) {
  for (const seed of PLAN_SEEDS) {
    const existing = await prisma.plan.findUnique({ where: { slug: seed.slug } });
    if (existing) {
      if (!existing.tenantId) {
        await prisma.plan.update({ where: { id: existing.id }, data: { tenantId } });
      }
      continue;
    }

    await prisma.plan.create({
      data: {
        tenantId,
        name: seed.name,
        slug: seed.slug,
        description: seed.name,
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
    });
  }
}

async function ensureShifts(
  tenantId: string,
  trainers: Record<string, { id: string; locationId: string | null }>,
  locations: Record<string, { id: string }>,
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
      locationName: "阿波座店",
      start: buildShiftTime(1, 9),
      end: buildShiftTime(1, 14),
    },
    {
      trainerEmail: "hanako.sato@example.com",
      locationName: "本町店",
      start: buildShiftTime(1, 12),
      end: buildShiftTime(1, 18),
    },
    {
      trainerEmail: "taro.yamada@example.com",
      locationName: "阿波座店",
      start: buildShiftTime(2, 10),
      end: buildShiftTime(2, 15),
    },
  ];

  await prisma.trainerShift.createMany({
    data: shiftSeeds.map((seed) => ({
      tenantId,
      trainerId: trainers[seed.trainerEmail]?.id ?? Object.values(trainers)[0].id,
      locationId: locations[seed.locationName]?.id ?? Object.values(locations)[0].id,
      startsAt: seed.start,
      endsAt: seed.end,
      capacity: 1,
    })),
  });
}

async function ensureDemoCustomer(tenantId: string) {
  const customerEmail = process.env.DEMO_CUSTOMER_EMAIL ?? "customer@example.com";
  const firstName = process.env.DEMO_CUSTOMER_FIRST_NAME ?? "太郎";
  const lastName = process.env.DEMO_CUSTOMER_LAST_NAME ?? "予約";

  let user = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: customerEmail,
        name: `${lastName} ${firstName}`,
        role: "CUSTOMER",
        tenantId,
      },
    });
  } else if (user.tenantId !== tenantId || user.role !== "CUSTOMER") {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        tenantId,
        role: "CUSTOMER",
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
    },
    create: {
      tenantId,
      userId: user.id,
      firstName,
      lastName,
      email: customerEmail,
    },
  });

  return { user, customer };
}

async function ensureDemoPurchasesAndBookings(
  tenantId: string,
  customerId: string,
  trainers: Record<string, { id: string }>,
  locations: Record<string, { id: string }>,
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
    },
    {
      planSlug: "pt-25-monthly-4",
      amount: 26400,
    },
  ];

  const purchases = [] as { planSlug: string; purchaseId: string }[];

  for (const seed of subscriptionSeeds) {
    const plan = planMap[seed.planSlug];
    if (!plan) continue;

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
    }

    purchases.push({ planSlug: seed.planSlug, purchaseId: purchase.id });
  }

  const bookingSeeds = [
    {
      planSlug: "pt-55-monthly-4",
      trainerEmail: "taro.yamada@example.com",
      locationName: "阿波座店",
      start: buildShiftTime(1, 10),
      duration: 55,
      creditType: "PT_55" as const,
    },
    {
      planSlug: "pt-25-monthly-4",
      trainerEmail: "hanako.sato@example.com",
      locationName: "本町店",
      start: buildShiftTime(3, 14),
      duration: 25,
      creditType: "PT_25" as const,
    },
  ];

  const bookings = [] as { id: string; planSlug: string; creditType: "PT_55" | "PT_25" }[];

  for (const seed of bookingSeeds) {
    const purchase = purchases.find((p) => p.planSlug === seed.planSlug);
    if (!purchase) continue;

    const existing = await prisma.booking.findFirst({
      where: {
        tenantId,
        customerId,
        startsAt: seed.start,
      },
    });

    if (existing) {
      bookings.push({ id: existing.id, planSlug: seed.planSlug, creditType: seed.creditType });
      continue;
    }

    const booking = await prisma.booking.create({
      data: {
        tenantId,
        customerId,
        locationId: locations[seed.locationName]?.id ?? Object.values(locations)[0].id,
        trainerId: trainers[seed.trainerEmail]?.id,
        planPurchaseId: purchase.purchaseId,
        creditType: seed.creditType,
        startsAt: seed.start,
        endsAt: addMinutes(seed.start, seed.duration),
        status: "BOOKED",
        allowTrainerChoice: true,
      },
    });

    bookings.push({ id: booking.id, planSlug: seed.planSlug, creditType: seed.creditType });
  }

  await ensureLedgerEntries(tenantId, customerId, purchases, bookings, currentPeriodStart);
}

async function ensureLedgerEntries(
  tenantId: string,
  customerId: string,
  purchases: { planSlug: string; purchaseId: string }[],
  bookings: { id: string; planSlug: string; creditType: "PT_55" | "PT_25" }[],
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

  const entries = [] as Parameters<typeof prisma.creditLedgerEntry.createMany>[0]["data"];

  for (const purchase of purchases) {
    const planSlug = purchase.planSlug;
    const is55 = planSlug === "pt-55-monthly-4";
    const creditType = is55 ? "PT_55" : "PT_25";
    const allocationQuantity = is55 ? 4 : 4;

    entries.push({
      tenantId,
      customerId,
      planPurchaseId: purchase.purchaseId,
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
      bucket: "NEXT",
      creditType,
      quantity: allocationQuantity,
      eventType: "PURCHASE_ALLOCATION",
      occurredAt: nextMonthStart,
      memo: "来月分クレジット予約",
    });
  }

  for (const booking of bookings) {
    entries.push({
      tenantId,
      customerId,
      planPurchaseId: purchases.find((p) => p.planSlug === booking.planSlug)?.purchaseId,
      bookingId: booking.id,
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
