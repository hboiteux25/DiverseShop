import { NextResponse } from "next/server"

import {
  validateProductControlRows,
  writeProductControlWorkbook,
  type ProductControlExportRow,
} from "@/lib/export/product-control-workbook"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

type ProductRow = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  | "id"
  | "barcode"
  | "description"
  | "box_number"
  | "supplier_id"
  | "purchase_price"
  | "sale_price"
  | "stock_quantity"
>

type SupplierRow = Pick<Database["public"]["Tables"]["suppliers"]["Row"], "id" | "name">
type StockMovementRow = Pick<
  Database["public"]["Tables"]["stock_movements"]["Row"],
  "product_id" | "quantity" | "type"
>

async function selectAllProducts() {
  const supabase = await createClient()
  const products: ProductRow[] = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("id, barcode, description, box_number, supplier_id, purchase_price, sale_price, stock_quantity")
      .is("deleted_at", null)
      .order("description", { ascending: true })
      .range(from, from + 999)

    if (error || !data) {
      throw new Error("Não foi possível carregar os produtos para exportação.")
    }

    products.push(...data)

    if (data.length < 1000) {
      break
    }
  }

  return products
}

async function selectAllSuppliers() {
  const supabase = await createClient()
  const suppliers: SupplierRow[] = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name")
      .order("name", { ascending: true })
      .range(from, from + 999)

    if (error || !data) {
      throw new Error("Não foi possível carregar os fornecedores para exportação.")
    }

    suppliers.push(...data)

    if (data.length < 1000) {
      break
    }
  }

  return suppliers
}

async function selectAllOutMovements() {
  const supabase = await createClient()
  const movements: StockMovementRow[] = []

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("product_id, quantity, type")
      .eq("type", "out")
      .range(from, from + 999)

    if (error || !data) {
      throw new Error("Não foi possível carregar as saídas de estoque para exportação.")
    }

    movements.push(...data)

    if (data.length < 1000) {
      break
    }
  }

  return movements
}

function getSupplierMap(suppliers: SupplierRow[]) {
  return suppliers.reduce<Record<string, string>>((map, supplier) => {
    map[supplier.id] = supplier.name
    return map
  }, {})
}

function getSoldQuantityMap(movements: StockMovementRow[]) {
  return movements.reduce<Record<string, number>>((map, movement) => {
    map[movement.product_id] = (map[movement.product_id] ?? 0) + movement.quantity
    return map
  }, {})
}

function toExportRows(
  products: ProductRow[],
  suppliers: SupplierRow[],
  movements: StockMovementRow[],
): ProductControlExportRow[] {
  const supplierMap = getSupplierMap(suppliers)
  const soldQuantityMap = getSoldQuantityMap(movements)

  return products.map((product) => ({
    barcode: product.barcode,
    description: product.description.trim(),
    boxNumber: product.box_number,
    supplierName: product.supplier_id ? supplierMap[product.supplier_id] ?? "Sem fornecedor" : "Sem fornecedor",
    purchasePrice: product.purchase_price,
    salePrice: product.sale_price,
    stockQuantity: product.stock_quantity,
    soldQuantity: soldQuantityMap[product.id] ?? 0,
  }))
}

export async function GET() {
  try {
    const [products, suppliers, movements] = await Promise.all([
      selectAllProducts(),
      selectAllSuppliers(),
      selectAllOutMovements(),
    ])
    const rows = toExportRows(products, suppliers, movements)
    const validation = validateProductControlRows(rows)

    if (validation.errors.length > 0) {
      return NextResponse.json(
        {
          data: null,
          error: "Existem inconsistências nos produtos que impedem a exportação.",
          details: validation.errors,
        },
        { status: 422 },
      )
    }

    const buffer = writeProductControlWorkbook(rows)
    const fileName = `Controle Geral De Produtos Diverse Shop DF ${new Date().getFullYear()}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Exported-Products": String(rows.length),
        "X-Export-Warnings": String(validation.warnings.length),
      },
    })
  } catch {
    return NextResponse.json(
      { data: null, error: "Não foi possível exportar a planilha de produtos." },
      { status: 500 },
    )
  }
}
