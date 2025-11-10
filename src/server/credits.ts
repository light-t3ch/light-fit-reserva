import { endOfMonth, startOfMonth } from "date-fns";

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

  const adjustments: Prisma.CreditLedgerEntryCreateManyInput[] = [];

  const expirationSources: { source: Prisma.CreditBucket; target: CreditBucket; memo: string }[] = [
    { source: "CURRENT", target: "CURRENT", memo: "前月残り枠の失効" },
    { source: "IMMEDIATE", target: "CURRENT", memo: "前月残り枠の失効" },
    { source: "NEXT", target: "NEXT", memo: "前月分の来月枠を失効" },
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

    for (const group of groups) {
      const total = group._sum.quantity ?? 0;
      if (total > 0) {
        adjustments.push({
          tenantId,
          customerId,
          locationId,
          planPurchaseId: null,
          bookingId: null,
          bucket: config.target,
          creditType: group.creditType,
          quantity: -total,
          eventType: "EXPIRATION",
          occurredAt: currentMonthStart,
          memo: config.memo,
        });
      }
    }
  }

  if (adjustments.length > 0) {
    await client.creditLedgerEntry.createMany({ data: adjustments });
  }
}
