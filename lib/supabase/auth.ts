import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUserId() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return undefined;
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}
