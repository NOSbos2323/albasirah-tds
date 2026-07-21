import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Viewer",
  description: "PDF document viewer.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
