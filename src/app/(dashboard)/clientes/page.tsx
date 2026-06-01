import { getCustomers } from "@/app/actions/customers"
import { CustomersTable } from "@/components/clientes/customers-table"

type CustomersPageProps = {
  searchParams: Promise<{
    q?: string
    status?: "active" | "inactive" | "all"
  }>
}

function parseStatus(status: string | undefined) {
  if (status === "inactive" || status === "all") {
    return status
  }

  return "active"
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams
  const customersResult = await getCustomers({
    search: params.q,
    status: parseStatus(params.status),
  })

  return (
    <main className="flex w-full flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-indigo-700">Relacionamento</p>
        <h1 className="text-2xl font-bold text-slate-950">Clientes</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Cadastre, encontre e acompanhe clientes para agilizar vendas e consultar histórico de compras.
        </p>
      </section>

      {customersResult.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {customersResult.error}
        </div>
      ) : null}

      <CustomersTable customers={customersResult.data ?? []} />
    </main>
  )
}
