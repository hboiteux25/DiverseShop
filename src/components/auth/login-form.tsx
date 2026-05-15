"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { signIn, signUp } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginSchema, type LoginFormData } from "@/lib/validations/auth"

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  })

  async function handleSubmit(data: LoginFormData) {
    form.clearErrors("root")

    const result =
      mode === "sign-up"
        ? await signUp(data.name, data.email, data.password)
        : await signIn(data.name, data.email, data.password)

    if (result.error) {
      form.setError("root", {
        message: result.error,
      })
      return
    }

    router.replace("/dashboard")
    router.refresh()
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
      <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            mode === "sign-in"
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
          onClick={() => setMode("sign-in")}
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
          onClick={() => setMode("sign-up")}
        >
          Criar conta
        </button>
      </div>

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
