"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import type { Database, Json } from "@/lib/supabase/types"
import { saleInputSchema, type PaymentMethod, type SaleInput } from "@/lib/validations/sale"

type SaleRow = Database["public"]["Tables"]["sales"]["Row"]
type SaleItemRow = Database["public"]["Tables"]["sale_items"]["Row"]

export type SaleWithItems = SaleRow & {
  items: SaleItemRow[]
}

export type DailySalesSummary = {
  date: string
  totalSales: number
  totalDiscount: number
  totalNetReceived: number
  salesCount: number
  byPaymentMethod: Record<PaymentMethod, number>
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

function getPaymentMethodTotal(sales: SaleRow[], paymentMethod: PaymentMethod) {
  return sales
    .filter((sale) => sale.status === "completed" && sale.payment_method === paymentMethod)
    .reduce((total, sale) => total + sale.total - sale.discount, 0)
}

function toRpcItems(items: SaleInput["items"]): Json {
  return items.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount: item.discount,
  }))
}

function toPaymentDetails(details: SaleInput["payment_details"]): Json {
  return {
    cash: details.cash,
    pix: details.pix,
    credit_card: details.credit_card,
    debit_card: details.debit_card,
  }
}

function getSaleErrorMessage(errorMessage: string | undefined) {
  const message = errorMessage ?? ""
  const normalizedMessage = message
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

  if (message.includes("autenticado") || normalizedMessage.includes("usuario nao autenticado")) {
    return "Entre novamente no sistema antes de finalizar a venda."
  }

  if (message.includes("permiss") || normalizedMessage.includes("usuario sem permissao")) {
    return "Seu usuário precisa ter perfil de operador ou administrador para finalizar vendas."
  }

  if (message.includes("Estoque insuficiente")) {
    return "Estoque insuficiente para concluir a venda."
  }

  if (message.includes("Produto") || normalizedMessage.includes("produto nao encontrado")) {
    return "Um dos produtos do carrinho não foi encontrado ou foi removido."
  }

  if (message.includes("pagamento misto")) {
    return "Os valores do pagamento misto precisam fechar com o total."
  }

  if (message.includes("create_sale_atomic")) {
    return "A função de finalização de venda ainda não está aplicada no banco. Rode as migrations do Supabase."
  }

  return "Não foi possível finalizar a venda. Confira o estoque e tente novamente."
}

export async function createSale(data: SaleInput): Promise<ActionResult<SaleRow>> {
  const parsedSale = saleInputSchema.safeParse(data)

  if (!parsedSale.success) {
    return {
      data: null,
      error: parsedSale.error.issues[0]?.message ?? "Confira os dados da venda.",
      message: "Erro ao finalizar venda.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: sale, error } = await supabase.rpc("create_sale_atomic", {
      p_items: toRpcItems(parsedSale.data.items),
      p_payment_method: parsedSale.data.payment_method,
      p_discount: parsedSale.data.discount,
      p_card_fee_rate: parsedSale.data.card_fee_rate,
      p_payment_details: toPaymentDetails(parsedSale.data.payment_details),
    })

    if (error || !sale) {
      return {
        data: null,
        error: getSaleErrorMessage(error?.message),
        message: "Erro ao finalizar venda.",
      }
    }

    revalidatePath("/")
    revalidatePath("/dashboard")
    revalidatePath("/vendas")
    revalidatePath("/produtos")
    revalidatePath("/estoque")

    return {
      data: sale,
      error: null,
      message: "Venda finalizada com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível finalizar a venda agora.",
      message: "Erro ao finalizar venda.",
    }
  }
}

export async function cancelSale(id: string, reason: string): Promise<ActionResult<SaleRow>> {
  if (!reason.trim()) {
    return {
      data: null,
      error: "Informe o motivo do cancelamento.",
      message: "Erro ao cancelar venda.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: sale, error } = await supabase
      .from("sales")
      .update({
        status: "cancelled",
        cancel_reason: reason.trim(),
      })
      .eq("id", id)
      .eq("status", "completed")
      .select()
      .single()

    if (error || !sale) {
      return {
        data: null,
        error: "Não foi possível cancelar a venda.",
        message: "Erro ao cancelar venda.",
      }
    }

    revalidatePath("/")
    revalidatePath("/dashboard")
    revalidatePath("/vendas")
    revalidatePath("/vendas/historico")
    revalidatePath("/produtos")
    revalidatePath("/estoque")

    return {
      data: sale,
      error: null,
      message: "Venda cancelada com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível cancelar a venda agora.",
      message: "Erro ao cancelar venda.",
    }
  }
}

export async function getSalesByDay(date: string): Promise<ActionResult<SaleWithItems[]>> {
  try {
    const { start, end } = toDateRange(date)
    const supabase = await createClient()
    const { data: sales, error } = await supabase
      .from("sales")
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })

    if (error || !sales) {
      return {
        data: null,
        error: "Não foi possível carregar as vendas do dia.",
        message: "Erro ao carregar vendas.",
      }
    }

    const saleIds = sales.map((sale) => sale.id)
    const { data: items, error: itemsError } = saleIds.length
      ? await supabase.from("sale_items").select("*").in("sale_id", saleIds)
      : { data: [], error: null }

    if (itemsError || !items) {
      return {
        data: null,
        error: "Não foi possível carregar os itens das vendas.",
        message: "Erro ao carregar vendas.",
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
      error: "Não foi possível carregar as vendas agora.",
      message: "Erro ao carregar vendas.",
    }
  }
}

export async function getDailySummary(date: string): Promise<ActionResult<DailySalesSummary>> {
  const salesResult = await getSalesByDay(date)

  if (salesResult.error || !salesResult.data) {
    return {
      data: null,
      error: salesResult.error ?? "Não foi possível carregar o resumo do dia.",
      message: "Erro ao carregar resumo.",
    }
  }

  const completedSales = salesResult.data.filter((sale) => sale.status === "completed")

  return {
    data: {
      date,
      totalSales: completedSales.reduce((total, sale) => total + sale.total - sale.discount, 0),
      totalDiscount: completedSales.reduce((total, sale) => total + sale.discount, 0),
      totalNetReceived: completedSales.reduce((total, sale) => total + sale.net_received, 0),
      salesCount: completedSales.length,
      byPaymentMethod: {
        cash: getPaymentMethodTotal(completedSales, "cash"),
        pix: getPaymentMethodTotal(completedSales, "pix"),
        credit_card: getPaymentMethodTotal(completedSales, "credit_card"),
        debit_card: getPaymentMethodTotal(completedSales, "debit_card"),
        mixed: getPaymentMethodTotal(completedSales, "mixed"),
      },
    },
    error: null,
    message: "Resumo carregado com sucesso.",
  }
}
