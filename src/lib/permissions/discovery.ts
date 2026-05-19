import "server-only"

import { readdir } from "node:fs/promises"
import path from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"

import { getScreenMetadata } from "@/lib/permissions/screen-metadata"
import {
  MANAGED_PERMISSION_ROLES,
  createScreenId,
  type AppScreen,
} from "@/lib/permissions/shared"
import type { Database } from "@/lib/supabase/types"

const DASHBOARD_APP_DIR = path.join(process.cwd(), "src", "app", "(dashboard)")
const IGNORED_SCREEN_PATHS = new Set(["/acesso-negado"])

type AppScreenInsert = Database["public"]["Tables"]["app_screens"]["Insert"]
type RoleScreenPermissionInsert =
  Database["public"]["Tables"]["role_screen_permissions"]["Insert"]

function routePathFromPageDirectory(directory: string) {
  const relativeDirectory = path.relative(DASHBOARD_APP_DIR, directory)

  if (!relativeDirectory) {
    return "/"
  }

  const routeSegments = relativeDirectory
    .split(path.sep)
    .filter((segment) => segment && !segment.startsWith("("))

  if (routeSegments.length === 0) {
    return "/"
  }

  return `/${routeSegments.join("/")}`
}

async function collectPageDirectories(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const hasPageFile = entries.some((entry) => entry.isFile() && entry.name === "page.tsx")
  const nestedDirectories = entries.filter((entry) => entry.isDirectory())

  const nestedPageDirectories = await Promise.all(
    nestedDirectories.map((entry) => collectPageDirectories(path.join(directory, entry.name))),
  )

  return [
    ...(hasPageFile ? [directory] : []),
    ...nestedPageDirectories.flat(),
  ]
}

export async function discoverDashboardScreens(): Promise<AppScreen[]> {
  const pageDirectories = await collectPageDirectories(DASHBOARD_APP_DIR)

  return pageDirectories
    .map((directory) => {
      const routePath = routePathFromPageDirectory(directory)
      const metadata = getScreenMetadata(routePath)

      return {
        id: createScreenId(routePath),
        routePath,
        title: metadata.title,
        description: metadata.description,
        iconName: metadata.iconName,
        sortOrder: metadata.sortOrder,
        showInNavigation: metadata.showInNavigation,
        defaultAccess: metadata.defaultAccess,
      } satisfies AppScreen
    })
    .filter((screen) => !IGNORED_SCREEN_PATHS.has(screen.routePath))
}

export async function syncDiscoveredScreens(supabase: SupabaseClient<Database>) {
  const screens = await discoverDashboardScreens()

  const screenRows = screens.map((screen) => ({
    id: screen.id,
    route_path: screen.routePath,
    title: screen.title,
    description: screen.description,
    icon_name: screen.iconName,
    sort_order: screen.sortOrder,
    show_in_navigation: screen.showInNavigation,
    default_access: screen.defaultAccess,
  }) satisfies AppScreenInsert)

  if (screenRows.length === 0) {
    return screens
  }

  const { error: screensError } = await supabase.from("app_screens").upsert(screenRows, {
    onConflict: "id",
  })

  if (screensError) {
    throw new Error("Não foi possível sincronizar as telas do sistema.")
  }

  const defaultPermissionRows = screens.flatMap((screen) =>
    MANAGED_PERMISSION_ROLES.map((role) => ({
      role,
      screen_id: screen.id,
      can_access: screen.defaultAccess === role,
    }) satisfies RoleScreenPermissionInsert),
  )

  const { error: permissionsError } = await supabase
    .from("role_screen_permissions")
    .upsert(defaultPermissionRows, {
      onConflict: "role,screen_id",
      ignoreDuplicates: true,
    })

  if (permissionsError) {
    throw new Error("Não foi possível sincronizar as permissões padrão.")
  }

  return screens
}
