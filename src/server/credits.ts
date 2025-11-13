import { addMonths, endOfMonth, startOfMonth } from "date-fns";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CreditBucket = "CURRENT" | "NEXT";

export type CreditSummary = {
  bucket: CreditBucket;
  creditType: "PT_55" | "PT_25" | "COUNSELING" | "TRIAL_90" | "ENROLLMENT";
  remaining: number;
  consumedThisMonth: number;
  rolloverEligible: boolean;
};

export async function getCustomerCreditSummary(
  userId: string,
  options?: { locationId?: string | null },
): Promise<CreditSummary[]> {
  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, tenantId: true, locationId: true },
  });

  if (!customer) {
    return [];
  }

  const targetLocationId = options?.locationId ?? customer.locationId;

  if (!targetLocationId) {
    return [];
  }

  await expireStaleCreditsForCustomer({
    tenantId: customer.tenantId,
    customerId: customer.id,
    locationId: targetLocationId,
  });

  const entries = await prisma.creditLedgerEntry.findMany({
    where: {
      customerId: customer.id,
      tenantId: customer.tenantId,
      locationId: targetLocationId,
    },
    orderBy: { occurredAt: "asc" },
  });

  if (entries.length === 0) {
    return [];
  }

  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  const summaries = new Map<string, CreditSummary>();

  for (const entry of entries) {
    const bucket = entry.bucket === "IMMEDIATE" ? "CURRENT" : (entry.bucket as CreditBucket);
    const key = `${bucket}_${entry.creditType}`;
    const baseSummary = summaries.get(key) ?? {
      bucket,
      creditType: entry.creditType as CreditSummary["creditType"],
      remaining: 0,
      consumedThisMonth: 0,
      rolloverEligible: bucket === "NEXT",
    };

    baseSummary.remaining += entry.quantity;

    if (
      entry.eventType === "BOOKING_CONSUME" &&
      entry.occurredAt >= currentMonthStart &&
      entry.occurredAt <= currentMonthEnd
    ) {
      baseSummary.consumedThisMonth += Math.abs(entry.quantity);
    }

    summaries.set(key, baseSummary);
  }

  return Array.from(summaries.values()).sort((a, b) => {
    if (a.creditType === b.creditType) {
      return a.bucket.localeCompare(b.bucket);
    }
    return a.creditType.localeCompare(b.creditType);
  });
}

type ExpirationOptions = {
  tenantId: string;
  customerId: string;
  locationId: string;
  asOf?: Date;
  tx?: Prisma.TransactionClient;
};

export async function expireStaleCreditsForCustomer(options: ExpirationOptions) {
  const { tenantId, customerId, locationId } = options;
  const client = options.tx ?? prisma;
  const asOf = options.asOf ?? new Date();
  const currentMonthStart = startOfMonth(asOf);

  const nextMonthStart = startOfMonth(addMonths(currentMonthStart, 1));

  const adjustments: Prisma.CreditLedgerEntryCreateManyInput[] = [];

  type LedgerBucket = NonNullable<Prisma.CreditLedgerEntryCreateManyInput["bucket"]>;

  const LEGACY_NEXT_EXPIRATION_MEMO = "前月分の来月枠を失効";
  const ROLLOVER_MEMO = "来月枠の繰上げ";

  const expirationSources: {
    source: LedgerBucket;
    target: CreditBucket;
    memo: string;
  }[] = [
    { source: "CURRENT", target: "CURRENT", memo: "前月残り枠の失効" },
    { source: "IMMEDIATE", target: "CURRENT", memo: "前月残り枠の失効" },
  ];

  for (const config of expirationSources) {
    const groups = await client.creditLedgerEntry.groupBy({
      by: ["creditType"],
      where: {
        tenantId,
        customerId,
        locationId,
        bucket: config.source,
        occurredAt: { lt: currentMonthStart },
      },
      _sum: { quantity: true },
    });

    if (groups.length === 0) {
      continue;
    }

    const existingAdjustments = await client.creditLedgerEntry.groupBy({
      by: ["creditType"],
      where: {
        tenantId,
        customerId,
        locationId,
        bucket: config.target,
        eventType: "EXPIRATION",
        memo: config.memo,
        occurredAt: currentMonthStart,
      },
      _sum: { quantity: true },
    });

    const expiredMap = new Map<string, number>();
    for (const entry of existingAdjustments) {
      const alreadyExpired = Math.abs(entry._sum.quantity ?? 0);
      if (alreadyExpired > 0) {
        expiredMap.set(entry.creditType, alreadyExpired);
      }
    }

    for (const group of groups) {
      const total = group._sum.quantity ?? 0;
      if (total <= 0) {
        continue;
      }

      const alreadyExpired = expiredMap.get(group.creditType) ?? 0;
      const remainingToExpire = total - alreadyExpired;

      if (remainingToExpire <= 0) {
        continue;
      }

      adjustments.push({
        tenantId,
        customerId,
        locationId,
        planPurchaseId: null,
        bookingId: null,
        bucket: config.target,
        creditType: group.creditType,
        quantity: -remainingToExpire,
        eventType: "EXPIRATION",
        occurredAt: currentMonthStart,
        memo: config.memo,
      });

      expiredMap.set(group.creditType, alreadyExpired + remainingToExpire);
    }
  }

  // 旧ロジックで NEXT バケットに作成された失効レコードを繰り上げ扱いへ変換する
  await client.creditLedgerEntry.updateMany({
    where: {
      tenantId,
      customerId,
      locationId,
      bucket: "NEXT",
      eventType: "EXPIRATION",
      memo: LEGACY_NEXT_EXPIRATION_MEMO,
    },
    data: { eventType: "ROLLOVER", memo: ROLLOVER_MEMO },
  });

  const maturedNextCredits = await client.creditLedgerEntry.groupBy({
    by: ["creditType"],
    where: {
      tenantId,
      customerId,
      locationId,
      bucket: "NEXT",
      occurredAt: { lt: nextMonthStart },
    },
    _sum: { quantity: true },
  });

  if (maturedNextCredits.length > 0) {
    const existingRollovers = await client.creditLedgerEntry.groupBy({
      by: ["creditType", "bucket"],
      where: {
        tenantId,
        customerId,
        locationId,
        eventType: "ROLLOVER",
        memo: ROLLOVER_MEMO,
      },
      _sum: { quantity: true },
    });

    const existingMap = new Map<
      string,
      {
        added: number;
        removed: number;
      }
    >();

    for (const record of existingRollovers) {
      const current = existingMap.get(record.creditType) ?? { added: 0, removed: 0 };
      if (record.bucket === "CURRENT") {
        current.added += record._sum.quantity ?? 0;
      }
      if (record.bucket === "NEXT") {
        const quantity = record._sum.quantity ?? 0;
        if (quantity < 0) {
          current.removed += Math.abs(quantity);
        } else {
          current.removed -= quantity;
        }
      }
      existingMap.set(record.creditType, current);
    }

    for (const group of maturedNextCredits) {
      const total = Math.max(group._sum.quantity ?? 0, 0);
      if (total <= 0) {
        continue;
      }

      const existing = existingMap.get(group.creditType) ?? { added: 0, removed: 0 };

      const removalDelta = total - existing.removed;
      const additionDelta = total - existing.added;

      if (removalDelta !== 0) {
        adjustments.push({
          tenantId,
          customerId,
          locationId,
          planPurchaseId: null,
          bookingId: null,
          bucket: "NEXT",
          creditType: group.creditType,
          quantity: removalDelta > 0 ? -removalDelta : Math.abs(removalDelta),
          eventType: "ROLLOVER",
          occurredAt: currentMonthStart,
          memo: ROLLOVER_MEMO,
        });
      }

      if (additionDelta !== 0) {
        adjustments.push({
          tenantId,
          customerId,
          locationId,
          planPurchaseId: null,
          bookingId: null,
          bucket: "CURRENT",
          creditType: group.creditType,
          quantity: additionDelta,
          eventType: "ROLLOVER",
          occurredAt: currentMonthStart,
          memo: ROLLOVER_MEMO,
        });
      }
    }
  }

  if (adjustments.length > 0) {
    await client.creditLedgerEntry.createMany({ data: adjustments });
  }
}
