"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import { stockAdjustmentSchema, stockEntrySchema, type StockEntryFormData } from "@/lib/validations/stock"

type ProductRow = Database["public"]["Tables"]["products"]["Row"]
type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"]
type StockMovementRow = Database["public"]["Tables"]["stock_movements"]["Row"]

export type StockProduct = ProductRow & {
  supplier_name: string | null
}

export type StockMovement = StockMovementRow & {
  product_description: string
  product_barcode: string | null
}

export type StockSummary = {
  totalProducts: number
  totalUnits: number
  costValue: number
  saleValue: number
  potentialProfit: number
}

export type StockMovementFilters = {
  productId?: string
  dateRange?: {
    from?: string
    to?: string
  }
  type?: "in" | "out" | "adjustment" | "all"
}

export type ActionResult<T> =
  | { data: T; error: null; message: string }
  | { data: null; error: string; message: string }

function withSupplierNames(products: ProductRow[], suppliers: SupplierRow[]): StockProduct[] {
  const supplierMap = suppliers.reduce<Record<string, string>>((map, supplier) => {
    map[supplier.id] = supplier.name
    return map
  }, {})

  return products.map((product) => ({
    ...product,
    supplier_name: product.supplier_id ? supplierMap[product.supplier_id] ?? null : null,
  }))
}

function getProductMap(products: ProductRow[]) {
  return products.reduce<Record<string, ProductRow>>((map, product) => {
    map[product.id] = product
    return map
  }, {})
}

async function getCurrentUserEmail() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.email ?? null
}

async function verifyAdminPassword(password: string) {
  const email = await getCurrentUserEmail()

  if (!email) {
    return false
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return !error
}

export async function getStockProducts(): Promise<ActionResult<StockProduct[]>> {
  try {
    const supabase = await createClient()
    const [{ data: products, error: productsError }, { data: suppliers, error: suppliersError }] =
      await Promise.all([
        supabase
          .from("products")
          .select("*")
          .is("deleted_at", null)
          .order("description", { ascending: true }),
        supabase.from("suppliers").select("*"),
      ])

    if (productsError || suppliersError || !products || !suppliers) {
      return {
        data: null,
        error: "Não foi possível carregar os produtos em estoque.",
        message: "Erro ao carregar estoque.",
      }
    }

    return {
      data: withSupplierNames(products, suppliers),
      error: null,
      message: "Estoque carregado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar o estoque agora.",
      message: "Erro ao carregar estoque.",
    }
  }
}

export async function getStockMovements(
  productId?: string,
  dateRange?: StockMovementFilters["dateRange"],
  type: StockMovementFilters["type"] = "all",
): Promise<ActionResult<StockMovement[]>> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)

    if (productId) {
      query = query.eq("product_id", productId)
    }

    if (dateRange?.from) {
      query = query.gte("created_at", `${dateRange.from}T00:00:00`)
    }

    if (dateRange?.to) {
      query = query.lte("created_at", `${dateRange.to}T23:59:59`)
    }

    if (type && type !== "all") {
      query = query.eq("type", type)
    }

    const [{ data: movements, error: movementsError }, { data: products, error: productsError }] =
      await Promise.all([
        query,
        supabase.from("products").select("*"),
      ])

    if (movementsError || productsError || !movements || !products) {
      return {
        data: null,
        error: "Não foi possível carregar as movimentações.",
        message: "Erro ao carregar movimentações.",
      }
    }

    const productMap = getProductMap(products)

    return {
      data: movements.map((movement) => ({
        ...movement,
        product_description: productMap[movement.product_id]?.description ?? "Produto não encontrado",
        product_barcode: productMap[movement.product_id]?.barcode ?? null,
      })),
      error: null,
      message: "Movimentações carregadas com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar as movimentações agora.",
      message: "Erro ao carregar movimentações.",
    }
  }
}

export async function addStockEntry(
  productId: string,
  quantity: number,
  reason?: string,
  details?: Omit<StockEntryFormData, "product_id" | "quantity" | "reason">,
): Promise<ActionResult<ProductRow>> {
  const parsedEntry = stockEntrySchema.safeParse({
    product_id: productId,
    quantity,
    reason,
    ...details,
  })

  if (!parsedEntry.success) {
    return {
      data: null,
      error: parsedEntry.error.issues[0]?.message ?? "Confira os dados da entrada.",
      message: "Erro ao registrar entrada.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: product, error } = await supabase.rpc("register_stock_entry", {
      p_product_id: parsedEntry.data.product_id,
      p_quantity: parsedEntry.data.quantity,
      p_reason: parsedEntry.data.reason ?? null,
      p_box_number: parsedEntry.data.box_number ?? null,
      p_supplier_id: parsedEntry.data.supplier_id ?? null,
      p_purchase_price: parsedEntry.data.purchase_price ?? null,
    })

    if (error || !product) {
      return {
        data: null,
        error: "Não foi possível registrar a entrada. Verifique permissões e produto.",
        message: "Erro ao registrar entrada.",
      }
    }

    revalidatePath("/")
    revalidatePath("/dashboard")
    revalidatePath("/estoque")
    revalidatePath("/produtos")

    return {
      data: product,
      error: null,
      message: "Entrada registrada com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível registrar a entrada agora.",
      message: "Erro ao registrar entrada.",
    }
  }
}

export async function adjustStock(
  productId: string,
  newQuantity: number,
  reason: string,
  password: string,
): Promise<ActionResult<ProductRow>> {
  const parsedAdjustment = stockAdjustmentSchema.safeParse({
    product_id: productId,
    new_quantity: newQuantity,
    reason,
    password,
  })

  if (!parsedAdjustment.success) {
    return {
      data: null,
      error: parsedAdjustment.error.issues[0]?.message ?? "Confira os dados do ajuste.",
      message: "Erro ao ajustar estoque.",
    }
  }

  const passwordIsValid = await verifyAdminPassword(parsedAdjustment.data.password)

  if (!passwordIsValid) {
    return {
      data: null,
      error: "Senha de administrador inválida.",
      message: "Erro ao ajustar estoque.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: product, error } = await supabase.rpc("adjust_product_stock", {
      p_product_id: parsedAdjustment.data.product_id,
      p_new_quantity: parsedAdjustment.data.new_quantity,
      p_reason: parsedAdjustment.data.reason,
    })

    if (error || !product) {
      return {
        data: null,
        error: "Não foi possível ajustar o estoque. Apenas administradores podem fazer ajuste manual.",
        message: "Erro ao ajustar estoque.",
      }
    }

    revalidatePath("/")
    revalidatePath("/dashboard")
    revalidatePath("/estoque")
    revalidatePath("/produtos")

    return {
      data: product,
      error: null,
      message: "Estoque ajustado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível ajustar o estoque agora.",
      message: "Erro ao ajustar estoque.",
    }
  }
}

export async function getLowStockProducts(): Promise<ActionResult<StockProduct[]>> {
  const productsResult = await getStockProducts()

  if (productsResult.error || !productsResult.data) {
    return productsResult
  }

  return {
    data: productsResult.data.filter(
      (product) => product.stock_quantity > 0 && product.stock_quantity <= product.min_stock,
    ),
    error: null,
    message: "Produtos com estoque crítico carregados com sucesso.",
  }
}

export async function getOutOfStockProducts(): Promise<ActionResult<StockProduct[]>> {
  const productsResult = await getStockProducts()

  if (productsResult.error || !productsResult.data) {
    return productsResult
  }

  return {
    data: productsResult.data.filter((product) => product.stock_quantity === 0),
    error: null,
    message: "Produtos sem estoque carregados com sucesso.",
  }
}
