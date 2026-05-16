import { z } from "zod"

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

const phoneRegex = /^[+]?[\d\s().-]{8,20}$/

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres"),
  contact: optionalText.refine(
    (value) => {
      if (!value) {
        return true
      }

      return z.string().email().safeParse(value).success || phoneRegex.test(value)
    },
    {
      message: "Informe um telefone ou email válido",
    },
  ),
  delivery_days: z.preprocess(
    (value) => {
      if (value === "" || value === null || typeof value === "undefined") {
        return undefined
      }

      return value
    },
    z.coerce
      .number({
        error: "Prazo de entrega deve ser um número",
      })
      .int("Prazo de entrega deve ser um número inteiro")
      .positive("Prazo de entrega deve ser positivo")
      .optional(),
  ),
})

export type SupplierFormInput = z.input<typeof supplierSchema>
export type SupplierFormData = z.infer<typeof supplierSchema>
