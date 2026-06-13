export type UserRole = "admin" | "operator"

export type ManagedPermissionRole = "operator"

export const USER_ROLES = ["operator", "admin"] as const

export type ScreenIconName =
  | "bot"
  | "boxes"
  | "cash"
  | "chart"
  | "clipboard"
  | "file"
  | "home"
  | "package"
  | "shield"
  | "shopping-cart"
  | "users"

export type ScreenDefaultAccess = "admin" | "operator"

export type AppScreen = {
  id: string
  routePath: string
  title: string
  description: string
  iconName: ScreenIconName
  sortOrder: number
  showInNavigation: boolean
  defaultAccess: ScreenDefaultAccess
}

export type ScreenAccessItem = AppScreen & {
  canAccess: boolean
}

export const MANAGED_PERMISSION_ROLES = ["operator"] as const

const SCREEN_ICON_NAMES = [
  "bot",
  "boxes",
  "cash",
  "chart",
  "clipboard",
  "file",
  "home",
  "package",
  "shield",
  "shopping-cart",
  "users",
] as const

export const ACCESS_DENIED_ROUTE = "/acesso-negado"
export const FIRST_ACCESS_ROUTE = "/primeiro-acesso"

export const PUBLIC_AUTH_ROUTES = ["/login", "/register", "/resetar-senha"] as const

export const DEFAULT_OPERATOR_SCREEN_PATHS = [
  "/vendas",
  "/vendas/historico",
  "/clientes",
  "/clientes/[id]",
] as const

const ADMIN_EMAILS = ["henriqueboiteux62@gmail.com"] as const

type UserRoleIdentity = {
  email?: string | null
  app_metadata?: Record<string, unknown> | null
}

export function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "admin" || value === "operator"
}

export function getUserRoleFromIdentity(user: UserRoleIdentity): UserRole | null {
  const metadataRole = user.app_metadata?.role

  if (typeof metadataRole === "string" && isUserRole(metadataRole)) {
    return metadataRole
  }

  const normalizedEmail = user.email?.trim().toLowerCase()

  if (normalizedEmail && ADMIN_EMAILS.some((email) => email === normalizedEmail)) {
    return "admin"
  }

  return null
}

export function isManagedPermissionRole(
  value: string | null | undefined,
): value is ManagedPermissionRole {
  return value === "operator"
}

export function isScreenIconName(value: string | null | undefined): value is ScreenIconName {
  return SCREEN_ICON_NAMES.some((iconName) => iconName === value)
}

export function normalizeRoutePath(pathname: string) {
  if (!pathname || pathname === "/dashboard") {
    return "/"
  }

  const withoutTrailingSlash = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname

  return withoutTrailingSlash === "/dashboard" ? "/" : withoutTrailingSlash
}

export function isPublicAuthRoute(pathname: string) {
  return PUBLIC_AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

export function isAccessDeniedRoute(pathname: string) {
  return pathname === ACCESS_DENIED_ROUTE || pathname.startsWith(`${ACCESS_DENIED_ROUTE}/`)
}

export function isFirstAccessRoute(pathname: string) {
  return pathname === FIRST_ACCESS_ROUTE || pathname.startsWith(`${FIRST_ACCESS_ROUTE}/`)
}

export function createScreenId(routePath: string) {
  if (routePath === "/") {
    return "dashboard"
  }

  return routePath
    .replace(/^\//, "")
    .replace(/\//g, ".")
    .replace(/\[(.+?)\]/g, "$1")
}

export function matchesScreenPath(pathname: string, screenPath: string) {
  const normalizedPathname = normalizeRoutePath(pathname)
  const normalizedScreenPath = normalizeRoutePath(screenPath)

  if (normalizedScreenPath === "/") {
    return normalizedPathname === "/"
  }

  const pathnameSegments = normalizedPathname.split("/").filter(Boolean)
  const screenSegments = normalizedScreenPath.split("/").filter(Boolean)

  if (pathnameSegments.length !== screenSegments.length) {
    return false
  }

  return screenSegments.every((segment, index) => {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      return Boolean(pathnameSegments[index])
    }

    return segment === pathnameSegments[index]
  })
}

export function findMatchingScreen<T extends { routePath: string }>(
  pathname: string,
  screens: T[],
) {
  return screens.find((screen) => matchesScreenPath(pathname, screen.routePath)) ?? null
}
