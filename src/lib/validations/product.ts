import { z } from "zod"

import { postgresUuid } from "@/lib/validations/shared"

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value
    }

    const trimmedValue = value.trim()
    return trimmedValue.length > 0 ? trimmedValue : undefined
  },
  z.string().optional(),
)

const optionalPositiveInteger = z.preprocess(
  (value) => {
    if (value === "" || value === null || typeof value === "undefined") {
      return undefined
    }

    return value
  },
  z.coerce.number().int("Informe um número inteiro").positive("Informe um número positivo").optional(),
)

export const productSchema = z
  .object({
    description: z.string().trim().min(3, "Descrição deve ter ao menos 3 caracteres"),
    barcode: optionalText,
    box_number: optionalPositiveInteger,
    purchase_price: z.coerce.number().positive("Valor de compra deve ser positivo"),
    sale_price: z.coerce.number().positive("Valor de venda deve ser positivo"),
    stock_quantity: z.coerce
      .number()
      .int("Estoque deve ser um número inteiro")
      .min(0, "Estoque não pode ser negativo")
      .default(0),
    min_stock: z.coerce
      .number()
      .int("Estoque mínimo deve ser um número inteiro")
      .min(0, "Estoque mínimo não pode ser negativo")
      .default(2),
    supplier_id: postgresUuid("Fornecedor inválido"),
  })
  .refine((data) => data.sale_price >= data.purchase_price, {
    message: "Valor de venda deve ser maior ou igual ao valor de compra",
    path: ["sale_price"],
  })

export type ProductFormInput = z.input<typeof productSchema>
export type ProductFormData = z.infer<typeof productSchema>

export const productImportRowSchema = productSchema.extend({
  supplier_name: z.string().trim().min(2, "Fornecedor deve ter ao menos 2 caracteres"),
})

export type ProductImportRow = z.infer<typeof productImportRowSchema>
