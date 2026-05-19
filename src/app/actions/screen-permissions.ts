"use server"

import { revalidatePath } from "next/cache"

import { syncDiscoveredScreens } from "@/lib/permissions/discovery"
import { getScreenMetadata, sortScreens } from "@/lib/permissions/screen-metadata"
import {
  getUserRoleFromIdentity,
  isManagedPermissionRole,
  isScreenIconName,
  isUserRole,
  type ManagedPermissionRole,
  type ScreenAccessItem,
} from "@/lib/permissions/shared"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import {
  screenPermissionUpdateSchema,
  type ScreenPermissionUpdateInput,
} from "@/lib/validations/permissions"

type AppScreenRow = Database["public"]["Tables"]["app_screens"]["Row"]

export type ScreenPermissionsConfiguration = {
  role: ManagedPermissionRole
  roleLabel: string
  screens: ScreenAccessItem[]
}

export type ActionResult<T> =
  | { data: T; error: null; message: string }
  | { data: null; error: string; message: string }

function rowToScreenAccessItem(row: AppScreenRow, canAccess: boolean): ScreenAccessItem {
  const metadata = getScreenMetadata(row.route_path)

  return {
    id: row.id,
    routePath: row.route_path,
    title: row.title,
    description: row.description,
    iconName: isScreenIconName(row.icon_name) ? row.icon_name : metadata.iconName,
    sortOrder: row.sort_order,
    showInNavigation: row.show_in_navigation,
    defaultAccess: row.default_access === "operator" ? "operator" : "admin",
    canAccess,
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
  const role = isUserRole(profile?.role) ? profile.role : fallbackRole

  return {
    supabase,
    userId: user.id,
    isAdmin: role === "admin",
  }
}

export async function getScreenPermissionsConfiguration(): Promise<
  ActionResult<ScreenPermissionsConfiguration>
> {
  try {
    const { supabase, isAdmin } = await getCurrentAdmin()

    if (!isAdmin) {
      return {
        data: null,
        error: "Apenas administradores podem visualizar permissões por tela.",
        message: "Acesso negado.",
      }
    }

    await syncDiscoveredScreens(supabase)

    const [{ data: screens, error: screensError }, { data: permissions, error: permissionsError }] =
      await Promise.all([
        supabase.from("app_screens").select("*").order("sort_order", { ascending: true }),
        supabase
          .from("role_screen_permissions")
          .select("screen_id, can_access")
          .eq("role", "operator"),
      ])

    if (screensError || permissionsError || !screens || !permissions) {
      return {
        data: null,
        error: "Não foi possível carregar as permissões por tela.",
        message: "Erro ao carregar permissões.",
      }
    }

    const accessByScreenId = new Map(
      permissions.map((permission) => [permission.screen_id, permission.can_access]),
    )

    return {
      data: {
        role: "operator",
        roleLabel: "Operador",
        screens: sortScreens(
          screens.map((screen) =>
            rowToScreenAccessItem(
              screen,
              accessByScreenId.get(screen.id) ?? screen.default_access === "operator",
            ),
          ),
        ),
      },
      error: null,
      message: "Permissões carregadas com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar as permissões por tela agora.",
      message: "Erro ao carregar permissões.",
    }
  }
}

export async function updateRoleScreenPermission(
  input: ScreenPermissionUpdateInput,
): Promise<ActionResult<ScreenAccessItem>> {
  const parsedInput = screenPermissionUpdateSchema.safeParse(input)

  if (!parsedInput.success || !isManagedPermissionRole(parsedInput.data.role)) {
    return {
      data: null,
      error: "Confira a tela e o perfil antes de salvar.",
      message: "Permissão inválida.",
    }
  }

  try {
    const { supabase, userId, isAdmin } = await getCurrentAdmin()

    if (!isAdmin || !userId) {
      return {
        data: null,
        error: "Apenas administradores podem alterar permissões por tela.",
        message: "Acesso negado.",
      }
    }

    const { data: screen, error: screenError } = await supabase
      .from("app_screens")
      .select("*")
      .eq("id", parsedInput.data.screenId)
      .single()

    if (screenError || !screen) {
      return {
        data: null,
        error: "Tela não encontrada na configuração de permissões.",
        message: "Erro ao salvar permissao.",
      }
    }

    const { error } = await supabase.from("role_screen_permissions").upsert(
      {
        role: parsedInput.data.role,
        screen_id: parsedInput.data.screenId,
        can_access: parsedInput.data.canAccess,
        updated_by: userId,
      },
      { onConflict: "role,screen_id" },
    )

    if (error) {
      return {
        data: null,
        error: "Não foi possível salvar a permissão da tela.",
        message: "Erro ao salvar permissao.",
      }
    }

    revalidatePath("/usuarios")

    return {
      data: rowToScreenAccessItem(screen, parsedInput.data.canAccess),
      error: null,
      message: parsedInput.data.canAccess
        ? "Acesso habilitado com sucesso."
        : "Acesso removido com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível salvar a permissão agora.",
      message: "Erro ao salvar permissao.",
    }
  }
}
