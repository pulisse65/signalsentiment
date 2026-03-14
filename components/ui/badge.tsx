import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium", className)}>{children}</span>;
}
