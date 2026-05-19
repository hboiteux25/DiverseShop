import { LoginForm } from "@/components/auth/login-form"
import { PageTransition } from "@/components/layout/page-transition"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const OPERATION_CARDS = [
  ["Vendas", "Atendimento ágil"],
  ["Estoque", "Reposição clara"],
  ["Caixa", "Fechamento seguro"],
] as const

export default async function LoginPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_55%,#f8fafc_100%)] text-slate-950">
      <PageTransition className="min-h-screen">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white text-sm font-bold text-indigo-700 shadow-sm ring-1 ring-slate-200">
              DS
            </span>
            <div>
              <p className="font-semibold text-slate-950">Diverse Shop DF</p>
              <p className="text-sm text-slate-500">Sistema corporativo de gestão</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:inline-flex">
            Acesso seguro
          </span>
        </header>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="hidden lg:block">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
              Operação da loja
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight text-slate-950">
              Gestão clara para vender, repor e fechar o caixa com confiança.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Uma interface objetiva para a rotina da Diverse Shop DF, com foco em leitura rápida,
              ações diretas e dados importantes sempre à vista.
            </p>

            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
              {OPERATION_CARDS.map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm"
                >
                  <p className="text-sm font-medium text-indigo-700">{title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <Card className="w-full rounded-2xl border border-slate-200 bg-white py-0 shadow-xl shadow-slate-200/80">
            <CardHeader className="gap-3 border-b border-slate-100 px-6 py-6 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-lg font-bold text-white shadow-sm">
                DS
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-700">Diverse Shop DF</p>
                <CardTitle className="text-2xl font-bold text-slate-950">Entrar no sistema</CardTitle>
              </div>
              <CardDescription className="text-slate-500">
                Entre com a conta criada pelo administrador para usar o painel operacional.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6 py-6">
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </section>
      </PageTransition>
    </main>
  )
}
