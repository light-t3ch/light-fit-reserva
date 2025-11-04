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
