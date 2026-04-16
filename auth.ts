import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

/**
 * APEX AERA Authentication
 *
 * Two providers:
 *   1. Google OAuth  — primary, for clients with Google accounts
 *   2. Credentials   — email + password for clients without Google
 *
 * Access control:
 *   ALLOWED_EMAILS env var — comma-separated whitelist.
 *   If empty, any authenticated user is allowed (open during internal testing).
 *
 * Credentials users are stored as:
 *   AUTH_CREDENTIALS = "email1:password1,email2:password2"
 *   Passwords are stored in plain text in env vars for v1.
 *   Upgrade to bcrypt hashing + database in v2.
 */

function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isEmailAllowed(email: string): boolean {
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return true; // open if no whitelist set
  return allowed.includes(email.toLowerCase());
}

function getCredentialUsers(): Array<{ email: string; password: string }> {
  return (process.env.AUTH_CREDENTIALS ?? "")
    .split(",")
    .map((pair) => {
      const colonIdx = pair.indexOf(":");
      if (colonIdx < 0) return null;
      return {
        email:    pair.slice(0, colonIdx).trim().toLowerCase(),
        password: pair.slice(colonIdx + 1).trim(),
      };
    })
    .filter(Boolean) as Array<{ email: string; password: string }>;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { prompt: "select_account" } },
    }),

    Credentials({
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email    = (credentials?.email    as string ?? "").trim().toLowerCase();
        const password = (credentials?.password as string ?? "").trim();
        if (!email || !password) return null;
        if (!isEmailAllowed(email)) return null;
        const users = getCredentialUsers();
        const match = users.find((u) => u.email === email && u.password === password);
        if (!match) return null;
        return { id: email, email, name: email.split("@")[0] };
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error:  "/access-denied",
  },

  callbacks: {
    async signIn({ user, account }) {
      // Credentials users are already validated in authorize()
      if (account?.provider === "credentials") return true;
      // Google users must pass the email whitelist
      return isEmailAllowed(user.email ?? "");
    },
    async session({ session }) {
      return session;
    },
    async jwt({ token }) {
      return token;
    },
  },
});
