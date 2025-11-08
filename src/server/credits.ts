import { endOfMonth, startOfMonth } from "date-fns";

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
    const key = `${entry.bucket}_${entry.creditType}`;
    const baseSummary = summaries.get(key) ?? {
      bucket: entry.bucket as CreditBucket,
      creditType: entry.creditType as CreditSummary["creditType"],
      remaining: 0,
      consumedThisMonth: 0,
      rolloverEligible: entry.bucket === "NEXT",
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
