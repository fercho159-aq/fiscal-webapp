import type { NextAuthConfig } from "next-auth";

/**
 * Config edge-compatible (sin Prisma adapter, sin Node-only providers).
 * Usado por middleware. Compartido con auth.ts para producción.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
  },
  session: { strategy: "jwt" },
  providers: [], // se llenan en auth.ts (Node runtime)
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const publicPaths = ["/login", "/login/verify", "/api/auth", "/api/health"];
      if (publicPaths.some((p) => pathname.startsWith(p))) return true;
      return !!auth;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        (token as { role?: string }).role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = ((token as { role?: string }).role) ?? "USER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
