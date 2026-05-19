import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-[55vh] items-center justify-center">
      <section className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
          Acesso negado
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-slate-950">Você não tem acesso a esta tela</h1>
          <p className="text-sm text-slate-500">
            Fale com um administrador caso precise liberar esta rota para o seu perfil.
          </p>
        </div>
        <Button asChild>
          <Link href="/vendas">Voltar para Vendas</Link>
        </Button>
      </section>
    </main>
  )
}
