"use server"

import * as XLSX from "xlsx"

import { createClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/lib/supabase/types"

type SaleRow = Database["public"]["Tables"]["sales"]["Row"]
type SaleItemRow = Database["public"]["Tables"]["sale_items"]["Row"]
type ProductRow = Database["public"]["Tables"]["products"]["Row"]
type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"]

export type DateRange = {
  from: string
  to: string
}

export type PaymentTotals = {
  cash: number
  pix: number
  credit_card: number
  debit_card: number
  mixed: number
}

export type ReportSale = {
  id: string
  created_at: string
  total: number
  discount: number
  net_received: number
  payment_method: string
  status: string
}

export type DailyReport = {
  date: string
  sales: ReportSale[]
  totals: {
    gross: number
    discount: number
    net: number
    cardFees: number
    count: number
    payments: PaymentTotals
  }
}

export type MonthlyDayReport = {
  date: string
  salesCount: number
  gross: number
  discount: number
  net: number
  payments: PaymentTotals
}

export type MonthlyReport = {
  year: number
  month: number
  days: MonthlyDayReport[]
  totals: DailyReport["totals"]
}

export type AnnualMonthReport = {
  month: number
  label: string
  gross: number
  discount: number
  net: number
  salesCount: number
}

export type AnnualReport = {
  year: number
  months: AnnualMonthReport[]
  totals: {
    gross: number
    discount: number
    net: number
    salesCount: number
  }
}

export type TopProductReportItem = {
  productId: string
  description: string
  barcode: string | null
  quantity: number
  gross: number
  discount: number
  net: number
}

export type SupplierReportItem = {
  supplierId: string | null
  supplierName: string
  quantity: number
  gross: number
  net: number
  productsCount: number
}

export type ExportCell = string | number | null
export type ExportRow = Record<string, ExportCell>

export type ExportResult = {
  fileName: string
  contentBase64: string
}

export type ActionResult<T> =
  | { data: T; error: null; message: string }
  | { data: null; error: string; message: string }

type SaleWithItems = SaleRow & {
  items: SaleItemRow[]
}

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
]

function toDateRange(date: string) {
  return {
    start: `${date}T00:00:00`,
    end: `${date}T23:59:59`,
  }
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

function getYearRange(year: number) {
  return {
    start: new Date(year, 0, 1).toISOString(),
    end: new Date(year + 1, 0, 1).toISOString(),
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function getFinalTotal(sale: SaleRow) {
  return sale.total - sale.discount
}

function getPaymentDetail(paymentDetails: Json, key: string) {
  if (typeof paymentDetails !== "object" || paymentDetails === null || Array.isArray(paymentDetails)) {
    return 0
  }

  const value = paymentDetails[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function createEmptyPayments(): PaymentTotals {
  return {
    cash: 0,
    pix: 0,
    credit_card: 0,
    debit_card: 0,
    mixed: 0,
  }
}

function addSaleToPayments(payments: PaymentTotals, sale: SaleRow) {
  const finalTotal = getFinalTotal(sale)

  if (sale.payment_method === "cash") payments.cash += finalTotal
  if (sale.payment_method === "pix") payments.pix += finalTotal
  if (sale.payment_method === "credit_card") payments.credit_card += finalTotal
  if (sale.payment_method === "debit_card") payments.debit_card += finalTotal
  if (sale.payment_method === "mixed") {
    payments.cash += getPaymentDetail(sale.payment_details, "cash")
    payments.pix += getPaymentDetail(sale.payment_details, "pix")
    payments.credit_card += getPaymentDetail(sale.payment_details, "credit_card")
    payments.debit_card += getPaymentDetail(sale.payment_details, "debit_card")
    payments.mixed += finalTotal
  }
}

function getCardFees(sale: SaleRow) {
  const rate = sale.card_fee_rate ?? 0

  if (sale.payment_method === "credit_card" || sale.payment_method === "debit_card") {
    return getFinalTotal(sale) * rate
  }

  if (sale.payment_method === "mixed") {
    return (
      getPaymentDetail(sale.payment_details, "credit_card") +
      getPaymentDetail(sale.payment_details, "debit_card")
    ) * rate
  }

  return 0
}

function summarizeSales(sales: SaleRow[]): DailyReport["totals"] {
  return sales.reduce<DailyReport["totals"]>(
    (totals, sale) => {
      totals.gross += getFinalTotal(sale)
      totals.discount += sale.discount
      totals.net += sale.net_received
      totals.cardFees += getCardFees(sale)
      totals.count += 1
      addSaleToPayments(totals.payments, sale)
      return totals
    },
    {
      gross: 0,
      discount: 0,
      net: 0,
      cardFees: 0,
      count: 0,
      payments: createEmptyPayments(),
    },
  )
}

async function getSalesWithItems(start: string, end: string): Promise<ActionResult<SaleWithItems[]>> {
  try {
    const supabase = await createClient()
    const { data: sales, error } = await supabase
      .from("sales")
      .select("*")
      .eq("status", "completed")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })

    if (error || !sales) {
      return {
        data: null,
        error: "Não foi possível carregar as vendas.",
        message: "Erro ao carregar relatório.",
      }
    }

    const saleIds = sales.map((sale) => sale.id)
    const { data: items, error: itemsError } = saleIds.length
      ? await supabase.from("sale_items").select("*").in("sale_id", saleIds)
      : { data: [], error: null }

    if (itemsError || !items) {
      return {
        data: null,
        error: "Não foi possível carregar os itens vendidos.",
        message: "Erro ao carregar relatório.",
      }
    }

    return {
      data: sales.map((sale) => ({
        ...sale,
        items: items.filter((item) => item.sale_id === sale.id),
      })),
      error: null,
      message: "Vendas carregadas com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar o relatório agora.",
      message: "Erro ao carregar relatório.",
    }
  }
}

export async function getDailyReport(date: string): Promise<ActionResult<DailyReport>> {
  const range = toDateRange(date)
  const salesResult = await getSalesWithItems(range.start, range.end)

  if (salesResult.error || !salesResult.data) {
    return {
      data: null,
      error: salesResult.error ?? "Não foi possível carregar o relatório diário.",
      message: "Erro ao carregar relatório diário.",
    }
  }

  const sales = salesResult.data

  return {
    data: {
      date,
      sales: sales.map((sale) => ({
        id: sale.id,
        created_at: sale.created_at,
        total: roundMoney(sale.total),
        discount: roundMoney(sale.discount),
        net_received: roundMoney(sale.net_received),
        payment_method: sale.payment_method,
        status: sale.status,
      })),
      totals: summarizeSales(sales),
    },
    error: null,
    message: "Relatório diário carregado com sucesso.",
  }
}

export async function getMonthlyReport(
  year: number,
  month: number,
): Promise<ActionResult<MonthlyReport>> {
  const range = getMonthRange(year, month)
  const salesResult = await getSalesWithItems(range.start, range.end)

  if (salesResult.error || !salesResult.data) {
    return {
      data: null,
      error: salesResult.error ?? "Não foi possível carregar o relatório mensal.",
      message: "Erro ao carregar relatório mensal.",
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const sales = salesResult.data.filter((sale) => sale.created_at.slice(0, 10) === date)
    const totals = summarizeSales(sales)

    return {
      date,
      salesCount: totals.count,
      gross: roundMoney(totals.gross),
      discount: roundMoney(totals.discount),
      net: roundMoney(totals.net),
      payments: totals.payments,
    }
  })

  return {
    data: {
      year,
      month,
      days,
      totals: summarizeSales(salesResult.data),
    },
    error: null,
    message: "Relatório mensal carregado com sucesso.",
  }
}

export async function getAnnualReport(year: number): Promise<ActionResult<AnnualReport>> {
  const range = getYearRange(year)
  const salesResult = await getSalesWithItems(range.start, range.end)

  if (salesResult.error || !salesResult.data) {
    return {
      data: null,
      error: salesResult.error ?? "Não foi possível carregar o relatório anual.",
      message: "Erro ao carregar relatório anual.",
    }
  }

  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const sales = salesResult.data.filter(
      (sale) => new Date(sale.created_at).getMonth() + 1 === month,
    )
    const totals = summarizeSales(sales)

    return {
      month,
      label: MONTH_LABELS[index] ?? String(month),
      gross: roundMoney(totals.gross),
      discount: roundMoney(totals.discount),
      net: roundMoney(totals.net),
      salesCount: totals.count,
    }
  })

  return {
    data: {
      year,
      months,
      totals: {
        gross: roundMoney(months.reduce((total, item) => total + item.gross, 0)),
        discount: roundMoney(months.reduce((total, item) => total + item.discount, 0)),
        net: roundMoney(months.reduce((total, item) => total + item.net, 0)),
        salesCount: months.reduce((total, item) => total + item.salesCount, 0),
      },
    },
    error: null,
    message: "Relatório anual carregado com sucesso.",
  }
}

export async function getTopProducts(
  dateRange: DateRange,
  limit = 20,
): Promise<ActionResult<TopProductReportItem[]>> {
  const salesResult = await getSalesWithItems(`${dateRange.from}T00:00:00`, `${dateRange.to}T23:59:59`)

  if (salesResult.error || !salesResult.data) {
    return {
      data: null,
      error: salesResult.error ?? "Não foi possível carregar produtos mais vendidos.",
      message: "Erro ao carregar produtos.",
    }
  }

  const supabase = await createClient()
  const { data: products, error } = await supabase.from("products").select("*")

  if (error || !products) {
    return {
      data: null,
      error: "Não foi possível carregar os produtos.",
      message: "Erro ao carregar produtos.",
    }
  }

  const productMap = products.reduce<Record<string, ProductRow>>((map, product) => {
    map[product.id] = product
    return map
  }, {})
  const totals = new Map<string, TopProductReportItem>()

  for (const sale of salesResult.data) {
    for (const item of sale.items) {
      const current = totals.get(item.product_id)
      const product = productMap[item.product_id]
      const gross = item.quantity * item.unit_price

      if (current) {
        current.quantity += item.quantity
        current.gross += gross
        current.discount += item.discount
        current.net += gross - item.discount
      } else {
        totals.set(item.product_id, {
          productId: item.product_id,
          description: product?.description ?? "Produto não encontrado",
          barcode: product?.barcode ?? null,
          quantity: item.quantity,
          gross,
          discount: item.discount,
          net: gross - item.discount,
        })
      }
    }
  }

  return {
    data: Array.from(totals.values())
      .sort((left, right) => right.net - left.net)
      .slice(0, limit),
    error: null,
    message: "Produtos mais vendidos carregados com sucesso.",
  }
}

export async function getSupplierReport(
  dateRange: DateRange,
): Promise<ActionResult<SupplierReportItem[]>> {
  const [topProductsResult, suppliersResult] = await Promise.all([
    getTopProducts(dateRange, 500),
    createClient().then((supabase) => supabase.from("suppliers").select("*")),
  ])

  if (topProductsResult.error || !topProductsResult.data) {
    return {
      data: null,
      error: topProductsResult.error ?? "Não foi possível carregar fornecedores.",
      message: "Erro ao carregar fornecedores.",
    }
  }

  if (suppliersResult.error || !suppliersResult.data) {
    return {
      data: null,
      error: "Não foi possível carregar os fornecedores.",
      message: "Erro ao carregar fornecedores.",
    }
  }

  const supabase = await createClient()
  const { data: products, error } = await supabase.from("products").select("*")

  if (error || !products) {
    return {
      data: null,
      error: "Não foi possível carregar os produtos.",
      message: "Erro ao carregar fornecedores.",
    }
  }

  const productMap = products.reduce<Record<string, ProductRow>>((map, product) => {
    map[product.id] = product
    return map
  }, {})
  const supplierMap = suppliersResult.data.reduce<Record<string, SupplierRow>>((map, supplier) => {
    map[supplier.id] = supplier
    return map
  }, {})
  const totals = new Map<string, SupplierReportItem>()

  for (const product of topProductsResult.data) {
    const productRow = productMap[product.productId]
    const supplierId = productRow?.supplier_id ?? null
    const key = supplierId ?? "without-supplier"
    const current = totals.get(key)

    if (current) {
      current.quantity += product.quantity
      current.gross += product.gross
      current.net += product.net
      current.productsCount += 1
    } else {
      totals.set(key, {
        supplierId,
        supplierName: supplierId ? supplierMap[supplierId]?.name ?? "Fornecedor não encontrado" : "Sem fornecedor",
        quantity: product.quantity,
        gross: product.gross,
        net: product.net,
        productsCount: 1,
      })
    }
  }

  return {
    data: Array.from(totals.values()).sort((left, right) => right.net - left.net),
    error: null,
    message: "Relatório por fornecedor carregado com sucesso.",
  }
}

export async function exportToExcel(
  reportType: string,
  data: ExportRow[],
): Promise<ActionResult<ExportResult>> {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1")

    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: column })
      const cell = worksheet[cellAddress]

      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: "FFFFC000" } },
          font: { bold: true, color: { rgb: "FF111827" } },
          alignment: { horizontal: "center" },
        }
      }
    }

    worksheet["!cols"] = Object.keys(data[0] ?? {}).map(() => ({ wch: 20 }))
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório")

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
      cellStyles: true,
    })

    return {
      data: {
        fileName: `Relatorio_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        contentBase64: Buffer.from(buffer).toString("base64"),
      },
      error: null,
      message: "Excel gerado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível gerar o Excel agora.",
      message: "Erro ao exportar Excel.",
    }
  }
}
