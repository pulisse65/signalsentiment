import { ReactNode } from "react";
import Link from "next/link";
import { Activity, BarChart3, History, Search } from "lucide-react";

const navItems = [
  { href: "/", label: "Search", icon: Search },
  { href: "/history", label: "History", icon: History },
  { href: "/admin", label: "Health", icon: Activity }
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" />
            SignalSentiment
          </Link>
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
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
      <footer className="mx-auto mt-10 flex max-w-7xl flex-wrap items-center gap-4 border-t px-4 py-6 text-sm text-muted-foreground md:px-6">
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
