import { z } from "zod"

export const productSchema = z.object({
  description: z.string().min(3, "Descrição deve ter ao menos 3 caracteres"),
  barcode: z.string().optional(),
  box_number: z.number().int().positive().optional(),
  purchase_price: z.number().positive("Valor de compra deve ser positivo"),
  sale_price: z.number().positive("Valor de venda deve ser positivo"),
  min_stock: z.number().int().min(0).default(2),
  supplier_id: z.string().uuid("Fornecedor inválido"),
})

export type ProductFormInput = z.input<typeof productSchema>
export type ProductFormData = z.infer<typeof productSchema>
