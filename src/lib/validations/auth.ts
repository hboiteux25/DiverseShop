import { z } from "zod"

const emailSchema = z.string().email("Informe um email válido")
const passwordSchema = z.string().min(6, "A senha deve ter ao menos 6 caracteres")
const nameSchema = z
  .string()
  .trim()
  .min(2, "Nome deve ter ao menos 2 caracteres")
  .max(80, "Nome deve ter no máximo 80 caracteres")

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const signUpSchema = signInSchema.extend({
  name: nameSchema,
})

export const authFormSchema = signInSchema
  .extend({
    mode: z.enum(["sign-in", "sign-up"]),
    name: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (data.mode === "sign-in") {
      return
    }

    const parsedName = nameSchema.safeParse(data.name)

    if (!parsedName.success) {
      context.addIssue({
        code: "custom",
        message: parsedName.error.issues[0]?.message ?? "Informe seu nome",
        path: ["name"],
      })
    }
  })

export type AuthFormData = z.infer<typeof authFormSchema>
