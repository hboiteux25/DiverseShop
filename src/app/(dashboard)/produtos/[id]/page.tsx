import { notFound } from "next/navigation"

import { getProductDetails } from "@/app/actions/products"
import { getSuppliers } from "@/app/actions/suppliers"
import { ProductForm } from "@/components/produtos/product-form"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ProductEditPageProps {
  params: Promise<{
    id: string
  }>
}

function formatCurrency(value: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

export default async function ProductEditPage({ params }: ProductEditPageProps) {
  const { id } = await params
  const [productResult, suppliersResult] = await Promise.all([
    getProductDetails(id),
    getSuppliers(),
  ])

  if (!productResult.data) {
    notFound()
  }

  const { product, priceHistory, stockMovements } = productResult.data

  return (
    <main className="flex w-full flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-indigo-700">Produtos</p>
        <h1 className="text-2xl font-bold text-slate-950">Editar produto</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Atualize dados cadastrais, preços e configurações de estoque do produto.
        </p>
      </section>

      <ProductForm product={product} suppliers={suppliersResult.data ?? []} />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">Histórico de preços</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Data</TableHead>
              <TableHead>Compra anterior</TableHead>
              <TableHead>Compra nova</TableHead>
              <TableHead>Venda anterior</TableHead>
              <TableHead>Venda nova</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceHistory.length > 0 ? (
              priceHistory.map((history) => (
                <TableRow key={history.id}>
                  <TableCell>{formatDate(history.created_at)}</TableCell>
                  <TableCell>{formatCurrency(history.old_purchase_price)}</TableCell>
                  <TableCell>{formatCurrency(history.new_purchase_price)}</TableCell>
                  <TableCell>{formatCurrency(history.old_sale_price)}</TableCell>
                  <TableCell>{formatCurrency(history.new_sale_price)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                  Nenhuma alteração de preço registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">Movimentações de estoque</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockMovements.length > 0 ? (
              stockMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{formatDate(movement.created_at)}</TableCell>
                  <TableCell>{movement.type}</TableCell>
                  <TableCell>{movement.quantity}</TableCell>
                  <TableCell>{movement.reason ?? "Não informado"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                  Nenhuma movimentação registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  )
}
