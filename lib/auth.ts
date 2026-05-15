import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { authConfig } from "../auth.config";

const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const isResendReal =
  RESEND_KEY.startsWith("re_") &&
  !RESEND_KEY.includes("xxx") &&
  !RESEND_KEY.includes("temporal") &&
  !RESEND_KEY.includes("stub") &&
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
  console.log("Copia el URL al navegador para iniciar sesión.\n");
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    // Provider 1: Credentials (email + password) — admin hardcoded vía env
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminEmail || !adminPassword) return null;

        const inputEmail = String(credentials?.email ?? "").trim().toLowerCase();
        const inputPwd = String(credentials?.password ?? "");

        if (inputEmail !== adminEmail.toLowerCase() || inputPwd !== adminPassword) {
          return null;
        }

        // Find or create admin user en DB
        let user = await prisma.user.findUnique({ where: { email: inputEmail } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: inputEmail,
              role: "ADMIN",
              emailVerified: new Date(),
            },
          });
        } else if (user.role !== "ADMIN") {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { role: "ADMIN" },
          });
        }
        return { id: user.id, email: user.email, role: user.role };
      },
    }),

    // Provider 2: Resend magic link (o console fallback)
    Resend({
      apiKey: isResendReal ? RESEND_KEY : "stub",
      from: process.env.AUTH_EMAIL_FROM ?? "onboarding@resend.dev",
      ...(isResendReal ? {} : { sendVerificationRequest: consoleMagicLink }),
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Credentials provider: ya validado en authorize()
      if (account?.provider === "credentials") return true;

      // Resend: verificar dominio permitido
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
