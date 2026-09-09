"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env/public";
import { ACTIVE_TENANT_COOKIE_NAME } from "@/lib/auth/tenant-cookie";
import { DEMO_COOKIE_NAME, isDemoAccessEnabled } from "@/lib/demo/panel-demo";
import { createClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error?: string;
};

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email("Digite um e-mail válido.")),
  password: z.string().min(1, "Digite sua senha.").max(256),
});

export async function loginWithPasswordAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "E-mail inválido." };
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;

  try {
    (await cookies()).delete(DEMO_COOKIE_NAME);

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: "E-mail ou senha inválidos." };
    }
  } catch {
    return { error: "Configure o Supabase no arquivo .env.local para ativar o acesso." };
  }

  redirect("/painel/loja");
}

export async function startDemoAction() {
  if (!isDemoAccessEnabled()) redirect("/painel");

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // A demonstração usa dados locais e continua disponível sem o Supabase.
    }
  }

  (await cookies()).set(DEMO_COOKIE_NAME, "1", {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/painel/loja");
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_TENANT_COOKIE_NAME);
  cookieStore.delete(DEMO_COOKIE_NAME);
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      await supabase.auth.signOut();
    }
  } finally {
    redirect("/painel");
  }
}
