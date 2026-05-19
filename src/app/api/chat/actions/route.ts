import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createProduct } from "@/app/actions/products"
import { getLowStockProducts, getOutOfStockProducts, getStockProducts } from "@/app/actions/stock"
import { getUserRoleFromIdentity, isUserRole } from "@/lib/permissions/shared"
import { createClient } from "@/lib/supabase/server"
import { productSchema } from "@/lib/validations/product"

const queryStockSchema = z.object({
  status: z.enum(["all", "low_stock", "out_of_stock", "in_stock"]).optional(),
  search: z.string().optional(),
})

const createProductActionSchema = z.object({
  action: z.literal("create_product"),
  data: productSchema,
})

const queryStockActionSchema = z.object({
  action: z.literal("query_stock"),
  filters: queryStockSchema.optional(),
})

const createRestockListActionSchema = z.object({
  action: z.literal("create_restock_list"),
})

const chatActionSchema = z.discriminatedUnion("action", [
  createProductActionSchema,
  queryStockActionSchema,
  createRestockListActionSchema,
])

async function getAuthenticatedRole() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { userId: null, role: null }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role ?? null
  const fallbackRole = getUserRoleFromIdentity(user)

  return {
    userId: user.id,
    role: isUserRole(role) ? role : fallbackRole,
  }
}

function filterStockProducts(
  products: NonNullable<Awaited<ReturnType<typeof getStockProducts>>["data"]>,
  filters: z.infer<typeof queryStockSchema> | undefined,
) {
  const normalizedSearch = filters?.search?.trim().toLowerCase()

  return products.filter((product) => {
    const matchesStatus = !filters?.status || filters.status === "all" || product.status === filters.status
    const matchesSearch =
      !normalizedSearch ||
      product.description.toLowerCase().includes(normalizedSearch) ||
      product.barcode?.toLowerCase().includes(normalizedSearch) ||
      product.supplier_name?.toLowerCase().includes(normalizedSearch)

    return matchesStatus && matchesSearch
  })
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parsedAction = chatActionSchema.safeParse(body)

    if (!parsedAction.success) {
      return NextResponse.json(
        { data: null, error: "Ação inválida para o assistente." },
        { status: 400 },
      )
    }

    const auth = await getAuthenticatedRole()

    if (!auth.userId || !auth.role) {
      return NextResponse.json(
        { data: null, error: "Faça login para executar esta ação." },
        { status: 401 },
      )
    }

    if (parsedAction.data.action === "create_product") {
      if (auth.role !== "admin") {
        return NextResponse.json(
          { data: null, error: "Apenas administradores podem cadastrar produtos pelo assistente." },
          { status: 403 },
        )
      }

      const result = await createProduct(parsedAction.data.data)
      return NextResponse.json(result, { status: result.error ? 400 : 200 })
    }

    if (parsedAction.data.action === "query_stock") {
      const result = await getStockProducts()

      if (result.error || !result.data) {
        return NextResponse.json(result, { status: 400 })
      }

      return NextResponse.json({
        data: filterStockProducts(result.data, parsedAction.data.filters),
        error: null,
        message: "Estoque consultado com sucesso.",
      })
    }

    const [lowStockResult, outOfStockResult] = await Promise.all([
      getLowStockProducts(),
      getOutOfStockProducts(),
    ])

    if (lowStockResult.error || outOfStockResult.error || !lowStockResult.data || !outOfStockResult.data) {
      return NextResponse.json(
        { data: null, error: "Não foi possível montar a lista de reposição." },
        { status: 400 },
      )
    }

    const restockProducts = [...outOfStockResult.data, ...lowStockResult.data]
    const restockList = restockProducts.map((product) => ({
      product_id: product.id,
      description: product.description,
      supplier_name: product.supplier_name ?? "Fornecedor não informado",
      current_stock: product.stock_quantity,
      min_stock: product.min_stock,
      suggested_quantity: Math.max(product.min_stock * 2 - product.stock_quantity, 1),
    }))

    return NextResponse.json({
      data: restockList,
      error: null,
      message: "Lista de reposição gerada com sucesso.",
    })
  } catch {
    return NextResponse.json(
      { data: null, error: "Não foi possível executar a ação do assistente agora." },
      { status: 500 },
    )
  }
}
