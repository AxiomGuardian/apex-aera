import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { SignOutCurtain } from "@/components/layout/SignOutCurtain";
import "./globals.css";

// ── Inter — display + body. Heavy weights for headings, clean for body ──
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "APEX AERA — Agentic AI Marketing",
  description:
    "Marketing that runs itself. AERA researches your market, writes platform-native content, schedules, publishes, and reports — 24/7.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body>
        <SessionProvider>
          <ThemeProvider>{children}</ThemeProvider>
          <SignOutCurtain />
        </SessionProvider>
      </body>
    </html>
  );
}
