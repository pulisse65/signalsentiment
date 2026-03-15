import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";

export const metadata: Metadata = {
  title: "Senti",
  description: "Multi-source sentiment analytics for stocks, sports, and products"
};

const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem('senti-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = saved === 'light' || saved === 'dark' ? saved : (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
