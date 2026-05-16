"use client"

import type { ComponentType, ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bot,
  Boxes,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  Home,
  Menu,
  PackageSearch,
  ShoppingCart,
  WalletCards,
} from "lucide-react"

import { UserMenu } from "@/components/layout/user-menu"
import { PageTransition } from "@/components/layout/page-transition"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useRealtimeStock } from "@/hooks/use-realtime-stock"

type NavItem = {
  title: string
  href: string
  icon: ComponentType<{ className?: string }>
  highlight?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/", icon: Home },
  { title: "PDV", href: "/vendas", icon: ShoppingCart, highlight: true },
  { title: "Produtos", href: "/produtos", icon: PackageSearch },
  { title: "Estoque", href: "/estoque", icon: Boxes },
  { title: "Fornecedores", href: "/fornecedores", icon: ClipboardList },
  { title: "Caixa", href: "/caixa", icon: WalletCards },
  { title: "Relatórios", href: "/relatorios", icon: ChartNoAxesColumnIncreasing },
  { title: "Assistente IA", href: "/chat", icon: Bot },
]

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname === "/dashboard"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function getPageTitle(pathname: string) {
  const activeItem = NAV_ITEMS.find((item) => isActivePath(pathname, item.href))

  if (pathname.startsWith("/produtos/novo")) {
    return "Produtos / Novo produto"
  }

  if (pathname.startsWith("/produtos/")) {
    return "Produtos / Editar produto"
  }

  if (pathname.startsWith("/vendas/historico")) {
    return "PDV / Histórico"
  }

  return activeItem?.title ?? "Dashboard"
}

function SidebarContent({ closeOnNavigate = false }: { closeOnNavigate?: boolean }) {
  const pathname = usePathname()
  const { criticalCount } = useRealtimeStock()
  const logoLink = (
    <Link href="/" className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-sm font-bold text-white shadow-sm">
        DS
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-950">Diverse Shop DF</span>
        <span className="block truncate text-xs text-slate-500">Gestão corporativa</span>
      </span>
    </Link>
  )

  return (
    <div className="flex min-h-full flex-col bg-white text-slate-950">
      <div className="border-b border-slate-200 px-5 py-5">
        {closeOnNavigate ? <SheetClose asChild>{logoLink}</SheetClose> : logoLink}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = isActivePath(pathname, item.href)

          const navLink = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-lg border-l-4 border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950",
                isActive && "border-l-indigo-600 bg-indigo-50 text-indigo-700",
                item.highlight && !isActive && "bg-sky-50 text-sky-800 hover:bg-sky-100",
              )}
            >
              <Icon
                className={cn(
                  "size-4 text-slate-400 transition-colors group-hover:text-slate-700",
                  isActive && "text-indigo-600",
                  item.highlight && !isActive && "text-sky-600",
                )}
              />
              <span>{item.title}</span>
              {item.href === "/estoque" && criticalCount > 0 ? (
                <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {criticalCount}
                </span>
              ) : null}
            </Link>
          )

          return closeOnNavigate ? (
            <SheetClose key={item.href} asChild>
              {navLink}
            </SheetClose>
          ) : (
            navLink
          )
        })}
      </nav>

      <footer className="border-t border-slate-200 px-5 py-4 text-xs text-slate-500">
        <p className="font-medium text-slate-800">Diverse Shop DF</p>
        <p>Versão 0.1.0</p>
      </footer>
    </div>
  )
}

export function DashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white shadow-sm lg:block">
        <SidebarContent />
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    className="border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
                    aria-label="Abrir navegação"
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-72 border-slate-200 bg-white p-0"
                  showCloseButton={false}
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navegação principal</SheetTitle>
                  </SheetHeader>
                  <SidebarContent closeOnNavigate />
                </SheetContent>
              </Sheet>

              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">Início / {pageTitle}</p>
                <h1 className="truncate text-xl font-bold text-slate-950 md:text-2xl">
                  {pageTitle}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <PageTransition>{children}</PageTransition>
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 md:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
            <span>Diverse Shop DF</span>
            <span>Versão 0.1.0</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
