import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  audience: z.enum(["ADMIN", "CUSTOMER"]).default("ADMIN"),
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

        const { email, password, audience } = parsed.data;
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

          const user = await prisma.user.upsert({
            where: { email },
            update: {
              tenantId: tenant.id,
              role: "TENANT_ADMIN",
            },
            create: {
              email,
              name: "Tenant Admin",
              role: "TENANT_ADMIN",
              tenantId: tenant.id,
            },
          });

          return {
            id: user.id,
            email: user.email ?? undefined,
            name: user.name ?? undefined,
            role: user.role,
            tenantId: user.tenantId ?? null,
          };
        }

        const customerEmail = process.env.DEMO_CUSTOMER_EMAIL ?? "customer@example.com";
        const customerPassword = process.env.DEMO_CUSTOMER_PASSWORD ?? "customer-pass";

        if (email !== customerEmail || password !== customerPassword) {
          return null;
        }

        const user = await prisma.user.upsert({
          where: { email },
          update: {
            tenantId: tenant.id,
            role: "CUSTOMER",
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
          },
        });

        await prisma.customer.upsert({
          where: { userId: user.id },
          update: {
            email: user.email ?? undefined,
          },
          create: {
            tenantId: tenant.id,
            userId: user.id,
            firstName: process.env.DEMO_CUSTOMER_FIRST_NAME ?? "太郎",
            lastName: process.env.DEMO_CUSTOMER_LAST_NAME ?? "予約",
            email: user.email ?? undefined,
          },
        });

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          role: user.role,
          tenantId: user.tenantId ?? null,
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
      }

      if ((!token.role || !("tenantId" in token)) && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true, role: true, tenantId: true },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId ?? null;
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
