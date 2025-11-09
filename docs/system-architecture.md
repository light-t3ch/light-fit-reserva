# Light Fit Reserva Architecture Plan

## 1. Overview
Light Fit Reserva is a multi-tenant reservation and billing platform for personal training gyms. The system is implemented with **Next.js** for the web application, **Supabase Postgres** as the primary data store, **Prisma** as the ORM, **NextAuth** for authentication, and **Stripe** for payment processing. The architecture must support multiple gym branches (tenants), trainer scheduling, plan-based booking limits, and automated subscription billing tied to reservation credits.

## 2. Tenancy Model
- Each gym branch is a tenant. All data tables include a `tenant_id` foreign key to enforce data isolation.
- Users can belong to multiple tenants with distinct roles (e.g., `CUSTOMER`, `TRAINER`, `ADMIN`).
- NextAuth sessions include the active `tenant_id` and user role. Switching tenants requires explicit user action (or invitation acceptance).

### Key Tables
| Table | Purpose |
|-------|---------|
| `Tenant` | Gym branch metadata and onboarding configuration. |
| `TenantSettings` | Stripe price IDs, booking policies, and plan availability per tenant. |
| `TenantInvite` | Invitation tokens for staff and customers to join a branch. |
| `UserTenantRole` | Mapping between Supabase auth user IDs and tenant roles. |

## 3. Core Domain Tables
| Table | Purpose |
|-------|---------|
| `UserProfile` | Personal details linked to Supabase auth user. |
| `TrainerProfile` | Trainer biography, specialties, and shift color-coding. |
| `PlanCatalog` | Master catalog of plans (55m/25m variants, trial, add-ons, etc.) with metadata about duration, recurrence, and Stripe product/price IDs. |
| `TenantPlanAvailability` | Enables/disables specific catalog plans per tenant and sets tenant-specific prices (e.g., enrollment fee). |
| `Subscription` | Active plan purchases for a user within a tenant. Stores Stripe subscription ID, status, billing cycle anchor, and credit allocation rules. |
| `CreditLedger` | Tracks monthly booking credits (`credit_month`, `credit_type`, `total`, `remaining`). Separate rows for "current" and "next" month buckets. |
| `CreditAdjustment` | Auditable record of how credits are granted or consumed (purchases, bookings, cancellations). |
| `Booking` | Reservation instances linking users, trainers, plan type, time slot, and status. |
| `TrainerShift` | Monthly schedule entries per trainer for admin planning. |
| `BookingLock` | Stores datetime ranges when booking is disabled (per tenant or per trainer). |
| `RevenueReport` | Materialized view or aggregated table for sales analytics. |

## 4. Credit Lifecycle
### Initial Purchase
1. User purchases a plan (one-time or subscription) via Stripe checkout.
2. Stripe webhook hits the `/api/stripe/webhook` endpoint.
3. Server validates event, persists `Subscription` (if recurring) or `OneTimePurchase`, and calls `CreditAllocator` service.
4. `CreditAllocator` inspects purchase date and plan rules:
   - If purchase occurs **on/after the 22nd at 00:00**, add credits to the **next month bucket**, except for "special add-one" SKUs that target current month.
   - Otherwise, add credits to the **current month bucket**.
   - Plans with monthly recurrence create or update the `Subscription` record, and schedule the initial billing for the upcoming 22nd at 24:00 using Stripe trial periods.
5. `CreditLedger` row is created/updated with `total` and `remaining` counts.
6. `CreditAdjustment` records the allocation with metadata (plan ID, Stripe event ID).

### Monthly Rollover
- A scheduled job (Supabase cron or Vercel cron) runs at **00:00 on the 1st** of each month per tenant.
- The job copies `next_month` ledger totals into the `current_month` slot, resets the `next_month` bucket to zero, and expires unused `current_month` credits (no carryover).

### Subscription Renewal
- All subscription products use Stripe trial periods ending at **22nd 24:00** of the purchase month. Stripe automatically invoices at that time.
- The webhook `invoice.paid` triggers credit allocation for the next month following the same rules as initial purchase.

### Booking Consumption
- Booking UI checks available credits using `CreditLedger` filtered by `credit_month` (current or next) depending on booking date.
- Credits are decremented when a booking is confirmed, with `CreditAdjustment` capturing the consumption.
- Cancelling a booking **before 22:00 on the previous day** restores the credit (if allowed). Cancellations after 22:00 or no-shows leave the credit consumed.

## 5. Booking Window Rules
- System time zone: JST.
- On the **24th at 21:00**, booking for the upcoming month opens. The frontend allows navigation to next-month calendar days once this threshold is passed.
- When booking a session dated in the current month, deduct from `current_month` bucket. Future month bookings deduct from `next_month` bucket.
- The admin can override by closing specific date-times via `BookingLock` entries.

## 6. Frontend Application Structure
```
app/
  (marketing)
  dashboard/
    layout.tsx         // Authenticated layout
    bookings/
      page.tsx         // Customer booking calendar
      components/
        BookingCalendar.tsx
        TrainerSelector.tsx
        PlanMenu.tsx
    admin/
      page.tsx         // Admin overview
      trainers/
        shifts/page.tsx
      reports/
        revenue/page.tsx
      customers/page.tsx
  api/
    auth/[...nextauth]/route.ts
    stripe/webhook/route.ts
    bookings/route.ts
    credits/route.ts
```
- **State Management:** React Query for server-side mutations and caching, Zustand or Context for small UI state (trainer selection, calendar view).
- **UI Components:** Build booking calendar inspired by https://edisone.jp/lightfit-awaza. Use Tailwind CSS for rapid styling.

## 7. Authentication & Authorization
- NextAuth with Supabase adapter for user storage.
- Providers: email magic links (customers) and Google/Apple OAuth (trainers/admins optional).
- Session callback adds `tenantRoles` array. Middleware enforces tenant selection.
- Role-based access control using helper `assertRole(user, tenantId, role)` inside server actions/API routes.

## 8. Stripe Integration Strategy
- Use Stripe Checkout for initial plan purchases (one-time or subscription) to capture payment method.
- Subscription products configure with 0-priced immediate billing and trial until the 22nd 24:00 of the cycle. Implementation steps:
  1. Compute `trial_end` in Unix epoch when creating the subscription (align to next 22nd 24:00 in JST).
  2. For purchases on/after the 22nd, set trial end to the **22nd of the following month**.
- For one-time add-on credits (special current-month extra), create one-time Prices in Stripe and mark plan type as `ONE_TIME`.
- Webhook events handled: `checkout.session.completed`, `customer.subscription.updated`, `invoice.paid`, `payment_intent.succeeded`.
- Map Stripe price IDs to `PlanCatalog` entries via metadata.
- Persist processed event IDs in `StripeEventLog` to guarantee idempotent webhook handling.

## 9. Scheduling & Shifts
- Admin UI allows monthly schedule input per trainer. Use a grid with days vs. time slots, supporting copy/paste of weekly templates.
- Shifts stored as `TrainerShift` rows with start/end times. Bookings must align with available shifts.
- Validate on booking: ensure trainer shift exists and time slot is free.
- Provide admin export (CSV) of monthly shifts for offline reference.

## 10. Reporting & Analytics
- Maintain daily revenue snapshots by aggregating `CreditAdjustment` (purchase) entries and Stripe fee metadata.
- Provide admin dashboard metrics: MRR, ARR, total bookings, cancellations, trainer utilization.
- Supabase SQL views materialize metrics for efficient retrieval.

## 11. Notifications & Reminders
- Integrate Supabase Edge Functions or external service (Resend) to send:
  - Booking confirmations and reminders (24h prior, skip if booking <24h away).
  - Cancellation notifications to trainers.
  - Low-credit alerts to customers.

## 12. Tech Ops
- Deploy Next.js on Vercel; Supabase hosts Postgres and auth.
- Use Supabase cron for monthly credit rollover and daily cleanup.
- Environment configuration stored via Vercel env variables and Supabase secrets.
- Logging with Vercel OG + Supabase logs; critical events forwarded to Slack via webhook.

## 13. Next Steps
1. Scaffold Next.js 14 app with the App Router and configure TypeScript, ESLint, Prettier, Tailwind, and Prisma.
2. Define Prisma schema for core tables (tenants, users, plans, subscriptions, credits, bookings, shifts).
3. Integrate NextAuth with Supabase adapter and tenant session handling.
4. Implement Stripe checkout flow and webhooks.
5. Build customer booking calendar honoring credit rules and booking windows.
6. Implement admin dashboards (shifts, revenue, customers, daily bookings, booking closures).
7. Add automated tests for credit allocation, booking validation, and cancellation policies.
8. Configure cron jobs for credit rollover and sendgrid/resend for notifications.

