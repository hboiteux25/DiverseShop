"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import {
  updatePasswordSchema,
  type UpdatePasswordFormData,
} from "@/lib/validations/auth"

export function ResetPasswordForm() {
  const router = useRouter()
  const form = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  async function handleSubmit(data: UpdatePasswordFormData) {
    form.clearErrors("root")

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    })

    if (error) {
      form.setError("root", {
        message: "O link expirou ou não é válido. Solicite uma nova redefinição de senha.",
      })
      return
    }

    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Digite a nova senha"
          aria-invalid={Boolean(form.formState.errors.password)}
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          aria-invalid={Boolean(form.formState.errors.confirmPassword)}
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="text-sm text-red-600">
            {form.formState.errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      {form.formState.errors.root ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {form.formState.errors.root.message}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-11 bg-gradient-to-r from-indigo-600 to-sky-500 text-base text-white shadow-sm hover:from-indigo-700 hover:to-sky-600"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Salvando senha
          </>
        ) : (
          "Salvar nova senha"
        )}
      </Button>
    </form>
  )
}
