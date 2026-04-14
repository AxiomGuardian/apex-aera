import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// ── Allowlist ────────────────────────────────────────────────────
// Add approved email addresses to ALLOWED_EMAILS in Vercel env vars.
// Comma-separated: "email1@gmail.com,email2@gmail.com"
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/access-denied",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase() ?? "";
      if (allowedEmails.length === 0) return true; // no list = allow all (dev fallback)
      return allowedEmails.includes(email);
    },
    async session({ session }) {
      return session;
    },
    async jwt({ token }) {
      return token;
    },
  },
});
