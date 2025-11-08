-- Add location scoping to plan purchases and credit ledger entries
ALTER TABLE "PlanPurchase" ADD COLUMN "locationId" TEXT;
ALTER TABLE "CreditLedgerEntry" ADD COLUMN "locationId" TEXT;

-- Populate PlanPurchase.locationId from customer or related booking
UPDATE "PlanPurchase" AS pp
SET "locationId" = c."locationId"
FROM "Customer" AS c
WHERE c."id" = pp."customerId"
  AND c."locationId" IS NOT NULL
  AND pp."locationId" IS NULL;

-- Fallback: if still NULL, use the location from an associated booking
UPDATE "PlanPurchase" AS pp
SET "locationId" = b."locationId"
FROM "Booking" AS b
WHERE b."planPurchaseId" = pp."id"
  AND pp."locationId" IS NULL;

-- Final fallback: choose the first location for the tenant when none could be resolved
WITH first_locations AS (
  SELECT DISTINCT ON ("tenantId") "tenantId", "id"
  FROM "Location"
  ORDER BY "tenantId", "createdAt"
)
UPDATE "PlanPurchase" AS pp
SET "locationId" = fl."id"
FROM first_locations AS fl
WHERE pp."locationId" IS NULL
  AND fl."tenantId" = pp."tenantId";

UPDATE "CreditLedgerEntry" AS cle
SET "locationId" = COALESCE(
    (SELECT b."locationId" FROM "Booking" AS b WHERE b."id" = cle."bookingId"),
    (SELECT pp."locationId" FROM "PlanPurchase" AS pp WHERE pp."id" = cle."planPurchaseId"),
    (SELECT c."locationId" FROM "Customer" AS c WHERE c."id" = cle."customerId")
  )
WHERE cle."locationId" IS NULL;

-- Final fallback for credit ledger entries without a resolved location
WITH first_locations AS (
  SELECT DISTINCT ON ("tenantId") "tenantId", "id"
  FROM "Location"
  ORDER BY "tenantId", "createdAt"
)
UPDATE "CreditLedgerEntry" AS cle
SET "locationId" = fl."id"
FROM first_locations AS fl
WHERE cle."locationId" IS NULL
  AND fl."tenantId" = cle."tenantId";

-- Enforce NOT NULL and add foreign keys
ALTER TABLE "PlanPurchase"
  ALTER COLUMN "locationId" SET NOT NULL,
  ADD CONSTRAINT "PlanPurchase_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditLedgerEntry"
  ALTER COLUMN "locationId" SET NOT NULL,
  ADD CONSTRAINT "CreditLedgerEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace indexes to account for location scoping
DROP INDEX IF EXISTS "PlanPurchase_tenantId_customerId_idx";
CREATE INDEX "PlanPurchase_tenantId_locationId_customerId_idx" ON "PlanPurchase"("tenantId", "locationId", "customerId");

DROP INDEX IF EXISTS "CreditLedgerEntry_tenantId_customerId_occurredAt_idx";
CREATE INDEX "CreditLedgerEntry_tenantId_customerId_locationId_occurredAt_idx" ON "CreditLedgerEntry"("tenantId", "customerId", "locationId", "occurredAt");
