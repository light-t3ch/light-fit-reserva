-- Ensure long-running updates do not fail on hosted Postgres (e.g. Supabase)
SET statement_timeout = 0;

-- Add slug to locations for store-level routing
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "slug" TEXT;

UPDATE "Location"
SET "slug" = COALESCE("slug", "id");

ALTER TABLE "Location"
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Location_tenantId_slug_key" ON "Location" ("tenantId", "slug");

-- Allow admin users to pin a managed location
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managedLocationId" TEXT;

-- Track the assigned store for each customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

CREATE INDEX IF NOT EXISTS "Customer_tenantId_locationId_idx" ON "Customer" ("tenantId", "locationId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_managedLocationId_fkey"
  FOREIGN KEY ("managedLocationId") REFERENCES "Location"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

RESET statement_timeout;
