"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthContext, getRoleHomePath } from "./context";
import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";

function getField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function withMessage(path: string, message: string): string {
  const params = new URLSearchParams({ message });
  return `${path}?${params.toString()}`;
}

export async function signInAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(withMessage("/login", "Configure o Supabase para entrar."));
  }

  const supabase = await createClient();
  const email = getField(formData, "email");
  const password = getField(formData, "password");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(withMessage("/login", "Nao foi possivel entrar."));

  const context = await getAuthContext();
  redirect(getRoleHomePath(context?.role ?? "guest"));
}

export async function signUpAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(withMessage("/cadastro", "Configure o Supabase para criar contas."));
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const email = getField(formData, "email");
  const password = getField(formData, "password");
  const fullName = getField(formData, "full_name");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/login`
    }
  });

  if (error) redirect(withMessage("/cadastro", "Nao foi possivel criar a conta."));
  redirect(withMessage("/login", "Cadastro criado. Verifique seu email se necessario."));
}

export async function resetPasswordAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(withMessage("/recuperar-senha", "Configure o Supabase para recuperar senha."));
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const email = getField(formData, "email");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/nova-senha`
  });

  if (error) redirect(withMessage("/recuperar-senha", "Nao foi possivel enviar o email."));
  redirect(withMessage("/login", "Enviamos as instrucoes para seu email."));
}

export async function signOutAction() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updatePasswordAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(withMessage("/nova-senha", "Configure o Supabase para alterar senha."));
  }

  const supabase = await createClient();
  const password = getField(formData, "password");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(withMessage("/nova-senha", "Nao foi possivel alterar a senha."));

  redirect(withMessage("/login", "Senha atualizada. Entre novamente."));
}
