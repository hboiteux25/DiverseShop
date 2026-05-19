import { z } from "zod"

import { USER_ROLES } from "@/lib/permissions/shared"

export const screenPermissionUpdateSchema = z.object({
  role: z.enum(["operator"], {
    error: "Perfil inválido para configuração de telas.",
  }),
  screenId: z.string().min(1, "Tela inválida."),
  canAccess: z.boolean({
    error: "Informe se o acesso deve ser habilitado ou removido.",
  }),
})

export const userCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(80, "Nome deve ter no máximo 80 caracteres"),
  email: z.string().trim().email("Informe um email válido"),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
  role: z.enum(USER_ROLES, {
    error: "Perfil inválido.",
  }),
})

export type ScreenPermissionUpdateInput = z.infer<typeof screenPermissionUpdateSchema>
export type UserCreateInput = z.infer<typeof userCreateSchema>
