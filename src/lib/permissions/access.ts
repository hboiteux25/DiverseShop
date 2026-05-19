import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { syncDiscoveredScreens } from "@/lib/permissions/discovery"
import { getScreenMetadata, sortScreens } from "@/lib/permissions/screen-metadata"
import {
  DEFAULT_OPERATOR_SCREEN_PATHS,
  createScreenId,
  findMatchingScreen,
  getUserRoleFromIdentity,
  isScreenIconName,
  isUserRole,
  type AppScreen,
  type ScreenAccessItem,
  type UserRole,
} from "@/lib/permissions/shared"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

type AppScreenRow = Database["public"]["Tables"]["app_screens"]["Row"]
type RoleScreenPermissionRow =
  Database["public"]["Tables"]["role_screen_permissions"]["Row"]

export type DashboardShellData = {
  userRole: UserRole
  screens: ScreenAccessItem[]
  navigationScreens: ScreenAccessItem[]
  canUseChat: boolean
}

function buildDashboardShellData(
  userRole: UserRole,
  screens: ScreenAccessItem[],
): DashboardShellData {
  const accessibleScreens = screens.filter((screen) => screen.canAccess)
  const navigationScreens = accessibleScreens.filter((screen) => screen.showInNavigation)

  return {
    userRole,
    screens: accessibleScreens,
    navigationScreens,
    canUseChat:
      userRole === "admin" ||
      accessibleScreens.some((screen) => screen.routePath === "/chat"),
  }
}

function rowToAppScreen(row: AppScreenRow): AppScreen {
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
  }
}

function getFallbackScreens(userRole: UserRole): ScreenAccessItem[] {
  const fallbackPaths = [
    "/",
    "/vendas",
    "/vendas/historico",
    "/produtos",
    "/produtos/novo",
    "/produtos/[id]",
    "/estoque",
    "/fornecedores",
    "/caixa",
    "/relatorios",
    "/chat",
    "/usuarios",
  ]

  return fallbackPaths.map((routePath) => {
    const metadata = getScreenMetadata(routePath)
    const isOperatorDefault = DEFAULT_OPERATOR_SCREEN_PATHS.some(
      (defaultRoutePath) => defaultRoutePath === routePath,
    )

    return {
      id: createScreenId(routePath),
      routePath,
      title: metadata.title,
      description: metadata.description,
      iconName: metadata.iconName,
      sortOrder: metadata.sortOrder,
      showInNavigation: metadata.showInNavigation,
      defaultAccess: metadata.defaultAccess,
      canAccess: userRole === "admin" || isOperatorDefault,
    } satisfies ScreenAccessItem
  })
}

async function getCurrentUserRole(supabase: SupabaseClient<Database>): Promise<UserRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return "operator"
  }

  const fallbackRole = getUserRoleFromIdentity(user) ?? "operator"
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  return isUserRole(profile?.role) ? profile.role : fallbackRole
}

async function getScreensWithPermissions(
  supabase: SupabaseClient<Database>,
  userRole: UserRole,
): Promise<ScreenAccessItem[]> {
  const { data: screens, error: screensError } = await supabase
    .from("app_screens")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })

  if (screensError || !screens || screens.length === 0) {
    return getFallbackScreens(userRole)
  }

  if (userRole === "admin") {
    return sortScreens(screens.map(rowToAppScreen)).map((screen) => ({
      ...screen,
      canAccess: true,
    }))
  }

  const { data: permissions, error: permissionsError } = await supabase
    .from("role_screen_permissions")
    .select("screen_id, can_access")
    .eq("role", userRole)

  if (permissionsError || !permissions) {
    return getFallbackScreens(userRole)
  }

  const accessByScreenId = new Map(
    permissions.map((permission: Pick<RoleScreenPermissionRow, "screen_id" | "can_access">) => [
      permission.screen_id,
      permission.can_access,
    ]),
  )

  return sortScreens(screens.map(rowToAppScreen)).map((screen) => ({
    ...screen,
    canAccess: accessByScreenId.get(screen.id) ?? screen.defaultAccess === "operator",
  }))
}

export async function getDashboardShellData(): Promise<DashboardShellData> {
  let userRole: UserRole = "operator"

  try {
    const supabase = await createClient()
    userRole = await getCurrentUserRole(supabase)

    if (userRole === "admin") {
      try {
        await syncDiscoveredScreens(supabase)
      } catch {
        return buildDashboardShellData("admin", getFallbackScreens("admin"))
      }
    }

    const screens = await getScreensWithPermissions(supabase, userRole)

    return buildDashboardShellData(userRole, screens)
  } catch {
    return buildDashboardShellData(userRole, getFallbackScreens(userRole))
  }
}

export function canAccessPath(pathname: string, screens: ScreenAccessItem[]) {
  return Boolean(findMatchingScreen(pathname, screens)?.canAccess)
}
