import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import {
  ACCESS_DENIED_ROUTE,
  DEFAULT_OPERATOR_SCREEN_PATHS,
  FIRST_ACCESS_ROUTE,
  findMatchingScreen,
  getUserRoleFromIdentity,
  isAccessDeniedRoute,
  isFirstAccessRoute,
  isPublicAuthRoute,
  isUserRole,
  matchesScreenPath,
  type UserRole,
} from "@/lib/permissions/shared"
import type { Database } from "@/lib/supabase/types"

const SENSITIVE_QUERY_PARAMS = [
  "password",
  "senha",
  "token",
  "access_token",
  "refresh_token",
  "code_verifier",
]

type AppScreenRouteRow = Pick<
  Database["public"]["Tables"]["app_screens"]["Row"],
  "id" | "route_path" | "default_access"
>

function isProtectedRoute(pathname: string) {
  if (pathname.startsWith("/api/")) {
    return true
  }

  return !isPublicAuthRoute(pathname)
}

function isDefaultOperatorRoute(pathname: string) {
  return DEFAULT_OPERATOR_SCREEN_PATHS.some((routePath) => matchesScreenPath(pathname, routePath))
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("Referrer-Policy", "no-referrer")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")

  return response
}

async function getUserWithTimeout(
  supabase: SupabaseClient<Database>,
): Promise<User | null> {
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), 2500)
  })

  const getUser = supabase.auth.getUser().then(({ data }) => data.user)

  return Promise.race([getUser, timeout])
}

async function getUserRoleWithTimeout(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<UserRole> {
  const fallbackRole = getUserRoleFromIdentity(user) ?? "operator"
  const timeout = new Promise<UserRole>((resolve) => {
    setTimeout(() => resolve(fallbackRole), 2500)
  })

  const roleQuery = supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
    .then(({ data }) => (isUserRole(data?.role) ? data.role : fallbackRole))

  return Promise.race([roleQuery, timeout])
}

async function getMustChangePasswordWithTimeout(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), 2500)
  })

  const profileQuery = supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", userId)
    .maybeSingle()
    .then(({ data }) => data?.must_change_password === true)

  return Promise.race([profileQuery, timeout])
}

async function canOperatorAccessPath(
  supabase: SupabaseClient<Database>,
  pathname: string,
) {
  const { data: screens, error: screensError } = await supabase
    .from("app_screens")
    .select("id, route_path, default_access")

  if (screensError || !screens || screens.length === 0) {
    return isDefaultOperatorRoute(pathname)
  }

  const matchingScreen = findMatchingScreen(
    pathname,
    screens.map((screen: AppScreenRouteRow) => ({
      id: screen.id,
      routePath: screen.route_path,
      defaultAccess: screen.default_access,
    })),
  )

  if (!matchingScreen) {
    return false
  }

  const { data: permission, error: permissionError } = await supabase
    .from("role_screen_permissions")
    .select("can_access")
    .eq("role", "operator")
    .eq("screen_id", matchingScreen.id)
    .maybeSingle()

  if (permissionError) {
    return matchingScreen.defaultAccess === "operator"
  }

  return permission?.can_access ?? matchingScreen.defaultAccess === "operator"
}

async function canOperatorAccessPathWithTimeout(
  supabase: SupabaseClient<Database>,
  pathname: string,
) {
  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(isDefaultOperatorRoute(pathname)), 2500)
  })

  return Promise.race([canOperatorAccessPath(supabase, pathname), timeout])
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const pathname = request.nextUrl.pathname

  const sanitizedUrl = request.nextUrl.clone()
  let hasSensitiveQueryParam = false

  SENSITIVE_QUERY_PARAMS.forEach((param) => {
    if (sanitizedUrl.searchParams.has(param)) {
      sanitizedUrl.searchParams.delete(param)
      hasSensitiveQueryParam = true
    }
  })

  if (hasSensitiveQueryParam) {
    sanitizedUrl.searchParams.delete("email")
    return applySecurityHeaders(NextResponse.redirect(sanitizedUrl))
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return applySecurityHeaders(NextResponse.next({ request }))
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

        response = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const user = await getUserWithTimeout(supabase)

  if (!user && isProtectedRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set("redirectedFrom", pathname)

    return applySecurityHeaders(NextResponse.redirect(redirectUrl))
  }

  if (user && isProtectedRoute(pathname) && !pathname.startsWith("/api/")) {
    const mustChangePassword = await getMustChangePasswordWithTimeout(supabase, user.id)

    if (mustChangePassword && !isFirstAccessRoute(pathname)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = FIRST_ACCESS_ROUTE
      redirectUrl.search = ""

      return applySecurityHeaders(NextResponse.redirect(redirectUrl))
    }

    if (!mustChangePassword && isFirstAccessRoute(pathname)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = "/dashboard"
      redirectUrl.search = ""

      return applySecurityHeaders(NextResponse.redirect(redirectUrl))
    }
  }

  if (user && isPublicAuthRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    const mustChangePassword = await getMustChangePasswordWithTimeout(supabase, user.id)
    redirectUrl.pathname = mustChangePassword ? FIRST_ACCESS_ROUTE : "/dashboard"
    redirectUrl.search = ""

    return applySecurityHeaders(NextResponse.redirect(redirectUrl))
  }

  if (user && isProtectedRoute(pathname) && !pathname.startsWith("/api/")) {
    const role = await getUserRoleWithTimeout(supabase, user)

    if (role === "operator" && !isAccessDeniedRoute(pathname)) {
      const canAccess = await canOperatorAccessPathWithTimeout(supabase, pathname)

      if (!canAccess) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = ACCESS_DENIED_ROUTE
        redirectUrl.search = ""
        redirectUrl.searchParams.set("rota", pathname)

        return applySecurityHeaders(NextResponse.redirect(redirectUrl))
      }
    }
  }

  return applySecurityHeaders(response)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
