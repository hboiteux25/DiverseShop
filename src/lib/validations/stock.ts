import { z } from "zod"

export const stockMovementSchema = z.object({
  product_id: z.string().uuid("Produto inválido"),
  type: z.enum(["in", "out", "adjustment"]),
  quantity: z.number().int().positive("Quantidade deve ser positiva"),
  reason: z.string().optional(),
})

export type StockMovementFormData = z.infer<typeof stockMovementSchema>
