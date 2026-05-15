import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "./prisma";
import { authConfig } from "../auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_EMAIL_FROM ?? "no-reply@fiscal.local",
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      const allowed = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      if (allowed.length === 0) return true;
      const email = user.email ?? "";
      return allowed.some((d) => email.endsWith(`@${d}`));
    },
  },
});
