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

function isEmailProviderDisabled(error: AuthError | null) {
  const message = error?.message.toLowerCase() ?? ""

  return (
    message.includes("email logins are disabled") ||
    message.includes("email signups are disabled")
  )
}

function isEmailNotConfirmed(error: AuthError | null) {
  return error?.message.toLowerCase().includes("email not confirmed") ?? false
}

function getSignInErrorMessage(error: AuthError | null) {
  if (isInvalidLogin(error)) {
    return "Email ou senha não conferem. Confira os dados ou envie um email para redefinir sua senha."
  }

  if (isEmailNotConfirmed(error)) {
    return "Seu email ainda não foi confirmado. Abra o link enviado para seu email antes de entrar."
  }

  if (isEmailProviderDisabled(error)) {
    return "Login por email e senha está desativado no Supabase. Ative o provedor Email em Authentication para entrar."
  }

  return "Não foi possível entrar agora. Tente novamente em instantes."
}

function getSignUpErrorMessage(error: AuthError | null) {
  if (isEmailProviderDisabled(error)) {
    return "Cadastro por email e senha está desativado no Supabase. Ative o provedor Email em Authentication para criar contas."
  }

  return "Não foi possível criar a conta. Confira os dados e tente novamente."
}

function getPasswordResetErrorMessage(error: AuthError | null) {
  if (isEmailProviderDisabled(error)) {
    return "Redefinição por email está desativada no Supabase. Ative o provedor Email em Authentication."
  }

  return "Não foi possível enviar o email de redefinição agora."
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
        error: getSignInErrorMessage(error),
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
        error: getSignUpErrorMessage(error),
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
        error: getPasswordResetErrorMessage(error),
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
