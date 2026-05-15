"use server"

import { redirect } from "next/navigation"
import type { AuthError, User } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { loginSchema } from "@/lib/validations/auth"

export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string }

function isInvalidLogin(error: AuthError | null) {
  return error?.message.toLowerCase().includes("invalid login credentials") ?? false
}

async function saveProfileName(userId: string, name: string): Promise<string | null> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        name,
      },
      {
        onConflict: "id",
      },
    )

  if (error) {
    return "Não foi possível salvar o nome do perfil. Tente novamente."
  }

  return null
}

export async function signIn(
  name: string,
  email: string,
  password: string,
): Promise<ActionResult<User>> {
  const parsedCredentials = loginSchema.safeParse({ name, email, password })

  if (!parsedCredentials.success) {
    return {
      data: null,
      error: "Confira nome, email e senha antes de continuar.",
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
          ? "Conta não encontrada ou senha incorreta. Confira os dados ou crie uma conta."
          : "Não foi possível entrar agora. Tente novamente em instantes.",
      }
    }

    const profileError = await saveProfileName(data.user.id, parsedCredentials.data.name)

    if (profileError) {
      await supabase.auth.signOut()

      return {
        data: null,
        error: profileError,
      }
    }

    await supabase.auth.updateUser({
      data: {
        name: parsedCredentials.data.name,
      },
    })

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
  const parsedCredentials = loginSchema.safeParse({ name, email, password })

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
      const profileError = await saveProfileName(data.user.id, parsedCredentials.data.name)

      if (profileError) {
        await supabase.auth.signOut()

        return {
          data: null,
          error: profileError,
        }
      }
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

export async function signOut(): Promise<never> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // Redirecting clears the app view even if the provider request fails.
  }

  redirect("/login")
}
