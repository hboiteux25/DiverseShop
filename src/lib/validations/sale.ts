import { z } from "zod"

import { postgresUuid } from "@/lib/validations/shared"

export const paymentMethodSchema = z.enum([
  "cash",
  "pix",
  "credit_card",
  "debit_card",
  "mixed",
])

export const saleItemInputSchema = z.object({
  product_id: postgresUuid("Produto inválido"),
  quantity: z.coerce
    .number()
    .int("Quantidade deve ser um número inteiro")
    .positive("Quantidade deve ser maior que zero"),
  unit_price: z.coerce.number().positive("Preço unitário deve ser positivo"),
  discount: z.coerce.number().min(0, "Desconto não pode ser negativo").default(0),
})

export const paymentDetailsSchema = z.object({
  cash: z.coerce.number().min(0, "Valor em dinheiro não pode ser negativo").default(0),
  pix: z.coerce.number().min(0, "Valor em Pix não pode ser negativo").default(0),
  credit_card: z.coerce.number().min(0, "Valor no crédito não pode ser negativo").default(0),
  debit_card: z.coerce.number().min(0, "Valor no débito não pode ser negativo").default(0),
})

export const saleInputSchema = z
  .object({
    items: z.array(saleItemInputSchema).min(1, "Adicione ao menos um produto ao carrinho"),
    payment_method: paymentMethodSchema,
    discount: z.coerce.number().min(0, "Desconto geral não pode ser negativo").default(0),
    card_fee_rate: z.coerce.number().min(0, "Taxa de cartão inválida").nullable().default(null),
    payment_details: paymentDetailsSchema.default({
      cash: 0,
      pix: 0,
      credit_card: 0,
      debit_card: 0,
    }),
  })
  .superRefine((data, context) => {
    const subtotal = data.items.reduce(
      (total, item) => total + item.quantity * item.unit_price - item.discount,
      0,
    )

    if (data.discount > subtotal) {
      context.addIssue({
        code: "custom",
        message: "Desconto geral não pode ser maior que o subtotal",
        path: ["discount"],
      })
    }

    if (data.payment_method === "mixed") {
      const paidTotal =
        data.payment_details.cash +
        data.payment_details.pix +
        data.payment_details.credit_card +
        data.payment_details.debit_card

      if (Math.abs(paidTotal - (subtotal - data.discount)) > 0.01) {
        context.addIssue({
          code: "custom",
          message: "Os valores do pagamento misto precisam fechar com o total",
          path: ["payment_details"],
        })
      }
    }
  })

export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export type SaleItemInput = z.infer<typeof saleItemInputSchema>
export type SaleInput = z.infer<typeof saleInputSchema>
