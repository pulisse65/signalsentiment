import { ReactNode } from "react";
import Link from "next/link";
import { Activity, History, Search, TrendingUp } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/", label: "Search", icon: Search },
  { href: "/stocks", label: "Stocks", icon: TrendingUp },
  { href: "/history", label: "History", icon: History },
  { href: "/admin", label: "Health", icon: Activity }
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 via-blue-500 to-orange-400 text-sm font-bold text-slate-950 shadow">
              S
            </span>
            Senti
          </Link>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="h-4 w-4" /> {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
      <footer className="mx-auto mt-10 flex max-w-7xl flex-wrap items-center gap-4 border-t border-border/70 px-4 py-6 text-sm text-muted-foreground md:px-6">
        <Link href="/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>
        <Link href="/data-deletion" className="underline underline-offset-4">
          Data Deletion
        </Link>
      </footer>
    </div>
  );
}
