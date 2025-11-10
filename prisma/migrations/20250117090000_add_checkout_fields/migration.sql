ALTER TABLE "PlanPurchase"
  ADD COLUMN "stripeCheckoutSessionId" TEXT,
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "stripeInvoiceId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PlanPurchase_stripeCheckoutSessionId_key"
  ON "PlanPurchase"("stripeCheckoutSessionId")
  WHERE "stripeCheckoutSessionId" IS NOT NULL;
