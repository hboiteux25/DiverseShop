import Link from "next/link"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_55%,#f8fafc_100%)] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
        <Card className="w-full rounded-2xl border border-slate-200 bg-white py-0 shadow-xl shadow-slate-200/80">
          <CardHeader className="gap-3 border-b border-slate-100 px-6 py-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-lg font-bold text-white shadow-sm">
              DS
            </div>
            <div>
              <p className="text-sm font-medium text-indigo-700">Diverse Shop DF</p>
              <CardTitle className="text-2xl font-bold text-slate-950">Redefinir senha</CardTitle>
            </div>
            <CardDescription className="text-slate-500">
              Crie uma nova senha para voltar a acessar o sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-6 py-6">
            <ResetPasswordForm />
            <Link
              href="/login"
              className="text-center text-sm font-medium text-indigo-700 transition-colors hover:text-indigo-900"
            >
              Voltar para o login
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
