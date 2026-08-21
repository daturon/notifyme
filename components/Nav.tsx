"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/events", label: "События" },
  { href: "/events/new", label: "Новое событие" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <nav className="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto px-4 py-3 sm:gap-4">
        <Link
          href="/events"
          className="mr-2 shrink-0 text-sm font-semibold text-black dark:text-zinc-50"
        >
          NotifyMe
        </Link>
        {links.map((link) => {
          const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
