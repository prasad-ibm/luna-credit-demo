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
import { NavLinks } from "./NavLinks";

export const metadata: Metadata = {
  title: "Verizon · Credit & Collections",
  description: "Agentic credit, collections & SOX controls — Verizon Enterprise",
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
        <header className="bg-black border-b border-zinc-800">
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-[#ee0000] font-black text-xl tracking-tight">Verizon</span>
              <span className="text-zinc-500 font-normal text-sm">· Credit & Collections</span>
            </div>
            <NavLinks />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
