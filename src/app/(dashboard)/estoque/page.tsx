import Link from "next/link"
import { AlertTriangle, Boxes, DollarSign, PackageX, TrendingUp } from "lucide-react"

import {
  getLowStockProducts,
  getOutOfStockProducts,
  getStockMovements,
  getStockProducts,
  type StockProduct,
} from "@/app/actions/stock"
import { getSuppliers } from "@/app/actions/suppliers"
import { StockAdjustmentDialog } from "@/components/estoque/stock-adjustment-dialog"
import { StockEntryForm } from "@/components/estoque/stock-entry-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type StockPageProps = {
  searchParams: Promise<{
    tab?: string
    from?: string
    to?: string
    type?: "in" | "out" | "adjustment" | "all"
  }>
}

const MOVEMENT_LABELS = {
  in: "Entrada",
  out: "Saída",
  adjustment: "Ajuste",
}

function getMovementLabel(type: string) {
  if (type === "in" || type === "out" || type === "adjustment") {
    return MOVEMENT_LABELS[type]
  }

  return "Movimentação"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function getSummary(products: StockProduct[]) {
  return products.reduce(
    (summary, product) => ({
      totalProducts: summary.totalProducts + 1,
      totalUnits: summary.totalUnits + product.stock_quantity,
      costValue: summary.costValue + product.stock_quantity * product.purchase_price,
      saleValue: summary.saleValue + product.stock_quantity * product.sale_price,
      potentialProfit:
        summary.potentialProfit +
        product.stock_quantity * (product.sale_price - product.purchase_price),
    }),
    {
      totalProducts: 0,
      totalUnits: 0,
      costValue: 0,
      saleValue: 0,
      potentialProfit: 0,
    },
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string
  value: string
  subtitle: string
  icon: typeof Boxes
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{subtitle}</p>
    </div>
  )
}

function StockStatusBadge({ product }: { product: StockProduct }) {
  if (product.stock_quantity === 0) {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        Sem estoque
      </Badge>
    )
  }

  if (product.stock_quantity <= product.min_stock) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        Estoque baixo
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
      Em estoque
    </Badge>
  )
}

function ProductTable({ products }: { products: StockProduct[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead>Produto</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Estoque</TableHead>
            <TableHead>Mínimo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length > 0 ? (
            products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <p className="font-medium text-slate-950">{product.description}</p>
                  <p className="text-xs text-slate-500">
                    Código: {product.barcode ?? "não informado"} • Caixa: {product.box_number ?? "-"}
                  </p>
                </TableCell>
                <TableCell>{product.supplier_name ?? "Não informado"}</TableCell>
                <TableCell className="font-mono">{product.stock_quantity}</TableCell>
                <TableCell className="font-mono">{product.min_stock}</TableCell>
                <TableCell>
                  <StockStatusBadge product={product} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/estoque?tab=entrada">Entrada rápida</Link>
                    </Button>
                    <StockAdjustmentDialog product={product} />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                Nenhum produto nesta condição.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function StockPage({ searchParams }: StockPageProps) {
  const params = await searchParams
  const activeTab = params.tab ?? "geral"
  const movementType = params.type ?? "all"
  const [
    productsResult,
    lowStockResult,
    outOfStockResult,
    movementsResult,
    suppliersResult,
  ] = await Promise.all([
    getStockProducts(),
    getLowStockProducts(),
    getOutOfStockProducts(),
    getStockMovements(undefined, { from: params.from, to: params.to }, movementType),
    getSuppliers(),
  ])

  const products = productsResult.data ?? []
  const lowStockProducts = lowStockResult.data ?? []
  const outOfStockProducts = outOfStockResult.data ?? []
  const criticalProducts = [...outOfStockProducts, ...lowStockProducts]
  const movements = movementsResult.data ?? []
  const suppliers = suppliersResult.data ?? []
  const summary = getSummary(products)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Controle de estoque</h2>
          <p className="text-sm text-slate-500">
            Acompanhe saldos, reposições, inventário e histórico de movimentações.
          </p>
        </div>
        <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Link href="/estoque?tab=entrada">Registrar entrada</Link>
        </Button>
      </div>

      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 lg:grid-cols-4">
          <TabsTrigger value="geral" asChild>
            <Link href="/estoque?tab=geral">Visão Geral</Link>
          </TabsTrigger>
          <TabsTrigger value="critico" asChild>
            <Link href="/estoque?tab=critico">Estoque Crítico</Link>
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" asChild>
            <Link href="/estoque?tab=movimentacoes">Movimentações</Link>
          </TabsTrigger>
          <TabsTrigger value="entrada" asChild>
            <Link href="/estoque?tab=entrada">Entrada de Mercadoria</Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              title="Total de produtos"
              value={String(summary.totalProducts)}
              subtitle="Produtos ativos no cadastro"
              icon={Boxes}
            />
            <SummaryCard
              title="Total de unidades"
              value={String(summary.totalUnits)}
              subtitle="Soma do estoque disponível"
              icon={PackageX}
            />
            <SummaryCard
              title="Valor em custo"
              value={formatCurrency(summary.costValue)}
              subtitle="Baseado no valor de compra"
              icon={DollarSign}
            />
            <SummaryCard
              title="Valor em venda"
              value={formatCurrency(summary.saleValue)}
              subtitle="Potencial bruto em estoque"
              icon={TrendingUp}
            />
            <SummaryCard
              title="Lucro potencial"
              value={formatCurrency(summary.potentialProfit)}
              subtitle="Diferença entre venda e custo"
              icon={AlertTriangle}
            />
          </div>
        </TabsContent>

        <TabsContent value="critico" className="mt-5">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">Produtos sem estoque</p>
              <p className="mt-2 text-3xl font-bold text-red-800">{outOfStockProducts.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-700">Produtos abaixo do mínimo</p>
              <p className="mt-2 text-3xl font-bold text-amber-800">{lowStockProducts.length}</p>
            </div>
          </div>
          <ProductTable products={criticalProducts} />
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-5">
          <form className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_1fr_auto]">
            <input type="hidden" name="tab" value="movimentacoes" />
            <div className="grid gap-2">
              <Label htmlFor="from">De</Label>
              <Input id="from" name="from" type="date" defaultValue={params.from ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to">Até</Label>
              <Input id="to" name="to" type="date" defaultValue={params.to ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Tipo</Label>
              <select
                id="type"
                name="type"
                defaultValue={movementType}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">Todos</option>
                <option value="in">Entrada</option>
                <option value="out">Saída</option>
                <option value="adjustment">Ajuste</option>
              </select>
            </div>
            <Button type="submit" className="self-end bg-indigo-600 text-white hover:bg-indigo-700">
              Filtrar
            </Button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length > 0 ? (
                  movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="text-slate-600">
                        {formatDateTime(movement.created_at)}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-950">{movement.product_description}</p>
                        <p className="text-xs text-slate-500">
                          {movement.product_barcode ?? "sem código"}
                        </p>
                      </TableCell>
                      <TableCell>{getMovementLabel(movement.type)}</TableCell>
                      <TableCell className="font-mono">{movement.quantity}</TableCell>
                      <TableCell>{movement.reason ?? "-"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                      Nenhuma movimentação encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="entrada" className="mt-5">
          <StockEntryForm products={products} suppliers={suppliers} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
