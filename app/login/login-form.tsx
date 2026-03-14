"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      setStatus("Check your email for a login link.");

      const allowedNext = new Set(["/", "/history", "/admin"]);
      if (nextPath && allowedNext.has(nextPath)) {
        router.push(nextPath as "/" | "/history" | "/admin");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to send login link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardHeader>
          <CardTitle>Email Login</CardTitle>
          <CardDescription>Sign in with Supabase Auth to access saved reports and admin pages.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input type="email" required placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Button type="submit" disabled={loading}>{loading ? "Sending..." : "Send magic link"}</Button>
            {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
