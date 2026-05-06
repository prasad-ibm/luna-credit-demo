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
  title: "Luna Telecom · Credit & Collections",
  description: "Agentic credit, collections & SOX controls — North America Telecom",
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
            <div className="font-semibold tracking-tight">
              Luna Telecom <span className="text-slate-400 font-normal">· Credit & Collections</span>
            </div>
            <nav className="flex gap-1 text-sm">
              <Link
                href="/exposure"
                className="px-3 py-1.5 rounded-md hover:bg-slate-100"
              >
                Exposure
              </Link>
              <Link
                href="/collections"
                className="px-3 py-1.5 rounded-md hover:bg-slate-100"
              >
                Collections
              </Link>
              <Link
                href="/sox"
                className="px-3 py-1.5 rounded-md hover:bg-slate-100"
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
