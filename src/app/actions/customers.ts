"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import {
  customerIdSchema,
  customerSchema,
  onlyDigits,
  type CustomerFormData,
  type CustomerSearchInput,
} from "@/lib/validations/customer"

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"]
type SaleRow = Database["public"]["Tables"]["sales"]["Row"]
type SaleItemRow = Database["public"]["Tables"]["sale_items"]["Row"]
type ProductRow = Database["public"]["Tables"]["products"]["Row"]

export type Customer = CustomerRow

export type CustomerSaleItem = SaleItemRow & {
  product: Pick<ProductRow, "id" | "description" | "barcode"> | null
}

export type CustomerSale = SaleRow & {
  items: CustomerSaleItem[]
}

export type CustomerHistory = {
  customer: Customer
  totalSpent: number
  salesCount: number
  sales: CustomerSale[]
}

export type ActionResult<T> =
  | { data: T; error: null; message: string }
  | { data: null; error: string; message: string }

function toNullableText(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null
}

function toCustomerPayload(data: CustomerFormData) {
  return {
    name: data.name.trim(),
    cpf: data.cpf,
    phone: data.phone,
    email: toNullableText(data.email),
    deleted_at: null,
  } satisfies Database["public"]["Tables"]["customers"]["Insert"]
}

function isDuplicateCpfError(message: string | undefined) {
  return (message ?? "").includes("customers_cpf_active_unique")
}

function getCustomerMutationErrorMessage(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? ""

  if (isDuplicateCpfError(message)) {
    return "Já existe um cliente ativo com este CPF."
  }

  if (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    message.includes("Could not find the table") ||
    message.includes("customers")
  ) {
    return "O banco ainda não foi atualizado para clientes. Aplique a migration 016_customers_and_sale_link.sql no Supabase."
  }

  if (message.includes("row-level security")) {
    return "Seu usuário não tem permissão para cadastrar clientes. Verifique as políticas RLS da migration de clientes."
  }

  return "Não foi possível salvar o cliente."
}

export async function getCustomers(
  filters: CustomerSearchInput = { status: "active" },
): Promise<ActionResult<Customer[]>> {
  try {
    const supabase = await createClient()
    let query = supabase.from("customers").select("*").order("name", { ascending: true })

    if (filters.status === "active") {
      query = query.is("deleted_at", null)
    } else if (filters.status === "inactive") {
      query = query.not("deleted_at", "is", null)
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim()
      const digits = onlyDigits(search)
      const terms = [
        `name.ilike.%${search}%`,
        `email.ilike.%${search}%`,
        digits ? `cpf.ilike.%${digits}%` : null,
        digits ? `phone.ilike.%${digits}%` : null,
      ].filter((term): term is string => Boolean(term))

      query = query.or(terms.join(","))
    }

    const { data, error } = await query

    if (error || !data) {
      return {
        data: null,
        error: "Não foi possível carregar os clientes.",
        message: "Erro ao carregar clientes.",
      }
    }

    return {
      data,
      error: null,
      message: "Clientes carregados com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar os clientes agora.",
      message: "Erro ao carregar clientes.",
    }
  }
}

export async function getCustomerById(id: string): Promise<ActionResult<Customer>> {
  const parsedId = customerIdSchema.safeParse(id)

  if (!parsedId.success) {
    return {
      data: null,
      error: "Cliente inválido.",
      message: "Erro ao carregar cliente.",
    }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", parsedId.data)
      .single()

    if (error || !data) {
      return {
        data: null,
        error: "Cliente não encontrado.",
        message: "Erro ao carregar cliente.",
      }
    }

    return {
      data,
      error: null,
      message: "Cliente carregado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar o cliente agora.",
      message: "Erro ao carregar cliente.",
    }
  }
}

export async function createCustomer(data: CustomerFormData): Promise<ActionResult<Customer>> {
  const parsedCustomer = customerSchema.safeParse(data)

  if (!parsedCustomer.success) {
    return {
      data: null,
      error: parsedCustomer.error.issues[0]?.message ?? "Confira os dados do cliente.",
      message: "Erro ao criar cliente.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: customer, error } = await supabase
      .from("customers")
      .insert(toCustomerPayload(parsedCustomer.data))
      .select()
      .single()

    if (error || !customer) {
      return {
        data: null,
        error: getCustomerMutationErrorMessage(error),
        message: "Erro ao criar cliente.",
      }
    }

    revalidatePath("/clientes")

    return {
      data: customer,
      error: null,
      message: "Cliente criado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível criar o cliente agora.",
      message: "Erro ao criar cliente.",
    }
  }
}

export async function updateCustomer(
  id: string,
  data: CustomerFormData,
): Promise<ActionResult<Customer>> {
  const parsedId = customerIdSchema.safeParse(id)
  const parsedCustomer = customerSchema.safeParse(data)

  if (!parsedId.success || !parsedCustomer.success) {
    return {
      data: null,
      error: parsedCustomer.success
        ? "Cliente inválido."
        : parsedCustomer.error.issues[0]?.message ?? "Confira os dados do cliente.",
      message: "Erro ao atualizar cliente.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: customer, error } = await supabase
      .from("customers")
      .update(toCustomerPayload(parsedCustomer.data))
      .eq("id", parsedId.data)
      .select()
      .single()

    if (error || !customer) {
      return {
        data: null,
        error: getCustomerMutationErrorMessage(error),
        message: "Erro ao atualizar cliente.",
      }
    }

    revalidatePath("/clientes")
    revalidatePath(`/clientes/${parsedId.data}`)

    return {
      data: customer,
      error: null,
      message: "Cliente atualizado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível atualizar o cliente agora.",
      message: "Erro ao atualizar cliente.",
    }
  }
}

export async function deleteCustomer(id: string): Promise<ActionResult<void>> {
  const parsedId = customerIdSchema.safeParse(id)

  if (!parsedId.success) {
    return {
      data: null,
      error: "Cliente inválido.",
      message: "Erro ao inativar cliente.",
    }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsedId.data)
      .is("deleted_at", null)

    if (error) {
      return {
        data: null,
        error: "Não foi possível inativar o cliente.",
        message: "Erro ao inativar cliente.",
      }
    }

    revalidatePath("/clientes")
    revalidatePath(`/clientes/${parsedId.data}`)

    return {
      data: undefined,
      error: null,
      message: "Cliente inativado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível inativar o cliente agora.",
      message: "Erro ao inativar cliente.",
    }
  }
}

export async function getCustomerHistory(id: string): Promise<ActionResult<CustomerHistory>> {
  const customerResult = await getCustomerById(id)

  if (customerResult.error || !customerResult.data) {
    return {
      data: null,
      error: customerResult.error ?? "Cliente não encontrado.",
      message: "Erro ao carregar histórico.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("*")
      .eq("customer_id", customerResult.data.id)
      .order("created_at", { ascending: false })

    if (salesError || !sales) {
      return {
        data: null,
        error: "Não foi possível carregar as vendas do cliente.",
        message: "Erro ao carregar histórico.",
      }
    }

    const saleIds = sales.map((sale) => sale.id)
    const { data: items, error: itemsError } = saleIds.length
      ? await supabase
          .from("sale_items")
          .select("*, product:products(id, description, barcode)")
          .in("sale_id", saleIds)
      : { data: [], error: null }

    if (itemsError || !items) {
      return {
        data: null,
        error: "Não foi possível carregar os produtos comprados.",
        message: "Erro ao carregar histórico.",
      }
    }

    const completedSales = sales.filter((sale) => sale.status === "completed")

    return {
      data: {
        customer: customerResult.data,
        totalSpent: completedSales.reduce((total, sale) => total + sale.total - sale.discount, 0),
        salesCount: completedSales.length,
        sales: sales.map((sale) => ({
          ...sale,
          items: items.filter((item) => item.sale_id === sale.id),
        })),
      },
      error: null,
      message: "Histórico carregado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar o histórico agora.",
      message: "Erro ao carregar histórico.",
    }
  }
}
