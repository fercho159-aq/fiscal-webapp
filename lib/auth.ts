import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "./prisma";
import { authConfig } from "../auth.config";

/**
 * Detecta si Resend está configurado con key real.
 * Si no, usa fallback que imprime magic link a stdout (visible en docker logs).
 * Útil para testing sin necesidad de cuenta Resend.
 */
const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const isResendReal =
  RESEND_KEY.startsWith("re_") &&
  !RESEND_KEY.includes("xxx") &&
  !RESEND_KEY.includes("temporal") &&
  RESEND_KEY.length > 12;

const consoleMagicLink = async (params: {
  identifier: string;
  url: string;
}): Promise<void> => {
  const banner = "=".repeat(60);
  console.log("\n" + banner);
  console.log("[AUTH] MAGIC LINK (Resend no configurado — modo dev)");
  console.log(banner);
  console.log(`Email:      ${params.identifier}`);
  console.log(`Magic link: ${params.url}`);
  console.log(banner);
  console.log("Copia el URL al navegador para iniciar sesión.");
  console.log("Para production, configura RESEND_API_KEY en .env\n");
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: isResendReal ? RESEND_KEY : "stub",
      from: process.env.AUTH_EMAIL_FROM ?? "onboarding@resend.dev",
      ...(isResendReal ? {} : { sendVerificationRequest: consoleMagicLink }),
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
