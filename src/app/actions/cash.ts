"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/lib/supabase/types"
import { cashClosingSchema, type CashClosingInput } from "@/lib/validations/cash"

type CashClosingRow = Database["public"]["Tables"]["cash_closings"]["Row"]
type SaleRow = Database["public"]["Tables"]["sales"]["Row"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

export type PaymentTotals = {
  cash: number
  pix: number
  credit: number
  debit: number
  mixed: number
}

export type CashDaySummary = {
  date: string
  totalSales: number
  totalDiscount: number
  totalCardFees: number
  totalNetReceived: number
  salesCount: number
  paymentTotals: PaymentTotals
}

export type CashDayStatus = {
  date: string
  isClosed: boolean
  closing: CashClosingRow | null
  summary: CashDaySummary
}

export type CashHistoryItem = CashClosingRow & {
  closed_by_name: string | null
}

export type ActionResult<T> =
  | { data: T; error: null; message: string }
  | { data: null; error: string; message: string }

function toDateRange(date: string) {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 1)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

function toNumber(value: Json | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function getPaymentDetail(paymentDetails: Json, key: string) {
  if (typeof paymentDetails !== "object" || paymentDetails === null || Array.isArray(paymentDetails)) {
    return 0
  }

  const value = paymentDetails[key]
  return toNumber(value)
}

function getFinalTotal(sale: SaleRow) {
  return sale.total - sale.discount
}

function addSaleToSummary(summary: CashDaySummary, sale: SaleRow) {
  const finalTotal = getFinalTotal(sale)
  const cardRate = sale.card_fee_rate ?? 0
  summary.totalSales += finalTotal
  summary.totalDiscount += sale.discount
  summary.totalNetReceived += sale.net_received
  summary.salesCount += 1

  if (sale.payment_method === "cash") {
    summary.paymentTotals.cash += finalTotal
    return
  }

  if (sale.payment_method === "pix") {
    summary.paymentTotals.pix += finalTotal
    return
  }

  if (sale.payment_method === "credit_card") {
    summary.paymentTotals.credit += finalTotal
    summary.totalCardFees += finalTotal * cardRate
    return
  }

  if (sale.payment_method === "debit_card") {
    summary.paymentTotals.debit += finalTotal
    summary.totalCardFees += finalTotal * cardRate
    return
  }

  if (sale.payment_method === "mixed") {
    const cash = getPaymentDetail(sale.payment_details, "cash")
    const pix = getPaymentDetail(sale.payment_details, "pix")
    const credit = getPaymentDetail(sale.payment_details, "credit_card")
    const debit = getPaymentDetail(sale.payment_details, "debit_card")
    summary.paymentTotals.cash += cash
    summary.paymentTotals.pix += pix
    summary.paymentTotals.credit += credit
    summary.paymentTotals.debit += debit
    summary.paymentTotals.mixed += finalTotal
    summary.totalCardFees += (credit + debit) * cardRate
  }
}

async function getCurrentUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id ?? null
}

export async function getDaySummary(date: string): Promise<ActionResult<CashDaySummary>> {
  try {
    const { start, end } = toDateRange(date)
    const supabase = await createClient()
    const { data: sales, error } = await supabase
      .from("sales")
      .select("*")
      .eq("status", "completed")
      .gte("created_at", start)
      .lt("created_at", end)

    if (error || !sales) {
      return {
        data: null,
        error: "Não foi possível carregar o resumo do caixa.",
        message: "Erro ao carregar caixa.",
      }
    }

    const summary = sales.reduce<CashDaySummary>(
      (currentSummary, sale) => {
        addSaleToSummary(currentSummary, sale)
        return currentSummary
      },
      {
        date,
        totalSales: 0,
        totalDiscount: 0,
        totalCardFees: 0,
        totalNetReceived: 0,
        salesCount: 0,
        paymentTotals: {
          cash: 0,
          pix: 0,
          credit: 0,
          debit: 0,
          mixed: 0,
        },
      },
    )

    return {
      data: summary,
      error: null,
      message: "Resumo do caixa carregado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar o resumo do caixa agora.",
      message: "Erro ao carregar caixa.",
    }
  }
}

export async function getDayStatus(date: string): Promise<ActionResult<CashDayStatus>> {
  const summaryResult = await getDaySummary(date)

  if (summaryResult.error || !summaryResult.data) {
    return {
      data: null,
      error: summaryResult.error ?? "Não foi possível verificar o caixa.",
      message: "Erro ao verificar caixa.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: closing, error } = await supabase
      .from("cash_closings")
      .select("*")
      .eq("date", date)
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: "Não foi possível verificar se o dia já foi fechado.",
        message: "Erro ao verificar caixa.",
      }
    }

    return {
      data: {
        date,
        isClosed: Boolean(closing),
        closing,
        summary: summaryResult.data,
      },
      error: null,
      message: "Status do caixa carregado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível verificar o caixa agora.",
      message: "Erro ao verificar caixa.",
    }
  }
}

export async function closeCashRegister(
  data: CashClosingInput,
): Promise<ActionResult<CashClosingRow>> {
  const parsedClosing = cashClosingSchema.safeParse(data)

  if (!parsedClosing.success) {
    return {
      data: null,
      error: parsedClosing.error.issues[0]?.message ?? "Confira os dados do fechamento.",
      message: "Erro ao fechar caixa.",
    }
  }

  try {
    const supabase = await createClient()
    const userId = await getCurrentUserId()
    const { data: closing, error } = await supabase
      .from("cash_closings")
      .insert({
        date: parsedClosing.data.date,
        expected_cash: parsedClosing.data.expected_cash,
        counted_cash: parsedClosing.data.counted_cash,
        total_sales: parsedClosing.data.total_sales,
        total_pix: parsedClosing.data.total_pix,
        total_credit: parsedClosing.data.total_credit,
        total_debit: parsedClosing.data.total_debit,
        total_discount: parsedClosing.data.total_discount,
        total_card_fees: parsedClosing.data.total_card_fees,
        notes: parsedClosing.data.notes ?? null,
        closed_by: userId,
      })
      .select()
      .single()

    if (error || !closing) {
      return {
        data: null,
        error: "Não foi possível fechar o caixa. Verifique se ele já foi fechado ou se você tem permissão.",
        message: "Erro ao fechar caixa.",
      }
    }

    revalidatePath("/caixa")
    revalidatePath("/relatorios")

    return {
      data: closing,
      error: null,
      message: "Caixa fechado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível fechar o caixa agora.",
      message: "Erro ao fechar caixa.",
    }
  }
}

export async function getCashHistory(months = 1): Promise<ActionResult<CashHistoryItem[]>> {
  try {
    const safeMonths = Math.min(Math.max(Math.trunc(months), 1), 24)
    const since = new Date()
    since.setMonth(since.getMonth() - safeMonths)

    const supabase = await createClient()
    const [{ data: closings, error: closingsError }, { data: profiles, error: profilesError }] =
      await Promise.all([
        supabase
          .from("cash_closings")
          .select("*")
          .gte("date", since.toISOString().slice(0, 10))
          .order("date", { ascending: false })
          .limit(30),
        supabase.from("profiles").select("*"),
      ])

    if (closingsError || profilesError || !closings || !profiles) {
      return {
        data: null,
        error: "Não foi possível carregar o histórico de caixa.",
        message: "Erro ao carregar histórico.",
      }
    }

    const profileMap = profiles.reduce<Record<string, ProfileRow>>((map, profile) => {
      map[profile.id] = profile
      return map
    }, {})

    return {
      data: closings.map((closing) => ({
        ...closing,
        closed_by_name: closing.closed_by ? profileMap[closing.closed_by]?.name ?? null : null,
      })),
      error: null,
      message: "Histórico de caixa carregado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar o histórico agora.",
      message: "Erro ao carregar histórico.",
    }
  }
}
