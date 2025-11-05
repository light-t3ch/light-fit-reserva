-- Add demoBootstrappedAt column to mark when demo data seeding completed
ALTER TABLE "Tenant"
ADD COLUMN     "demoBootstrappedAt" TIMESTAMP(3);
