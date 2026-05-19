import type { AppScreen, ScreenDefaultAccess, ScreenIconName } from "@/lib/permissions/shared"

type ScreenMetadata = {
  title: string
  description: string
  iconName: ScreenIconName
  sortOrder: number
  showInNavigation: boolean
  defaultAccess: ScreenDefaultAccess
}

const SCREEN_METADATA: Record<string, ScreenMetadata> = {
  "/": {
    title: "Dashboard",
    description: "Visão geral de vendas, estoque e indicadores da loja.",
    iconName: "home",
    sortOrder: 10,
    showInNavigation: true,
    defaultAccess: "admin",
  },
  "/vendas": {
    title: "Vendas",
    description: "Ponto de venda para registrar compras e pagamentos.",
    iconName: "shopping-cart",
    sortOrder: 20,
    showInNavigation: true,
    defaultAccess: "operator",
  },
  "/vendas/historico": {
    title: "Histórico de vendas",
    description: "Consulta do histórico de vendas registradas no sistema.",
    iconName: "shopping-cart",
    sortOrder: 30,
    showInNavigation: false,
    defaultAccess: "operator",
  },
  "/produtos": {
    title: "Produtos",
    description: "Lista, busca e manutenção dos produtos cadastrados.",
    iconName: "package",
    sortOrder: 40,
    showInNavigation: true,
    defaultAccess: "admin",
  },
  "/produtos/novo": {
    title: "Novo produto",
    description: "Cadastro de novos produtos no estoque.",
    iconName: "package",
    sortOrder: 50,
    showInNavigation: false,
    defaultAccess: "admin",
  },
  "/produtos/[id]": {
    title: "Editar produto",
    description: "Edição dos dados e preços de um produto.",
    iconName: "package",
    sortOrder: 60,
    showInNavigation: false,
    defaultAccess: "admin",
  },
  "/estoque": {
    title: "Estoque",
    description: "Controle de entradas, ajustes e alertas de estoque.",
    iconName: "boxes",
    sortOrder: 70,
    showInNavigation: true,
    defaultAccess: "admin",
  },
  "/fornecedores": {
    title: "Fornecedores",
    description: "Cadastro e manutenção de fornecedores.",
    iconName: "clipboard",
    sortOrder: 80,
    showInNavigation: true,
    defaultAccess: "admin",
  },
  "/caixa": {
    title: "Caixa",
    description: "Fechamento de caixa e conciliação dos recebimentos.",
    iconName: "cash",
    sortOrder: 90,
    showInNavigation: true,
    defaultAccess: "admin",
  },
  "/relatorios": {
    title: "Relatórios",
    description: "Relatórios financeiros e operacionais.",
    iconName: "chart",
    sortOrder: 100,
    showInNavigation: true,
    defaultAccess: "admin",
  },
  "/chat": {
    title: "Assistente IA",
    description: "Assistente para cadastro, consultas e sugestões de reposição.",
    iconName: "bot",
    sortOrder: 110,
    showInNavigation: true,
    defaultAccess: "admin",
  },
  "/usuarios": {
    title: "Permissões",
    description: "Controle de usuários, perfis e acesso por tela.",
    iconName: "shield",
    sortOrder: 120,
    showInNavigation: true,
    defaultAccess: "admin",
  },
}

function humanizeRouteSegment(segment: string) {
  if (segment.startsWith("[") && segment.endsWith("]")) {
    return "Detalhe"
  }

  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function buildFallbackTitle(routePath: string) {
  if (routePath === "/") {
    return "Dashboard"
  }

  return routePath.split("/").filter(Boolean).map(humanizeRouteSegment).join(" / ")
}

function getDefaultNavigationState(routePath: string) {
  const segments = routePath.split("/").filter(Boolean)

  return segments.length <= 1 && !segments.some((segment) => segment.startsWith("["))
}

export function getScreenMetadata(routePath: string): ScreenMetadata {
  const metadata = SCREEN_METADATA[routePath]

  if (metadata) {
    return metadata
  }

  return {
    title: buildFallbackTitle(routePath),
    description: `Tela detectada automaticamente em ${routePath}.`,
    iconName: "file",
    sortOrder: 1000,
    showInNavigation: getDefaultNavigationState(routePath),
    defaultAccess: "admin",
  }
}

export function sortScreens<T extends Pick<AppScreen, "sortOrder" | "title" | "routePath">>(
  screens: T[],
) {
  return [...screens].sort((first, second) => {
    if (first.sortOrder !== second.sortOrder) {
      return first.sortOrder - second.sortOrder
    }

    return first.title.localeCompare(second.title, "pt-BR")
  })
}
