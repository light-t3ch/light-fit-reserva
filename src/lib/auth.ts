import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
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

        const { email, password } = parsed.data;
        const demoEmail = process.env.DEMO_TENANT_EMAIL ?? "tenant-admin@example.com";
        const demoPassword = process.env.DEMO_TENANT_PASSWORD ?? "change-me";

        if (email !== demoEmail || password !== demoPassword) {
          return null;
        }

        const tenantSlug = process.env.APP_TENANT_SLUG ?? "light-fit";
        const tenant = await prisma.tenant.upsert({
          where: { slug: tenantSlug },
          update: {},
          create: {
            slug: tenantSlug,
            name: "Light Fit Reserva",
          },
        });

        const user = await prisma.user.upsert({
          where: { email },
          update: {
            tenantId: tenant.id,
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
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
        session.user.tenantId = user.tenantId ?? null;
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
