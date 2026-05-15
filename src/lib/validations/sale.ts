import { z } from "zod"

export const saleSchema = z.object({
  total: z.number().positive("Total deve ser positivo"),
  discount: z.number().min(0, "Desconto não pode ser negativo").default(0),
  payment_method: z.enum(["cash", "pix", "credit_card", "debit_card"]),
  card_fee_rate: z.number().min(0).nullable(),
  net_received: z.number().min(0, "Valor recebido não pode ser negativo"),
})

export type SaleFormData = z.infer<typeof saleSchema>
