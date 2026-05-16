"use server"

import { revalidatePath } from "next/cache"
import * as XLSX from "xlsx"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import { productSchema, type ProductFormData } from "@/lib/validations/product"

type ProductRow = Database["public"]["Tables"]["products"]["Row"]
type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"]
type PriceHistoryRow = Database["public"]["Tables"]["price_history"]["Row"]
type StockMovementRow = Database["public"]["Tables"]["stock_movements"]["Row"]

export type ProductStatus = "in_stock" | "low_stock" | "out_of_stock"
export type ProductSortKey =
  | "description"
  | "barcode"
  | "supplier"
  | "box_number"
  | "purchase_price"
  | "sale_price"
  | "profit"
  | "stock_quantity"
  | "status"

export type ProductFilters = {
  status?: ProductStatus | "all"
  supplierId?: string
  search?: string
}

export type Product = ProductRow & {
  supplier_name: string | null
}

export type ProductImportMapping = {
  description: string
  barcode: string
  supplier_name: string
  purchase_price: string
  sale_price: string
  stock_quantity: string
  box_number: string
}

export type ProductImportResult = {
  inserted: number
  errors: Array<{
    row: number
    message: string
  }>
}

export type ProductDetails = {
  product: Product
  priceHistory: PriceHistoryRow[]
  stockMovements: StockMovementRow[]
}

export type ActionResult<T> =
  | { data: T; error: null; message: string }
  | { data: null; error: string; message: string }

function toNullableText(value: string | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null
}

function toProductPayload(data: ProductFormData) {
  return {
    description: data.description.trim(),
    barcode: toNullableText(data.barcode),
    box_number: data.box_number ?? null,
    supplier_id: data.supplier_id,
    purchase_price: data.purchase_price,
    sale_price: data.sale_price,
    stock_quantity: data.stock_quantity,
    min_stock: data.min_stock,
    deleted_at: null,
  } satisfies Database["public"]["Tables"]["products"]["Insert"]
}

function getSupplierMap(suppliers: SupplierRow[]) {
  return suppliers.reduce<Record<string, SupplierRow>>((map, supplier) => {
    map[supplier.id] = supplier
    return map
  }, {})
}

function withSupplierNames(products: ProductRow[], suppliers: SupplierRow[]): Product[] {
  const supplierMap = getSupplierMap(suppliers)

  return products.map((product) => ({
    ...product,
    supplier_name: product.supplier_id ? supplierMap[product.supplier_id]?.name ?? null : null,
  }))
}

function parseCurrency(value: unknown) {
  if (typeof value === "number") {
    return value
  }

  if (typeof value !== "string") {
    return Number.NaN
  }

  const normalizedValue = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")

  return Number(normalizedValue)
}

function parseInteger(value: unknown) {
  if (typeof value === "number") {
    return Math.trunc(value)
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined
  }

  return Number.parseInt(value, 10)
}

function getCell(row: Record<string, unknown>, columnName: string) {
  return row[columnName]
}

export async function getProducts(filters: ProductFilters = {}): Promise<ActionResult<Product[]>> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from("products")
      .select("*")
      .is("deleted_at", null)
      .order("description", { ascending: true })

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status)
    }

    if (filters.supplierId && filters.supplierId !== "all") {
      query = query.eq("supplier_id", filters.supplierId)
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim()
      query = query.or(`description.ilike.%${search}%,barcode.ilike.%${search}%`)
    }

    const [{ data: products, error: productsError }, { data: suppliers, error: suppliersError }] =
      await Promise.all([
        query,
        supabase.from("suppliers").select("*").order("name", { ascending: true }),
      ])

    if (productsError || suppliersError || !products || !suppliers) {
      return {
        data: null,
        error: "Não foi possível carregar os produtos.",
        message: "Erro ao carregar produtos.",
      }
    }

    return {
      data: withSupplierNames(products, suppliers),
      error: null,
      message: "Produtos carregados com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar os produtos agora.",
      message: "Erro ao carregar produtos.",
    }
  }
}

export async function getProductByBarcode(barcode: string): Promise<ActionResult<Product>> {
  try {
    const supabase = await createClient()
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", barcode)
      .is("deleted_at", null)
      .single()

    if (error || !product) {
      return {
        data: null,
        error: "Produto não encontrado para este código de barras.",
        message: "Produto não encontrado.",
      }
    }

    const { data: suppliers } = await supabase.from("suppliers").select("*")

    return {
      data: withSupplierNames(product ? [product] : [], suppliers ?? [])[0] ?? {
        ...product,
        supplier_name: null,
      },
      error: null,
      message: "Produto encontrado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível buscar o produto agora.",
      message: "Erro ao buscar produto.",
    }
  }
}

export async function getProductDetails(id: string): Promise<ActionResult<ProductDetails>> {
  try {
    const supabase = await createClient()
    const [
      { data: product, error: productError },
      { data: suppliers, error: suppliersError },
      { data: priceHistory, error: priceHistoryError },
      { data: stockMovements, error: stockMovementsError },
    ] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).is("deleted_at", null).single(),
      supabase.from("suppliers").select("*"),
      supabase
        .from("price_history")
        .select("*")
        .eq("product_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("stock_movements")
        .select("*")
        .eq("product_id", id)
        .order("created_at", { ascending: false }),
    ])

    if (
      productError ||
      suppliersError ||
      priceHistoryError ||
      stockMovementsError ||
      !product ||
      !suppliers ||
      !priceHistory ||
      !stockMovements
    ) {
      return {
        data: null,
        error: "Não foi possível carregar o produto.",
        message: "Erro ao carregar produto.",
      }
    }

    return {
      data: {
        product: withSupplierNames([product], suppliers)[0] ?? {
          ...product,
          supplier_name: null,
        },
        priceHistory,
        stockMovements,
      },
      error: null,
      message: "Produto carregado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar o produto agora.",
      message: "Erro ao carregar produto.",
    }
  }
}

export async function createProduct(data: ProductFormData): Promise<ActionResult<Product>> {
  const parsedProduct = productSchema.safeParse(data)

  if (!parsedProduct.success) {
    return {
      data: null,
      error: "Confira os dados do produto antes de salvar.",
      message: "Erro ao criar produto.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: product, error } = await supabase
      .from("products")
      .insert(toProductPayload(parsedProduct.data))
      .select()
      .single()

    if (error || !product) {
      return {
        data: null,
        error: "Não foi possível criar o produto.",
        message: "Erro ao criar produto.",
      }
    }

    const { data: suppliers } = await supabase.from("suppliers").select("*")

    revalidatePath("/produtos")
    revalidatePath("/produtos/novo")

    return {
      data: withSupplierNames([product], suppliers ?? [])[0] ?? {
        ...product,
        supplier_name: null,
      },
      error: null,
      message: "Produto criado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível criar o produto agora.",
      message: "Erro ao criar produto.",
    }
  }
}

export async function updateProduct(
  id: string,
  data: ProductFormData,
): Promise<ActionResult<Product>> {
  const parsedProduct = productSchema.safeParse(data)

  if (!parsedProduct.success) {
    return {
      data: null,
      error: "Confira os dados do produto antes de salvar.",
      message: "Erro ao atualizar produto.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: product, error } = await supabase
      .from("products")
      .update(toProductPayload(parsedProduct.data))
      .eq("id", id)
      .is("deleted_at", null)
      .select()
      .single()

    if (error || !product) {
      return {
        data: null,
        error: "Não foi possível atualizar o produto.",
        message: "Erro ao atualizar produto.",
      }
    }

    const { data: suppliers } = await supabase.from("suppliers").select("*")

    revalidatePath("/produtos")
    revalidatePath(`/produtos/${id}`)

    return {
      data: withSupplierNames([product], suppliers ?? [])[0] ?? {
        ...product,
        supplier_name: null,
      },
      error: null,
      message: "Produto atualizado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível atualizar o produto agora.",
      message: "Erro ao atualizar produto.",
    }
  }
}

export async function deleteProduct(id: string): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("products")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null)

    if (error) {
      return {
        data: null,
        error: "Não foi possível excluir o produto.",
        message: "Erro ao excluir produto.",
      }
    }

    revalidatePath("/produtos")

    return {
      data: undefined,
      error: null,
      message: "Produto excluído com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível excluir o produto agora.",
      message: "Erro ao excluir produto.",
    }
  }
}

async function getOrCreateSupplierId(name: string) {
  const supabase = await createClient()
  const trimmedName = name.trim()
  const { data: existingSupplier } = await supabase
    .from("suppliers")
    .select("id")
    .ilike("name", trimmedName)
    .maybeSingle()

  if (existingSupplier) {
    return existingSupplier.id
  }

  const { data: newSupplier, error } = await supabase
    .from("suppliers")
    .insert({
      name: trimmedName,
    })
    .select("id")
    .single()

  if (error || !newSupplier) {
    return null
  }

  return newSupplier.id
}

export async function importProducts(
  file: File,
  mapping: ProductImportMapping,
): Promise<ActionResult<ProductImportResult>> {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const firstSheetName = workbook.SheetNames[0]

    if (!firstSheetName) {
      return {
        data: null,
        error: "Arquivo sem planilhas para importar.",
        message: "Erro ao importar produtos.",
      }
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: "",
    })

    const supabase = await createClient()
    const errors: ProductImportResult["errors"] = []
    const payloads: Array<Database["public"]["Tables"]["products"]["Insert"]> = []

    for (const [index, row] of rows.entries()) {
      const supplierName = String(getCell(row, mapping.supplier_name) ?? "").trim()
      const supplierId = supplierName ? await getOrCreateSupplierId(supplierName) : null

      if (!supplierId) {
        errors.push({
          row: index + 2,
          message: "Fornecedor não informado ou não pôde ser criado.",
        })
        continue
      }

      const parsedProduct = productSchema.safeParse({
        description: String(getCell(row, mapping.description) ?? ""),
        barcode: String(getCell(row, mapping.barcode) ?? ""),
        supplier_id: supplierId,
        purchase_price: parseCurrency(getCell(row, mapping.purchase_price)),
        sale_price: parseCurrency(getCell(row, mapping.sale_price)),
        stock_quantity: parseInteger(getCell(row, mapping.stock_quantity)) ?? 0,
        box_number: parseInteger(getCell(row, mapping.box_number)),
        min_stock: 2,
      })

      if (!parsedProduct.success) {
        errors.push({
          row: index + 2,
          message: parsedProduct.error.issues[0]?.message ?? "Dados inválidos.",
        })
        continue
      }

      payloads.push(toProductPayload(parsedProduct.data))
    }

    if (payloads.length > 0) {
      const { error } = await supabase.from("products").insert(payloads)

      if (error) {
        return {
          data: null,
          error: "Não foi possível importar os produtos válidos.",
          message: "Erro ao importar produtos.",
        }
      }
    }

    revalidatePath("/produtos")
    revalidatePath("/produtos/novo")

    return {
      data: {
        inserted: payloads.length,
        errors,
      },
      error: null,
      message:
        errors.length > 0
          ? "Importação concluída com avisos."
          : "Produtos importados com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível processar o arquivo agora.",
      message: "Erro ao importar produtos.",
    }
  }
}
