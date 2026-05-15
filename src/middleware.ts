import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

const AUTH_ROUTES = ["/login", "/register"]

const DASHBOARD_ROUTES = [
  "/",
  "/dashboard",
  "/produtos",
  "/vendas",
  "/estoque",
  "/caixa",
  "/relatorios",
  "/fornecedores",
  "/chat",
]

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

function isProtectedRoute(pathname: string) {
  if (pathname.startsWith("/api/")) {
    return true
  }

  return DASHBOARD_ROUTES.some((route) => {
    if (route === "/") {
      return pathname === route
    }

    return pathname === route || pathname.startsWith(`${route}/`)
  })
}

async function getUserWithTimeout(
  supabase: SupabaseClient,
): Promise<User | null> {
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), 2500)
  })

  const getUser = supabase.auth.getUser().then(({ data }) => data.user)

  return Promise.race([getUser, timeout])
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const pathname = request.nextUrl.pathname

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

    return NextResponse.redirect(redirectUrl)
  }

  if (user && isAuthRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/dashboard"
    redirectUrl.search = ""

    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
