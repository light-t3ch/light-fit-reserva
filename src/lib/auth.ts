import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { ensureDemoTenantData } from "@/server/bootstrap";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  audience: z.enum(["ADMIN", "CUSTOMER"]).default("ADMIN"),
  locationSlug: z.string().min(1).optional(),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "Demo login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password, audience, locationSlug } = parsed.data;
        const tenantSlug = process.env.APP_TENANT_SLUG ?? "light-fit";
        const tenant = await prisma.tenant.upsert({
          where: { slug: tenantSlug },
          update: {},
          create: {
            slug: tenantSlug,
            name: "Light Fit Reserva",
          },
        });

        if (audience === "ADMIN") {
          const demoEmail = process.env.DEMO_TENANT_EMAIL ?? "tenant-admin@example.com";
          const demoPassword = process.env.DEMO_TENANT_PASSWORD ?? "change-me";

          if (email !== demoEmail || password !== demoPassword) {
            return null;
          }

          let user = await prisma.user.upsert({
            where: { email },
            update: {
              tenantId: tenant.id,
              role: "TENANT_ADMIN",
              managedLocationId: undefined,
            },
            create: {
              email,
              name: "Tenant Admin",
              role: "TENANT_ADMIN",
              tenantId: tenant.id,
            },
          });

          await ensureDemoTenantData(tenant.id);

          const requestedLocation = locationSlug
            ? await prisma.location.findFirst({
                where: { tenantId: tenant.id, slug: locationSlug },
              })
            : null;

          let adminLocation = requestedLocation;

          if (!adminLocation && user.managedLocationId) {
            adminLocation = await prisma.location.findUnique({ where: { id: user.managedLocationId } });
          }

          if (!adminLocation) {
            adminLocation = await prisma.location.findFirst({
              where: { tenantId: tenant.id },
              orderBy: { name: "asc" },
            });
          }

          if (!adminLocation) {
            return null;
          }

          if (user.managedLocationId !== adminLocation.id) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { managedLocationId: adminLocation.id },
            });
          }

          return {
            id: user.id,
            email: user.email ?? undefined,
            name: user.name ?? undefined,
            role: user.role,
            tenantId: user.tenantId ?? null,
            locationId: adminLocation.id,
            locationName: adminLocation.name,
            locationSlug: adminLocation.slug,
          };
        }

        const customerEmail = process.env.DEMO_CUSTOMER_EMAIL ?? "customer@example.com";
        const customerPassword = process.env.DEMO_CUSTOMER_PASSWORD ?? "customer-pass";

        if (email !== customerEmail || password !== customerPassword) {
          return null;
        }

        let user = await prisma.user.upsert({
          where: { email },
          update: {
            tenantId: tenant.id,
            role: "CUSTOMER",
            managedLocationId: null,
          },
          create: {
            email,
            name:
              process.env.DEMO_CUSTOMER_DISPLAY_NAME ??
              `${process.env.DEMO_CUSTOMER_LAST_NAME ?? "予約"} ${
                process.env.DEMO_CUSTOMER_FIRST_NAME ?? "太郎"
              }`,
            role: "CUSTOMER",
            tenantId: tenant.id,
            managedLocationId: null,
          },
        });

        await ensureDemoTenantData(tenant.id);

        const existingCustomer = await prisma.customer.findFirst({
          where: { userId: user.id },
          include: { location: { select: { id: true, name: true, slug: true } } },
        });

        const requestedLocation = locationSlug
          ? await prisma.location.findFirst({ where: { tenantId: tenant.id, slug: locationSlug } })
          : null;

        let customerLocation = requestedLocation ?? existingCustomer?.location ?? null;

        if (!customerLocation) {
          customerLocation = await prisma.location.findFirst({
            where: { tenantId: tenant.id },
            orderBy: { name: "asc" },
          });
        }

        const customer = await prisma.customer.upsert({
          where: { userId: user.id },
          update: {
            tenantId: tenant.id,
            firstName: process.env.DEMO_CUSTOMER_FIRST_NAME ?? "太郎",
            lastName: process.env.DEMO_CUSTOMER_LAST_NAME ?? "予約",
            email: user.email ?? undefined,
            locationId: customerLocation?.id,
          },
          create: {
            tenantId: tenant.id,
            userId: user.id,
            firstName: process.env.DEMO_CUSTOMER_FIRST_NAME ?? "太郎",
            lastName: process.env.DEMO_CUSTOMER_LAST_NAME ?? "予約",
            email: user.email ?? undefined,
            locationId: customerLocation?.id,
          },
        });

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          role: user.role,
          tenantId: user.tenantId ?? null,
          locationId: customer.locationId ?? customerLocation?.id ?? null,
          locationName: customerLocation?.name ?? undefined,
          locationSlug: customerLocation?.slug ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId ?? null;
        token.locationId = (user as typeof user & { locationId?: string | null }).locationId ?? null;
        token.locationName = (user as typeof user & { locationName?: string | null }).locationName ?? null;
        token.locationSlug = (user as typeof user & { locationSlug?: string | null }).locationSlug ?? null;
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            id: true,
            role: true,
            tenantId: true,
            managedLocation: { select: { id: true, name: true, slug: true } },
            customer: {
              select: {
                location: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId ?? null;
          const locationRecord = dbUser.managedLocation ?? dbUser.customer?.location ?? null;
          token.locationId = locationRecord?.id ?? null;
          token.locationName = locationRecord?.name ?? null;
          token.locationSlug = locationRecord?.slug ?? null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.role = (token.role as string) ?? "";
        session.user.tenantId =
          (token.tenantId as string | null | undefined) ?? null;
        session.user.locationId = (token.locationId as string | null | undefined) ?? null;
        session.user.locationName = (token.locationName as string | null | undefined) ?? null;
        session.user.locationSlug = (token.locationSlug as string | null | undefined) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/sign-in",
  },
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
