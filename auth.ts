import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

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
      // Read fresh on every request — avoids serverless module caching issues
      const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const email = user.email?.toLowerCase() ?? "";

      // If no allowlist is configured, allow all (dev fallback)
      if (allowedEmails.length === 0) return true;

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
