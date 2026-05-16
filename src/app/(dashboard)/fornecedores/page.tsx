import { getSuppliers } from "@/app/actions/suppliers"
import { SuppliersTable } from "@/components/fornecedores/suppliers-table"

export default async function SuppliersPage() {
  const suppliersResult = await getSuppliers()
  const suppliers = suppliersResult.data ?? []

  return (
    <main className="flex w-full flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-indigo-700">Cadastros</p>
          <h1 className="text-2xl font-bold text-slate-950">Fornecedores</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Gerencie contatos, prazos de entrega e fornecedores disponíveis para cadastro de produtos.
          </p>
        </div>
      </section>

      {suppliersResult.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {suppliersResult.error}
        </div>
      ) : null}

      <SuppliersTable suppliers={suppliers} />
    </main>
  )
}
