# Light Fit Reserva

Multi-tenant reservation and billing platform for personal training gyms. See [`docs/system-architecture.md`](docs/system-architecture.md) for the high-level architecture and implementation plan.

## Tech Stack
- Next.js 14 (App Router)
- Prisma ORM with Supabase Postgres
- Stripe Checkout & Subscriptions
- NextAuth for authentication

## Getting Started (planned)
1. Initialize the Next.js app with `npx create-next-app@latest`.
2. Configure Supabase project and set the database URL in `.env` for Prisma.
3. Run `npx prisma db push` after defining the schema.
4. Implement authentication, Stripe checkout, and booking features as described in the architecture document.

