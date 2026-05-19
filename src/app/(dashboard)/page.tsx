import { Suspense } from "react"
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarDays,
  PackageX,
  TrendingUp,
} from "lucide-react"

import { KpiCard, KpiCardSkeleton } from "@/components/layout/kpi-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"

type Sale = Tables<"sales">
type LowStockProduct = Tables<"products">

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatPaymentMethod(method: string) {
  const labels: Record<string, string> = {
    cash: "Dinheiro",
    pix: "Pix",
    credit_card: "Crédito",
    debit_card: "Débito",
    mixed: "Misto",
  }

  return labels[method] ?? "Outro"
}

function getDayBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start)
  end.setDate(start.getDate() + 1)

  return { start, end }
}

function sumCompletedSales(sales: Sale[]) {
  return sales
    .filter((sale) => sale.status === "completed")
    .reduce((total, sale) => total + sale.net_received, 0)
}

function getMetadataName(metadata: unknown) {
  if (typeof metadata !== "object" || metadata === null || !("name" in metadata)) {
    return null
  }

  const name = metadata.name

  return typeof name === "string" && name.trim().length > 0 ? name : null
}

function getTrend(
  todayRevenue: number,
  yesterdayRevenue: number,
): { trend: "up" | "down" | "neutral"; value: string } {
  if (yesterdayRevenue === 0 && todayRevenue === 0) {
    return { trend: "neutral", value: "0%" }
  }

  if (yesterdayRevenue === 0) {
    return { trend: "up", value: "+100%" }
  }

  const percentage = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
  const trend = percentage > 0 ? "up" : percentage < 0 ? "down" : "neutral"
  const sign = percentage > 0 ? "+" : ""

  return { trend, value: `${sign}${percentage.toFixed(0)}%` }
}

async function getDashboardData() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const now = new Date()
    const today = getDayBounds(now)
    const yesterdayDate = new Date(today.start)
    yesterdayDate.setDate(today.start.getDate() - 1)
    const yesterday = getDayBounds(yesterdayDate)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const [
      todaySalesResult,
      yesterdaySalesResult,
      monthSalesResult,
      recentSalesResult,
      lowStockResult,
      profileResult,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("*")
        .gte("created_at", today.start.toISOString())
        .lt("created_at", today.end.toISOString()),
      supabase
        .from("sales")
        .select("*")
        .gte("created_at", yesterday.start.toISOString())
        .lt("created_at", yesterday.end.toISOString()),
      supabase
        .from("sales")
        .select("*")
        .gte("created_at", monthStart.toISOString())
        .lt("created_at", nextMonthStart.toISOString()),
      supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(5),
      supabase
        .from("products")
        .select("*")
        .in("status", ["out_of_stock", "low_stock"])
        .order("stock_quantity", { ascending: true })
        .limit(6),
      user
        ? supabase.from("profiles").select("name").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const profile = profileResult.data
    const todaySales = todaySalesResult.data ?? []
    const yesterdaySales = yesterdaySalesResult.data ?? []
    const monthSales = monthSalesResult.data ?? []
    const recentSales = recentSalesResult.data ?? []
    const lowStockProducts = lowStockResult.data ?? []
    const completedMonthSaleIds = monthSales
      .filter((sale) => sale.status === "completed")
      .map((sale) => sale.id)

    const saleItemsResult =
      completedMonthSaleIds.length > 0
        ? await supabase
            .from("sale_items")
            .select("quantity, unit_price, discount, products(purchase_price)")
            .in("sale_id", completedMonthSaleIds)
        : { data: null }

    const monthlyProfit =
      saleItemsResult.data?.reduce((total, item) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products
        const purchasePrice = product?.purchase_price ?? 0
        const lineProfit = (item.unit_price - purchasePrice) * item.quantity - item.discount

        return total + lineProfit
      }, 0) ?? 0

    return {
      todayRevenue: sumCompletedSales(todaySales),
      yesterdayRevenue: sumCompletedSales(yesterdaySales),
      monthlyRevenue: sumCompletedSales(monthSales),
      monthlyProfit,
      recentSales,
      lowStockProducts,
      userName: profile?.name ?? getMetadataName(user?.user_metadata) ?? user?.email ?? "usuário",
    }
  } catch {
    return {
      todayRevenue: 0,
      yesterdayRevenue: 0,
      monthlyRevenue: 0,
      monthlyProfit: 0,
      recentSales: [],
      lowStockProducts: [],
      userName: "usuario",
    }
  }
}

function DashboardFallback() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
    </div>
  )
}

async function DashboardContent() {
  const data = await getDashboardData()
  const trend = getTrend(data.todayRevenue, data.yesterdayRevenue)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-indigo-50/70 to-sky-50 p-5 shadow-sm">
        <p className="text-sm font-medium text-indigo-700">Bem-vindo de volta</p>
        <div className="mt-1 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Olá, {data.userName}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Aqui está o resumo operacional da Diverse Shop DF para hoje.
            </p>
          </div>
          <Badge className="w-fit bg-white text-indigo-700 ring-1 ring-indigo-100">
            Visão executiva
          </Badge>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Faturamento Hoje"
          value={formatCurrency(data.todayRevenue)}
          subtitle="comparado com ontem"
          icon={BadgeDollarSign}
          trend={trend.trend}
          trendValue={trend.value}
        />
        <KpiCard
          title="Faturamento do Mês"
          value={formatCurrency(data.monthlyRevenue)}
          subtitle="acumulado no mês"
          icon={CalendarDays}
          trend="neutral"
          trendValue="Mês atual"
        />
        <KpiCard
          title="Produtos em Falta"
          value={String(data.lowStockProducts.filter((product) => product.stock_quantity === 0).length)}
          subtitle={`${data.lowStockProducts.length} em estoque crítico`}
          icon={PackageX}
          trend={data.lowStockProducts.length > 0 ? "down" : "neutral"}
          trendValue={data.lowStockProducts.length > 0 ? "Atenção" : "Tudo certo"}
        />
        <KpiCard
          title="Lucro do Mês"
          value={formatCurrency(data.monthlyProfit)}
          subtitle="estimado por custo dos itens"
          icon={TrendingUp}
          trend={data.monthlyProfit > 0 ? "up" : "neutral"}
          trendValue="Estimado"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <Card className="rounded-2xl border border-slate-200 bg-white py-0 text-slate-950 shadow-sm">
          <CardHeader className="border-b border-slate-200 px-4 py-4">
            <CardTitle className="text-lg font-semibold">Últimas Vendas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="px-4 text-slate-500">Data</TableHead>
                  <TableHead className="text-slate-500">Pagamento</TableHead>
                  <TableHead className="text-slate-500">Status</TableHead>
                  <TableHead className="px-4 text-right text-slate-500">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentSales.length > 0 ? (
                  data.recentSales.map((sale) => (
                    <TableRow key={sale.id} className="border-slate-100 hover:bg-indigo-50/40">
                      <TableCell className="px-4 text-slate-700">
                        {dateFormatter.format(new Date(sale.created_at))}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {formatPaymentMethod(sale.payment_method)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={sale.status === "completed" ? "outline" : "destructive"}
                          className={
                            sale.status === "completed"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : undefined
                          }
                        >
                          {sale.status === "completed" ? "Concluída" : "Cancelada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-right font-mono text-slate-950">
                        {formatCurrency(sale.net_received)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                      Nenhuma venda registrada ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white py-0 text-slate-950 shadow-sm">
          <CardHeader className="border-b border-slate-200 px-4 py-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="size-5 text-amber-500" />
              Estoque Crítico
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-4">
            {data.lowStockProducts.length > 0 ? (
              data.lowStockProducts.map((product) => (
                <CriticalStockItem key={product.id} product={product} />
              ))
            ) : (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                Nenhum produto abaixo do mínimo.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function CriticalStockItem({ product }: { product: LowStockProduct }) {
  const isOutOfStock = product.stock_quantity === 0

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{product.description}</p>
        <p className="text-xs text-slate-500">Mínimo: {product.min_stock} un.</p>
      </div>
      <Badge
        variant={isOutOfStock ? "destructive" : "outline"}
        className={
          isOutOfStock
            ? "bg-red-50 text-red-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }
      >
        {product.stock_quantity} un.
      </Badge>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  )
}
