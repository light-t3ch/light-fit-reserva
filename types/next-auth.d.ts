import NextAuth from "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id: string;
      role: string;
      tenantId: string | null;
    };
  }

  interface User {
    role: string;
    tenantId: string | null;
  }
}
