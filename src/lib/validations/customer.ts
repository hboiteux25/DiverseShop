import { z } from "zod"

import { postgresUuid } from "@/lib/validations/shared"

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value)

  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
    return false
  }

  const digits = cpf.split("").map(Number)
  const firstCheck = digits
    .slice(0, 9)
    .reduce((total, digit, index) => total + digit * (10 - index), 0)
  const firstVerifier = (firstCheck * 10) % 11
  const normalizedFirstVerifier = firstVerifier === 10 ? 0 : firstVerifier

  if (normalizedFirstVerifier !== digits[9]) {
    return false
  }

  const secondCheck = digits
    .slice(0, 10)
    .reduce((total, digit, index) => total + digit * (11 - index), 0)
  const secondVerifier = (secondCheck * 10) % 11
  const normalizedSecondVerifier = secondVerifier === 10 ? 0 : secondVerifier

  return normalizedSecondVerifier === digits[10]
}

function nullableEmail(value: unknown) {
  if (typeof value !== "string") {
    return value
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue.toLowerCase() : null
}

function nullableDigits(value: unknown) {
  if (typeof value !== "string") {
    return value
  }

  const digits = onlyDigits(value)
  return digits.length > 0 ? digits : null
}

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres"),
  cpf: z
    .string()
    .transform(onlyDigits)
    .refine((value) => value.length > 0, "CPF é obrigatório")
    .refine(isValidCpf, "Informe um CPF válido"),
  phone: z.preprocess(
    nullableDigits,
    z
      .string()
      .min(10, "Telefone deve ter DDD e número")
      .max(11, "Telefone deve ter no máximo 11 dígitos")
      .nullable(),
  ),
  email: z.preprocess(
    nullableEmail,
    z.string().email("Informe um e-mail válido").nullable(),
  ),
})

export const customerSearchSchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "all"]).default("active"),
})

export const customerIdSchema = postgresUuid("Cliente inválido")

export type CustomerFormData = z.infer<typeof customerSchema>
export type CustomerFormInput = z.input<typeof customerSchema>
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>
