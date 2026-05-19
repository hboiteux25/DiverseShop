"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { requestPasswordReset, signIn } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authFormSchema, type AuthFormData } from "@/lib/validations/auth"

export function LoginForm() {
  const router = useRouter()
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const form = useForm<AuthFormData>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function handleSubmit(data: AuthFormData) {
    form.clearErrors("root")
    setResetMessage(null)

    const result = await signIn(data.email, data.password)

    if (result.error) {
      form.setError("root", {
        message: result.error,
      })
      return
    }

    setIsLeaving(true)
    window.setTimeout(() => {
      router.replace("/dashboard")
      router.refresh()
    }, 320)
  }

  async function handlePasswordReset() {
    form.clearErrors("root")
    setResetMessage(null)

    const email = form.getValues("email")
    setIsSendingReset(true)
    const result = await requestPasswordReset(email)
    setIsSendingReset(false)

    if (result.error) {
      form.setError("email", {
        message: result.error,
      })
      return
    }

    setResetMessage("Enviamos um email com o link para redefinir sua senha.")
  }

  return (
    <form
      method="post"
      noValidate
      className={`flex flex-col gap-4 transition-all duration-300 ease-out ${
        isLeaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="voce@diverseshopdf.com"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          aria-invalid={Boolean(form.formState.errors.password)}
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
        ) : null}
        <button
          type="button"
          className="self-start text-sm font-medium text-indigo-700 underline-offset-4 hover:text-indigo-900 hover:underline disabled:opacity-60"
          disabled={isSendingReset}
          onClick={handlePasswordReset}
        >
          {isSendingReset ? "Enviando email..." : "Esqueci minha senha"}
        </button>
      </div>

      {form.formState.errors.root ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{form.formState.errors.root.message}</p>
          <button
            type="button"
            className="mt-2 font-semibold text-red-800 underline-offset-4 hover:underline disabled:opacity-60"
            disabled={isSendingReset}
            onClick={handlePasswordReset}
          >
            {isSendingReset ? "Enviando email..." : "Redefinir minha senha"}
          </button>
        </div>
      ) : null}

      {resetMessage ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
          {resetMessage}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-11 bg-gradient-to-r from-indigo-600 to-sky-500 text-base text-white shadow-sm hover:from-indigo-700 hover:to-sky-600"
        disabled={form.formState.isSubmitting || isLeaving}
      >
        {isLeaving ? (
          <>
            <Loader2 className="animate-spin" />
            Abrindo dashboard
          </>
        ) : form.formState.isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Entrando
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  )
}
