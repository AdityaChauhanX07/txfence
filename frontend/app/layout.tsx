import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "txfence",
  description:
    "txfence is the policy enforcement layer for AI agents. Define rules, enforce limits, and audit every action your agents take — before they hit production.",
  keywords: [
    "AI agents",
    "policy enforcement",
    "agent safety",
    "autonomous agents",
    "LLM guardrails",
    "agent governance",
    "txfence",
  ],
  openGraph: {
    title: "txfence — The Policy Layer for Autonomous Agents",
    description:
      "txfence is the policy enforcement layer for AI agents. Define rules, enforce limits, and audit every action your agents take — before they hit production.",
    url: "https://txfence.vercel.app",
    siteName: "txfence",
    type: "website",
    images: [{ url: "https://txfence.vercel.app/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "txfence — The Policy Layer for Autonomous Agents",
    description:
      "txfence is the policy enforcement layer for AI agents. Define rules, enforce limits, and audit every action your agents take — before they hit production.",
    creator: "@txfence",
    images: ["https://txfence.vercel.app/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
