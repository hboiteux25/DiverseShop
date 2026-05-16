import { getProducts, type ProductStatus } from "@/app/actions/products"
import { getSuppliers } from "@/app/actions/suppliers"
import { ProductFilters } from "@/components/produtos/product-filters"
import { ProductsTable } from "@/components/produtos/products-table"

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string
    supplier?: string
    status?: string
  }>
}

function parseStatus(status: string | undefined): ProductStatus | "all" {
  if (status === "in_stock" || status === "low_stock" || status === "out_of_stock") {
    return status
  }

  return "all"
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams
  const [productsResult, suppliersResult] = await Promise.all([
    getProducts({
      search: params.q,
      supplierId: params.supplier,
      status: parseStatus(params.status),
    }),
    getSuppliers(),
  ])

  return (
    <main className="flex w-full flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-indigo-700">Catálogo</p>
        <h1 className="text-2xl font-bold text-slate-950">Produtos</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Consulte, filtre, importe e gerencie produtos, preços e estoque da loja.
        </p>
      </section>

      {productsResult.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {productsResult.error}
        </div>
      ) : null}

      <ProductFilters suppliers={suppliersResult.data ?? []} />
      <ProductsTable products={productsResult.data ?? []} />
    </main>
  )
}
