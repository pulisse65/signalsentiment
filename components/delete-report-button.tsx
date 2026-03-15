"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DeleteReportButtonProps {
  reportId: string;
  redirectTo?: "/history";
  variant?: "default" | "outline" | "ghost";
}

export function DeleteReportButton({ reportId, redirectTo, variant = "outline" }: DeleteReportButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const onDelete = async () => {
    const confirmed = window.confirm("Delete this saved report? This action cannot be undone.");
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/report/${reportId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");

      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch {
      window.alert("Unable to delete this report right now.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button type="button" variant={variant} onClick={onDelete} disabled={isDeleting}>
      {isDeleting ? "Deleting..." : "Delete"}
    </Button>
  );
}
