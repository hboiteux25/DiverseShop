import { z } from "zod"

import { postgresUuid } from "@/lib/validations/shared"

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  postgresUuid("Fornecedor inválido").optional(),
)

const optionalPositiveInteger = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int("Número da caixa deve ser inteiro").positive("Número da caixa deve ser positivo").optional(),
)

const optionalPositiveMoney = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().positive("Valor de compra deve ser positivo").optional(),
)

export const stockMovementSchema = z.object({
  product_id: postgresUuid("Produto inválido"),
  type: z.enum(["in", "out", "adjustment"]),
  quantity: z.coerce.number().int("Quantidade deve ser inteira").positive("Quantidade deve ser positiva"),
  reason: z.string().trim().optional(),
})

export const stockEntrySchema = z.object({
  product_id: postgresUuid("Produto inválido"),
  quantity: z.coerce.number().int("Quantidade deve ser inteira").positive("Quantidade deve ser positiva"),
  reason: z.string().trim().optional(),
  box_number: optionalPositiveInteger,
  supplier_id: optionalUuid,
  purchase_price: optionalPositiveMoney,
})

export const stockAdjustmentSchema = z.object({
  product_id: postgresUuid("Produto inválido"),
  new_quantity: z.coerce.number().int("Novo estoque deve ser inteiro").min(0, "Novo estoque não pode ser negativo"),
  reason: z.string().trim().min(8, "Informe uma justificativa com ao menos 8 caracteres"),
  password: z.string().min(1, "Confirme sua senha de administrador"),
})

export type StockMovementFormData = z.infer<typeof stockMovementSchema>
export type StockEntryFormInput = z.input<typeof stockEntrySchema>
export type StockEntryFormData = z.infer<typeof stockEntrySchema>
export type StockAdjustmentFormInput = z.input<typeof stockAdjustmentSchema>
export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>
