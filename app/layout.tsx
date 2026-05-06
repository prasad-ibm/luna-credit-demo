import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import Link from "next/link";

export const metadata: Metadata = {
  title: "Credit Workbench",
  description: "Agentic credit, collections & SOX controls — AgenticSAP demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b bg-card">
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-8">
            <div className="font-semibold">Credit Workbench</div>
            <nav className="flex gap-1 text-sm">
              <Link
                href="/exposure"
                className="px-3 py-1.5 rounded-md hover:bg-muted"
              >
                Exposure
              </Link>
              <Link
                href="/collections"
                className="px-3 py-1.5 rounded-md hover:bg-muted"
              >
                Collections
              </Link>
              <Link
                href="/sox"
                className="px-3 py-1.5 rounded-md hover:bg-muted"
              >
                SOX
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
