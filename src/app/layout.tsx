import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TDS Control Panel — البصيرة",
  description: "لوحة تحكم نظام توزيع الزوار (TDS) المُرحّل من PHP إلى Next.js على Vercel.",
  keywords: ["TDS", "Vercel", "Next.js", "traffic distribution", "cloaking", "البصيرة"],
  authors: [{ name: "albasirah" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "TDS Control Panel",
    description: "نظام توزيع الزوار على Next.js / Vercel",
    siteName: "TDS",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
