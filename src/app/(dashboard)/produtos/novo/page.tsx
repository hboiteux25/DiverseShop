import { getSuppliers } from "@/app/actions/suppliers"
import { ProductForm } from "@/components/produtos/product-form"

export default async function NewProductPage() {
  const suppliersResult = await getSuppliers()

  return (
    <main className="flex w-full flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-indigo-700">Produtos</p>
        <h1 className="text-2xl font-bold text-slate-950">Novo produto</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Cadastre produtos vinculando um fornecedor já registrado no sistema.
        </p>
      </section>

      {suppliersResult.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {suppliersResult.error}
        </div>
      ) : null}

      <ProductForm suppliers={suppliersResult.data ?? []} />
    </main>
  )
}
