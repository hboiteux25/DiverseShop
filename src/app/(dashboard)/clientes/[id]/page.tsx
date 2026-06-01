import Link from "next/link"
import { notFound } from "next/navigation"

import { getCustomerHistory } from "@/app/actions/customers"
import { CustomerForm } from "@/components/clientes/customer-form"
import {
  formatCpf,
  formatCurrency,
  formatDateTime,
  formatPhone,
} from "@/components/clientes/customer-formatters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CustomerDetailsPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function CustomerDetailsPage({ params }: CustomerDetailsPageProps) {
  const { id } = await params
  const historyResult = await getCustomerHistory(id)

  if (historyResult.error || !historyResult.data) {
    notFound()
  }

  const { customer, sales, totalSpent, salesCount } = historyResult.data

  return (
    <main className="flex w-full flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-700">Cliente</p>
            <h1 className="text-2xl font-bold text-slate-950">{customer.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="font-mono">{formatCpf(customer.cpf)}</span>
              <span>{customer.phone ? formatPhone(customer.phone) : "Telefone não informado"}</span>
              <span>{customer.email ?? "E-mail não informado"}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge
              variant="outline"
              className={
                customer.deleted_at
                  ? "border-slate-200 bg-slate-50 text-slate-600"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }
            >
              {customer.deleted_at ? "Inativo" : "Ativo"}
            </Badge>
            <Button asChild type="button" variant="outline">
              <Link href="/clientes">Voltar</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total gasto</p>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-950">
            {formatCurrency(totalSpent)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Vendas realizadas</p>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-950">{salesCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Última compra</p>
          <p className="mt-2 font-mono text-lg font-semibold text-slate-950">
            {sales[0] ? formatDateTime(sales[0].created_at) : "Sem compras"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.15fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Dados do cliente</h2>
          <p className="mt-1 text-sm text-slate-500">
            Edite os dados usados na busca e no vínculo de vendas.
          </p>
          <div className="mt-4">
            <CustomerForm customer={customer} submitLabel="Salvar cliente" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Histórico de compras</h2>
            <p className="text-sm text-slate-500">
              Vendas vinculadas a este cliente e produtos comprados.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                <TableHead className="px-4 py-3 text-slate-600">Data</TableHead>
                <TableHead className="px-4 py-3 text-slate-600">Produtos</TableHead>
                <TableHead className="px-4 py-3 text-right text-slate-600">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length > 0 ? (
                sales.map((sale) => (
                  <TableRow key={sale.id} className="border-slate-100 align-top hover:bg-slate-50">
                    <TableCell className="px-4 py-3 font-mono text-sm text-slate-600">
                      {formatDateTime(sale.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-700">
                      <div className="grid gap-1">
                        {sale.items.map((item) => (
                          <span key={item.id}>
                            {item.quantity}x {item.product?.description ?? "Produto removido"}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono font-semibold text-slate-950">
                      {formatCurrency(sale.total - sale.discount)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="px-4 py-10 text-center text-slate-500">
                    Nenhuma venda vinculada a este cliente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  )
}
