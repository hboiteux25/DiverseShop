"use server"

import { revalidatePath } from "next/cache"
import type { User } from "@supabase/supabase-js"

import { getUserRoleFromIdentity, isUserRole as isKnownUserRole } from "@/lib/permissions/shared"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import { userCreateSchema, type UserCreateInput } from "@/lib/validations/permissions"

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type AdminSupabaseClient = ReturnType<typeof createAdminClient>
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

export type UserRole = "admin" | "operator"

export type AppUser = Pick<
  ProfileRow,
  "id" | "name" | "email" | "role" | "created_at" | "must_change_password"
>

export type ActionResult<T> =
  | { data: T; error: null; message: string }
  | { data: null; error: string; message: string }

type LegacyProfileRow = Pick<ProfileRow, "id" | "name" | "role" | "created_at">
type ProfileWithEmailRow = Pick<ProfileRow, "id" | "name" | "email" | "role" | "created_at">

function isSupabaseAdminCredentialsError(error: unknown) {
  return error instanceof Error && error.message === "Supabase admin credentials are not configured."
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message

    return typeof message === "string" ? message : null
  }

  return null
}

function isMissingProfileColumnError(error: unknown) {
  const message = getErrorMessage(error)?.toLowerCase() ?? ""

  return (
    message.includes("must_change_password") ||
    message.includes("password_changed_at") ||
    message.includes("schema cache")
  )
}

function legacyProfileToAppUser(profile: LegacyProfileRow): AppUser {
  return {
    ...profile,
    email: null,
    must_change_password: false,
  }
}

function profileWithEmailToAppUser(profile: ProfileWithEmailRow): AppUser {
  return {
    ...profile,
    must_change_password: false,
  }
}

async function findAuthUserByEmail(
  adminSupabase: AdminSupabaseClient,
  email: string,
): Promise<User | null> {
  const normalizedEmail = email.toLowerCase()
  const perPage = 100

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage })

    if (error || !data.users) {
      return null
    }

    const user = data.users.find(
      (authUser) => authUser.email?.toLowerCase() === normalizedEmail,
    )

    if (user) {
      return user
    }

    if (data.users.length < perPage) {
      return null
    }
  }

  return null
}

async function syncAuthUserMetadata(
  adminSupabase: AdminSupabaseClient,
  userId: string,
  user: Pick<UserCreateInput, "name" | "role">,
  mustChangePassword: boolean,
) {
  const { data: authUserData, error: getUserError } =
    await adminSupabase.auth.admin.getUserById(userId)

  if (getUserError || !authUserData.user) {
    return false
  }

  const { error: updateUserError } = await adminSupabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...authUserData.user.user_metadata,
      name: user.name,
    },
    app_metadata: {
      ...authUserData.user.app_metadata,
      role: user.role,
      must_change_password: mustChangePassword,
    },
  })

  return !updateUserError
}

async function syncUpdatedUserRoleMetadata(user: AppUser) {
  if (!isKnownUserRole(user.role)) {
    return
  }

  try {
    const adminSupabase = createAdminClient()
    await syncAuthUserMetadata(
      adminSupabase,
      user.id,
      { name: user.name, role: user.role },
      user.must_change_password,
    )
  } catch (error) {
    if (!isSupabaseAdminCredentialsError(error)) {
      throw error
    }
  }
}

async function upsertUserProfile(
  adminSupabase: AdminSupabaseClient,
  actorSupabase: ServerSupabaseClient,
  userId: string,
  user: UserCreateInput,
  successMessage: string,
): Promise<ActionResult<AppUser>> {
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
        must_change_password: true,
        password_changed_at: null,
      },
      { onConflict: "id" },
    )
    .select("id, name, email, role, created_at, must_change_password")
    .single()

  if (profile) {
    await syncAuthUserMetadata(adminSupabase, userId, user, true)
    revalidatePath("/usuarios")

    return {
      data: profile,
      error: null,
      message: successMessage,
    }
  }

  const { data: actorProfile, error: actorProfileError } = await actorSupabase
    .from("profiles")
    .update({
      name: user.name,
      email: user.email,
      role: user.role,
      must_change_password: true,
      password_changed_at: null,
    })
    .eq("id", userId)
    .select("id, name, email, role, created_at, must_change_password")
    .single()

  if (actorProfile && !actorProfileError) {
    await syncAuthUserMetadata(adminSupabase, userId, user, true)
    revalidatePath("/usuarios")

    return {
      data: actorProfile,
      error: null,
      message: successMessage,
    }
  }

  if (isMissingProfileColumnError(profileError)) {
    const { data: legacyProfile, error: legacyProfileError } = await adminSupabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        { onConflict: "id" },
      )
      .select("id, name, email, role, created_at")
      .single()

    if (legacyProfile && !legacyProfileError) {
      await syncAuthUserMetadata(adminSupabase, userId, user, true)
      revalidatePath("/usuarios")

      return {
        data: profileWithEmailToAppUser(legacyProfile),
        error: null,
        message:
          "Usuário cadastrado com sucesso. A troca obrigatória de senha será ativada após aplicar a migration de perfis.",
      }
    }
  }

  return {
    data: null,
    error: "Usuário criado no Auth, mas o perfil não pôde ser configurado.",
    message: "Erro ao cadastrar usuário.",
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

    if (isMissingProfileColumnError(error)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId)
        .select("id, name, email, role, created_at")
        .single()

      if (legacyData && !legacyError) {
        const appUser = profileWithEmailToAppUser(legacyData)

        await syncUpdatedUserRoleMetadata(appUser)
        revalidatePath("/usuarios")

        return {
          data: appUser,
          error: null,
          message: "Permissão atualizada com sucesso.",
        }
      }
    }

    if (error || !data) {
      return {
        data: null,
        error: "Não foi possível atualizar a permissão do usuário.",
        message: "Erro ao atualizar permissão.",
      }
    }

    await syncUpdatedUserRoleMetadata(data)
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
    const { supabase, isAdmin, userId: currentUserId } = await getCurrentAdmin()

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
      const isExistingUser = createError?.message.toLowerCase().includes("already") ?? false

      if (isExistingUser) {
        const existingUser = await findAuthUserByEmail(adminSupabase, parsedUser.data.email)

        if (existingUser) {
          return upsertUserProfile(
            adminSupabase,
            supabase,
            existingUser.id,
            parsedUser.data,
            "Usuário já existia no Auth e o perfil foi configurado com sucesso.",
          )
        }
      }

      return {
        data: null,
        error:
          isExistingUser
            ? "Já existe um usuário cadastrado com este email."
            : "Não foi possível criar o usuário no Supabase Auth.",
        message: "Erro ao cadastrar usuário.",
      }
    }

    const profileResult = await upsertUserProfile(
      adminSupabase,
      supabase,
      createdUser.user.id,
      parsedUser.data,
      "Usuário cadastrado com sucesso.",
    )

    if (profileResult.error) {
      await adminSupabase.auth.admin.deleteUser(createdUser.user.id)

      return profileResult
    }

    return profileResult
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
