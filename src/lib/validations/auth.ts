import { z } from "zod"

export const loginSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(80, "Nome deve ter no máximo 80 caracteres"),
  email: z.string().email("Informe um email válido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
})

export type LoginFormData = z.infer<typeof loginSchema>
