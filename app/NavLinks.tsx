"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/exposure",    label: "Exposure" },
  { href: "/collections", label: "Collections" },
  { href: "/sox",         label: "SOX" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {NAV.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-md transition ${
              active
                ? "bg-slate-900 text-white"
                : "hover:bg-slate-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
