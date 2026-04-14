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
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase() ?? "";
      return allowedEmails.includes(email);
    },
    async session({ session, token }) {
      return session;
    },
    async jwt({ token }) {
      return token;
    },
  },
});
