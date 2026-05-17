"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { requestPasswordReset, signIn, signUp } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authFormSchema, type AuthFormData } from "@/lib/validations/auth"

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const form = useForm<AuthFormData>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      mode: "sign-in",
      name: "",
      email: "",
      password: "",
    },
  })

  async function handleSubmit(data: AuthFormData) {
    form.clearErrors("root")
    setSuccessMessage(null)
    setResetMessage(null)

    const currentMode = data.mode
    const result =
      currentMode === "sign-up"
        ? await signUp(data.name ?? "", data.email, data.password)
        : await signIn(data.email, data.password)

    if (result.error) {
      form.setError("root", {
        message: result.error,
      })
      return
    }

    if (currentMode === "sign-up") {
      setMode("sign-in")
      form.reset({
        mode: "sign-in",
        name: "",
        email: "",
        password: "",
      })
      setSuccessMessage("Conta criada com sucesso. Entre com email e senha para continuar.")
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
      className={`flex flex-col gap-4 transition-all duration-300 ease-out ${
        isLeaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            mode === "sign-in"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
          onClick={() => {
            setMode("sign-in")
            form.setValue("mode", "sign-in")
            form.clearErrors("name")
            form.clearErrors("root")
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            mode === "sign-up"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
          onClick={() => {
            setMode("sign-up")
            form.setValue("mode", "sign-up")
            form.clearErrors("root")
            setSuccessMessage(null)
          }}
        >
          Criar conta
        </button>
      </div>

      {mode === "sign-up" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Seu nome"
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
      ) : null}

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
        {mode === "sign-in" ? (
          <button
            type="button"
            className="self-start text-sm font-medium text-indigo-700 underline-offset-4 hover:text-indigo-900 hover:underline disabled:opacity-60"
            disabled={isSendingReset}
            onClick={handlePasswordReset}
          >
            {isSendingReset ? "Enviando email..." : "Esqueci minha senha"}
          </button>
        ) : null}
      </div>

      {form.formState.errors.root ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{form.formState.errors.root.message}</p>
          {mode === "sign-in" ? (
            <button
              type="button"
              className="mt-2 font-semibold text-red-800 underline-offset-4 hover:underline disabled:opacity-60"
              disabled={isSendingReset}
              onClick={handlePasswordReset}
            >
              {isSendingReset ? "Enviando email..." : "Redefinir minha senha"}
            </button>
          ) : null}
        </div>
      ) : null}

      {resetMessage ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
          {resetMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
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
            {mode === "sign-up" ? "Criando conta" : "Entrando"}
          </>
        ) : mode === "sign-up" ? (
          "Criar conta"
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  )
}
