import { z } from "zod"

export const cashClosingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  expected_cash: z.coerce.number().min(0, "Dinheiro esperado não pode ser negativo"),
  counted_cash: z.coerce.number().min(0, "Dinheiro contado não pode ser negativo"),
  total_sales: z.coerce.number().min(0, "Total de vendas não pode ser negativo"),
  total_pix: z.coerce.number().min(0, "Total em Pix não pode ser negativo"),
  total_credit: z.coerce.number().min(0, "Total em crédito não pode ser negativo"),
  total_debit: z.coerce.number().min(0, "Total em débito não pode ser negativo"),
  total_discount: z.coerce.number().min(0, "Total de descontos não pode ser negativo"),
  total_card_fees: z.coerce.number().min(0, "Taxas de cartão não podem ser negativas"),
  notes: z.string().trim().optional(),
})

export type CashClosingInput = z.infer<typeof cashClosingSchema>
