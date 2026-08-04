"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  let name: string | null = null;
  let position: string | null = null;
  if (data.user) {
    const admin = createAdminSupabase();
    const { data: profile } = await admin
      .from("profiles")
      .select("name, position")
      .eq("id", data.user.id)
      .maybeSingle();
    name = (profile as { name: string | null; position: string | null } | null)?.name ?? null;
    position =
      (profile as { name: string | null; position: string | null } | null)?.position ?? null;
  }

  revalidatePath("/", "layout");
  return { success: true as const, name, position };
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
