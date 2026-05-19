"use server"

import { revalidatePath } from "next/cache"

import { getUserRoleFromIdentity, isUserRole as isKnownUserRole } from "@/lib/permissions/shared"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import { userCreateSchema, type UserCreateInput } from "@/lib/validations/permissions"

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

export type UserRole = "admin" | "operator"

export type AppUser = Pick<
  ProfileRow,
  "id" | "name" | "email" | "role" | "created_at" | "must_change_password"
>

export type ActionResult<T> =
  | { data: T; error: null; message: string }
  | { data: null; error: string; message: string }

type LegacyProfileRow = Pick<ProfileRow, "id" | "name" | "role" | "created_at">

function isSupabaseAdminCredentialsError(error: unknown) {
  return error instanceof Error && error.message === "Supabase admin credentials are not configured."
}

function legacyProfileToAppUser(profile: LegacyProfileRow): AppUser {
  return {
    ...profile,
    email: null,
    must_change_password: false,
  }
}

async function getCurrentAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, userId: null, isAdmin: false }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  const fallbackRole = getUserRoleFromIdentity(user)
  const role = isKnownUserRole(profile?.role) ? profile.role : fallbackRole

  return {
    supabase,
    userId: user.id,
    isAdmin: role === "admin",
  }
}

export async function getUsers(): Promise<ActionResult<AppUser[]>> {
  try {
    const { supabase, isAdmin } = await getCurrentAdmin()

    if (!isAdmin) {
      return {
        data: null,
        error: "Apenas administradores podem visualizar usuários.",
        message: "Acesso negado.",
      }
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, name, email, role, created_at, must_change_password")
      .order("name", { ascending: true })

    if (data) {
      return {
        data,
        error: null,
        message: "Usuários carregados com sucesso.",
      }
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from("profiles")
      .select("id, name, role, created_at")
      .order("name", { ascending: true })

    if (legacyError || !legacyData) {
      const diagnosticMessage =
        process.env.NODE_ENV === "development"
          ? ` (${legacyError?.message ?? "erro desconhecido"})`
          : ""

      return {
        data: null,
        error: `Não foi possível carregar os usuários.${diagnosticMessage}`,
        message: "Erro ao carregar usuários.",
      }
    }

    return {
      data: legacyData.map(legacyProfileToAppUser),
      error: null,
      message: "Usuários carregados com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar os usuários agora.",
      message: "Erro ao carregar usuários.",
    }
  }
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<ActionResult<AppUser>> {
  if (!isKnownUserRole(role)) {
    return {
      data: null,
      error: "Permissão inválida.",
      message: "Erro ao atualizar permissão.",
    }
  }

  try {
    const { supabase, userId: currentUserId, isAdmin } = await getCurrentAdmin()

    if (!isAdmin) {
      return {
        data: null,
        error: "Apenas administradores podem alterar permissões.",
        message: "Acesso negado.",
      }
    }

    if (currentUserId === userId) {
      return {
        data: null,
        error: "Você não pode alterar a sua própria permissão.",
        message: "Alteração bloqueada.",
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select("id, name, email, role, created_at, must_change_password")
      .single()

    if (error || !data) {
      return {
        data: null,
        error: "Não foi possível atualizar a permissão do usuário.",
        message: "Erro ao atualizar permissão.",
      }
    }

    revalidatePath("/usuarios")

    return {
      data,
      error: null,
      message: "Permissão atualizada com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível atualizar a permissão agora.",
      message: "Erro ao atualizar permissão.",
    }
  }
}

export async function createUser(input: UserCreateInput): Promise<ActionResult<AppUser>> {
  const parsedUser = userCreateSchema.safeParse(input)

  if (!parsedUser.success) {
    return {
      data: null,
      error: parsedUser.error.issues[0]?.message ?? "Confira os dados do usuário.",
      message: "Erro ao cadastrar usuário.",
    }
  }

  try {
    const { isAdmin, userId: currentUserId } = await getCurrentAdmin()

    if (!isAdmin || !currentUserId) {
      return {
        data: null,
        error: "Apenas administradores podem cadastrar usuários.",
        message: "Acesso negado.",
      }
    }

    const adminSupabase = createAdminClient()
    const { data: createdUser, error: createError } =
      await adminSupabase.auth.admin.createUser({
        email: parsedUser.data.email,
        password: parsedUser.data.password,
        email_confirm: true,
        user_metadata: {
          name: parsedUser.data.name,
        },
        app_metadata: {
          role: parsedUser.data.role,
          must_change_password: true,
        },
      })

    if (createError || !createdUser.user) {
      return {
        data: null,
        error:
          createError?.message.toLowerCase().includes("already")
            ? "Já existe um usuário cadastrado com este email."
            : "Não foi possível criar o usuário no Supabase Auth.",
        message: "Erro ao cadastrar usuário.",
      }
    }

    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .upsert(
        {
          id: createdUser.user.id,
          name: parsedUser.data.name,
          email: parsedUser.data.email,
          role: parsedUser.data.role,
          must_change_password: true,
          password_changed_at: null,
        },
        { onConflict: "id" },
      )
      .select("id, name, email, role, created_at, must_change_password")
      .single()

    if (profileError || !profile) {
      await adminSupabase.auth.admin.deleteUser(createdUser.user.id)

      return {
        data: null,
        error: "Usuário criado no Auth, mas o perfil não pôde ser configurado.",
        message: "Erro ao cadastrar usuário.",
      }
    }

    revalidatePath("/usuarios")

    return {
      data: profile,
      error: null,
      message: "Usuário cadastrado com sucesso.",
    }
  } catch (error) {
    if (isSupabaseAdminCredentialsError(error)) {
      return {
        data: null,
        error: "Configure a variável SUPABASE_SERVICE_ROLE_KEY no arquivo .env.local para cadastrar usuários.",
        message: "Configuração do Supabase incompleta.",
      }
    }

    return {
      data: null,
      error: "Não foi possível cadastrar o usuário agora.",
      message: "Erro ao cadastrar usuário.",
    }
  }
}
