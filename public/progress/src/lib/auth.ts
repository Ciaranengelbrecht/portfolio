import { supabase } from "./supabase";

export async function signIn(email: string, password: string) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(
  email: string,
  password: string,
  redirectTo?: string
) {
  return await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });
}

export async function sendPasswordReset(email: string, redirectTo?: string) {
  return await supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function signOut() {
  return await supabase.auth.signOut({ scope: "global" } as any);
}
