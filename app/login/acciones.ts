"use server";

import { redirect } from "next/navigation";
import { crearCliente } from "@/lib/supabase/server";

function volver(modo: string, error: string): never {
  redirect(`/login?modo=${modo}&error=${encodeURIComponent(error)}`);
}

export async function ingresar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) volver("ingresar", "Completá mail y contraseña.");

  const supabase = await crearCliente();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = error.message.includes("Email not confirmed")
      ? "Tu mail no está confirmado. Avisale a la persona responsable."
      : "Mail o contraseña incorrectos.";
    volver("ingresar", msg);
  }
  redirect("/");
}

export async function registrarse(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!nombre || !email) volver("registro", "Completá nombre y mail.");
  if (password.length < 8) volver("registro", "La contraseña tiene que tener al menos 8 caracteres.");

  const supabase = await crearCliente();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });
  if (error) {
    const msg = error.message.toLowerCase().includes("already")
      ? "Ya hay una cuenta con ese mail. Probá ingresar."
      : `No se pudo crear la cuenta: ${error.message}`;
    volver("registro", msg);
  }
  if (!data.session) {
    volver("ingresar", "Cuenta creada. Si no podés entrar, avisale a la persona responsable.");
  }
  redirect("/");
}

export async function salir() {
  const supabase = await crearCliente();
  await supabase.auth.signOut();
  redirect("/login");
}
