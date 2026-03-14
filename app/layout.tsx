import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";

export const metadata: Metadata = {
  title: "SignalSentiment",
  description: "Multi-source sentiment analytics for stocks, sports, and products"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
