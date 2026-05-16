"use server"

import { redirect } from "next/navigation"
import type { AuthError, User } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { resetPasswordRequestSchema, signInSchema, signUpSchema } from "@/lib/validations/auth"

export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string }

function isInvalidLogin(error: AuthError | null) {
  return error?.message.toLowerCase().includes("invalid login credentials") ?? false
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3002"
}

export async function signIn(email: string, password: string): Promise<ActionResult<User>> {
  const parsedCredentials = signInSchema.safeParse({ email, password })

  if (!parsedCredentials.success) {
    return {
      data: null,
      error: "Confira email e senha antes de continuar.",
    }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsedCredentials.data.email,
      password: parsedCredentials.data.password,
    })

    if (error || !data.user) {
      return {
        data: null,
        error: isInvalidLogin(error)
          ? "Email ou senha não conferem. Confira os dados ou envie um email para redefinir sua senha."
          : "Não foi possível entrar agora. Tente novamente em instantes.",
      }
    }

    return {
      data: data.user,
      error: null,
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível entrar agora. Tente novamente em instantes.",
    }
  }
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<ActionResult<User>> {
  const parsedCredentials = signUpSchema.safeParse({ name, email, password })

  if (!parsedCredentials.success) {
    return {
      data: null,
      error: "Confira nome, email e senha antes de continuar.",
    }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email: parsedCredentials.data.email,
      password: parsedCredentials.data.password,
      options: {
        data: {
          name: parsedCredentials.data.name,
        },
      },
    })

    if (error || !data.user) {
      return {
        data: null,
        error: "Não foi possível criar a conta. Confira os dados e tente novamente.",
      }
    }

    if (data.session) {
      await supabase.auth.signOut()
    }

    return {
      data: data.user,
      error: null,
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível criar a conta agora. Tente novamente em instantes.",
    }
  }
}

export async function requestPasswordReset(email: string): Promise<ActionResult<true>> {
  const parsedEmail = resetPasswordRequestSchema.safeParse({ email })

  if (!parsedEmail.success) {
    return {
      data: null,
      error: "Informe um email válido para redefinir a senha.",
    }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data.email, {
      redirectTo: `${getAppUrl()}/resetar-senha`,
    })

    if (error) {
      return {
        data: null,
        error: "Não foi possível enviar o email de redefinição agora.",
      }
    }

    return {
      data: true,
      error: null,
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível enviar o email de redefinição agora.",
    }
  }
}

export async function signOut(): Promise<never> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // Redirecting clears the app view even if the provider request fails.
  }

  redirect("/login")
}
