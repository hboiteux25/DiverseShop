"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import { supplierSchema, type SupplierFormData } from "@/lib/validations/supplier"

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"]

export type Supplier = SupplierRow & {
  product_count: number
}

export type ActionResult<T> =
  | { data: T; error: null; message: string }
  | { data: null; error: string; message: string }

function toSupplierPayload(data: SupplierFormData) {
  return {
    name: data.name.trim(),
    contact: data.contact ?? null,
    delivery_days: data.delivery_days ?? null,
  } satisfies Database["public"]["Tables"]["suppliers"]["Insert"]
}

async function getProductCountsBySupplier() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("products").select("supplier_id")

  if (error) {
    return null
  }

  return data.reduce<Record<string, number>>((counts, product) => {
    if (product.supplier_id) {
      counts[product.supplier_id] = (counts[product.supplier_id] ?? 0) + 1
    }

    return counts
  }, {})
}

export async function getSuppliers(): Promise<ActionResult<Supplier[]>> {
  try {
    const supabase = await createClient()
    const [{ data, error }, productCounts] = await Promise.all([
      supabase.from("suppliers").select("*").order("name", { ascending: true }),
      getProductCountsBySupplier(),
    ])

    if (error || !productCounts) {
      return {
        data: null,
        error: "Não foi possível carregar os fornecedores.",
        message: "Erro ao carregar fornecedores.",
      }
    }

    const suppliers = data.map((supplier) => ({
      ...supplier,
      product_count: productCounts[supplier.id] ?? 0,
    }))

    return {
      data: suppliers,
      error: null,
      message: "Fornecedores carregados com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível carregar os fornecedores agora.",
      message: "Erro ao carregar fornecedores.",
    }
  }
}

export async function createSupplier(data: SupplierFormData): Promise<ActionResult<Supplier>> {
  const parsedSupplier = supplierSchema.safeParse(data)

  if (!parsedSupplier.success) {
    return {
      data: null,
      error: "Confira os dados do fornecedor antes de salvar.",
      message: "Erro ao criar fornecedor.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: supplier, error } = await supabase
      .from("suppliers")
      .insert(toSupplierPayload(parsedSupplier.data))
      .select()
      .single()

    if (error || !supplier) {
      return {
        data: null,
        error: "Não foi possível criar o fornecedor.",
        message: "Erro ao criar fornecedor.",
      }
    }

    revalidatePath("/fornecedores")
    revalidatePath("/produtos/novo")

    return {
      data: {
        ...supplier,
        product_count: 0,
      },
      error: null,
      message: "Fornecedor criado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível criar o fornecedor agora.",
      message: "Erro ao criar fornecedor.",
    }
  }
}

export async function updateSupplier(
  id: string,
  data: SupplierFormData,
): Promise<ActionResult<Supplier>> {
  const parsedSupplier = supplierSchema.safeParse(data)

  if (!parsedSupplier.success) {
    return {
      data: null,
      error: "Confira os dados do fornecedor antes de salvar.",
      message: "Erro ao atualizar fornecedor.",
    }
  }

  try {
    const supabase = await createClient()
    const { data: supplier, error } = await supabase
      .from("suppliers")
      .update(toSupplierPayload(parsedSupplier.data))
      .eq("id", id)
      .select()
      .single()

    if (error || !supplier) {
      return {
        data: null,
        error: "Não foi possível atualizar o fornecedor.",
        message: "Erro ao atualizar fornecedor.",
      }
    }

    const productCounts = await getProductCountsBySupplier()

    revalidatePath("/fornecedores")
    revalidatePath("/produtos/novo")

    return {
      data: {
        ...supplier,
        product_count: productCounts?.[supplier.id] ?? 0,
      },
      error: null,
      message: "Fornecedor atualizado com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível atualizar o fornecedor agora.",
      message: "Erro ao atualizar fornecedor.",
    }
  }
}

export async function deleteSupplier(id: string): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from("suppliers").delete().eq("id", id)

    if (error) {
      return {
        data: null,
        error:
          "Não foi possível excluir o fornecedor. Verifique se há produtos vinculados a ele.",
        message: "Erro ao excluir fornecedor.",
      }
    }

    revalidatePath("/fornecedores")
    revalidatePath("/produtos/novo")

    return {
      data: undefined,
      error: null,
      message: "Fornecedor excluído com sucesso.",
    }
  } catch {
    return {
      data: null,
      error: "Não foi possível excluir o fornecedor agora.",
      message: "Erro ao excluir fornecedor.",
    }
  }
}
