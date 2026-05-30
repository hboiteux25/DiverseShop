"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react"
import { toast } from "sonner"

import {
  getAnnualReport,
  getDailyReport,
  getMonthlyReport,
  getSupplierReport,
  getTopProducts,
  type AnnualReport,
  type DailyReport,
  type ExportRow,
  type MonthlyReport,
  type SupplierReportItem,
  type TopProductReportItem,
} from "@/app/actions/reports"
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

const PAYMENT_LABELS = {
  cash: "Dinheiro",
  pix: "Pix",
  credit_card: "Crédito",
  debit_card: "Débito",
  mixed: "Misto",
}

const CHART_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"]
const PRODUCT_CONTROL_EXPORT_URL = "/api/relatorios/exportar-produtos"

function getTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
  }).format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function paymentMethodLabel(paymentMethod: string) {
  if (
    paymentMethod === "cash" ||
    paymentMethod === "pix" ||
    paymentMethod === "credit_card" ||
    paymentMethod === "debit_card" ||
    paymentMethod === "mixed"
  ) {
    return PAYMENT_LABELS[paymentMethod]
  }

  return "Não informado"
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function getFileNameFromDisposition(contentDisposition: string | null) {
  if (!contentDisposition) {
    return "Controle Geral De Produtos Diverse Shop DF.xlsx"
  }

  const fileNameMatch = /filename="([^"]+)"/.exec(contentDisposition)
  return fileNameMatch?.[1] ?? "Controle Geral De Produtos Diverse Shop DF.xlsx"
}

function getErrorMessage(payload: unknown) {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) {
    return "Não foi possível exportar a planilha."
  }

  const error = payload.error
  return typeof error === "string" ? error : "Não foi possível exportar a planilha."
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string
  subtitle: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 font-mono text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
    </div>
  )
}

function ChartPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-950">{title}</h3>
      <div className="h-72">{children}</div>
    </div>
  )
}

function ExportButtons() {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer />
        Exportar PDF
      </Button>
    </div>
  )
}

function ProductControlExportButton() {
  const [isExporting, setIsExporting] = useState(false)

  async function handleExport() {
    setIsExporting(true)

    try {
      const response = await fetch(PRODUCT_CONTROL_EXPORT_URL)

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null)
        toast.error("Erro ao exportar planilha.", {
          description: getErrorMessage(payload),
        })
        return
      }

      const blob = await response.blob()
      const fileName = getFileNameFromDisposition(response.headers.get("Content-Disposition"))
      const exportedProducts = response.headers.get("X-Exported-Products")

      downloadBlob(fileName, blob)
      toast.success("Planilha exportada com sucesso.", {
        description: exportedProducts ? `${exportedProducts} produto(s) exportado(s).` : undefined,
      })
    } catch {
      toast.error("Erro ao exportar planilha.", {
        description: "Não foi possível baixar o arquivo agora.",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      type="button"
      className="h-10 bg-gradient-to-r from-indigo-600 to-sky-500 text-white"
      disabled={isExporting}
      onClick={() => {
        void handleExport()
      }}
    >
      {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
      Exportar controle geral
    </Button>
  )
}

export default function ReportsPage() {
  const today = getTodayDate()
  const [dailyDate, setDailyDate] = useState(today)
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [monthYear, setMonthYear] = useState(String(new Date().getFullYear()))
  const [annualYear, setAnnualYear] = useState(String(new Date().getFullYear()))
  const [rangeFrom, setRangeFrom] = useState(today.slice(0, 8) + "01")
  const [rangeTo, setRangeTo] = useState(today)
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null)
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null)
  const [annualReport, setAnnualReport] = useState<AnnualReport | null>(null)
  const [topProducts, setTopProducts] = useState<TopProductReportItem[]>([])
  const [supplierReport, setSupplierReport] = useState<SupplierReportItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadReports = useCallback(async () => {
    setIsLoading(true)
    const [
      dailyResult,
      monthlyResult,
      annualResult,
      topProductsResult,
      supplierResult,
    ] = await Promise.all([
      getDailyReport(dailyDate),
      getMonthlyReport(Number(monthYear), Number(month)),
      getAnnualReport(Number(annualYear)),
      getTopProducts({ from: rangeFrom, to: rangeTo }, 20),
      getSupplierReport({ from: rangeFrom, to: rangeTo }),
    ])
    setIsLoading(false)

    if (dailyResult.data) setDailyReport(dailyResult.data)
    if (monthlyResult.data) setMonthlyReport(monthlyResult.data)
    if (annualResult.data) setAnnualReport(annualResult.data)
    if (topProductsResult.data) setTopProducts(topProductsResult.data)
    if (supplierResult.data) setSupplierReport(supplierResult.data)

    const firstError =
      dailyResult.error ||
      monthlyResult.error ||
      annualResult.error ||
      topProductsResult.error ||
      supplierResult.error

    if (firstError) {
      toast.error("Alguns relatórios não puderam ser carregados.", {
        description: firstError,
      })
    }
  }, [annualYear, dailyDate, month, monthYear, rangeFrom, rangeTo])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const paymentChartData = useMemo(() => {
    const payments = dailyReport?.totals.payments

    if (!payments) return []

    return [
      { name: "Dinheiro", value: payments.cash },
      { name: "Pix", value: payments.pix },
      { name: "Crédito", value: payments.credit_card },
      { name: "Débito", value: payments.debit_card },
      { name: "Misto", value: payments.mixed },
    ].filter((item) => item.value > 0)
  }, [dailyReport])

  const monthlyRows: ExportRow[] = useMemo(
    () =>
      monthlyReport?.days.map((day) => ({
        Data: formatDate(day.date),
        Vendas: day.salesCount,
        Faturamento: day.gross,
        Desconto: day.discount,
        Liquido: day.net,
        Dinheiro: day.payments.cash,
        Pix: day.payments.pix,
        Credito: day.payments.credit_card,
        Debito: day.payments.debit_card,
      })) ?? [],
    [monthlyReport],
  )

  const annualRows: ExportRow[] = useMemo(
    () =>
      annualReport?.months.map((item) => ({
        Mes: item.label,
        Vendas: item.salesCount,
        Faturamento: item.gross,
        Desconto: item.discount,
        Liquido: item.net,
      })) ?? [],
    [annualReport],
  )

  const productRows: ExportRow[] = useMemo(
    () =>
      topProducts.map((item) => ({
        Produto: item.description,
        Codigo: item.barcode,
        Quantidade: item.quantity,
        Faturamento: item.gross,
        Desconto: item.discount,
        Liquido: item.net,
      })),
    [topProducts],
  )

  const supplierRows: ExportRow[] = useMemo(
    () =>
      supplierReport.map((item) => ({
        Fornecedor: item.supplierName,
        Produtos: item.productsCount,
        Quantidade: item.quantity,
        Faturamento: item.gross,
        Liquido: item.net,
      })),
    [supplierReport],
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 print:bg-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Relatórios e Faturamento</h2>
          <p className="text-sm text-slate-500">
            Acompanhe faturamento, pagamentos, produtos e fornecedores por período.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadReports()} disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin" /> : <FileText />}
          Atualizar
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
            <FileSpreadsheet className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950">Controle geral de produtos</h3>
            <p className="text-sm text-slate-500">
              Modelo padrão da planilha da Diverse Shop DF.
            </p>
          </div>
        </div>
        <ProductControlExportButton />
      </div>

      <Tabs defaultValue="diario" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 lg:grid-cols-5 print:hidden">
          <TabsTrigger value="diario">Diário</TabsTrigger>
          <TabsTrigger value="mensal">Mensal</TabsTrigger>
          <TabsTrigger value="anual">Anual</TabsTrigger>
          <TabsTrigger value="produto">Por Produto</TabsTrigger>
          <TabsTrigger value="fornecedor">Por Fornecedor</TabsTrigger>
        </TabsList>

        <TabsContent value="diario" className="mt-5">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-2">
              <Label htmlFor="daily-date">Data</Label>
              <Input id="daily-date" type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
            </div>
            <ExportButtons />
          </div>

          {dailyReport ? (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard title="Faturamento" value={formatCurrency(dailyReport.totals.gross)} subtitle={`${dailyReport.totals.count} venda(s)`} />
                <SummaryCard title="Valor líquido" value={formatCurrency(dailyReport.totals.net)} subtitle="Após taxas estimadas" />
                <SummaryCard title="Descontos" value={formatCurrency(dailyReport.totals.discount)} subtitle="Desconto total do dia" />
                <SummaryCard title="Taxas cartão" value={formatCurrency(dailyReport.totals.cardFees)} subtitle="Custo financeiro estimado" />
              </div>

              <div className="mb-4 grid gap-4 lg:grid-cols-2">
                <ChartPanel title="Distribuição por pagamento">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentChartData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105}>
                        {paymentChartData.map((item, index) => (
                          <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartPanel>
                <ChartPanel title="Totais por forma de pagamento">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentChartData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `R$ ${Number(value)}`} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#4f46e5" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartPanel>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Venda</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyReport.sales.length > 0 ? (
                      dailyReport.sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{formatDateTime(sale.created_at)}</TableCell>
                          <TableCell className="font-mono text-xs">{sale.id.slice(0, 8)}</TableCell>
                          <TableCell>{paymentMethodLabel(sale.payment_method)}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(sale.total)}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(sale.discount)}</TableCell>
                          <TableCell className="font-mono font-semibold">{formatCurrency(sale.net_received)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-slate-500">Nenhuma venda no dia.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="mensal" className="mt-5">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Mês</Label>
                <Input type="number" min={1} max={12} value={month} onChange={(event) => setMonth(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Ano</Label>
                <Input type="number" min={2024} value={monthYear} onChange={(event) => setMonthYear(event.target.value)} />
              </div>
            </div>
            <ExportButtons />
          </div>

          {monthlyReport ? (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <SummaryCard title="Faturamento do mês" value={formatCurrency(monthlyReport.totals.gross)} subtitle={`${monthlyReport.totals.count} venda(s)`} />
                <SummaryCard title="Valor líquido" value={formatCurrency(monthlyReport.totals.net)} subtitle="Receita após taxas" />
                <SummaryCard title="Descontos" value={formatCurrency(monthlyReport.totals.discount)} subtitle="Total concedido" />
              </div>
              <ChartPanel title="Evolução diária no mês">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyReport.days}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(8, 10)} />
                    <YAxis tickFormatter={(value) => `R$ ${Number(value)}`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} labelFormatter={(label) => formatDate(String(label))} />
                    <Line type="monotone" dataKey="gross" stroke="#4f46e5" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartPanel>
              <ReportTable rows={monthlyRows} emptyText="Nenhum dia com venda neste mês." />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="anual" className="mt-5">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-2">
              <Label>Ano</Label>
              <Input type="number" min={2024} value={annualYear} onChange={(event) => setAnnualYear(event.target.value)} />
            </div>
            <ExportButtons />
          </div>

          {annualReport ? (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <SummaryCard title="Faturamento anual" value={formatCurrency(annualReport.totals.gross)} subtitle={`${annualReport.totals.salesCount} venda(s)`} />
                <SummaryCard title="Valor líquido" value={formatCurrency(annualReport.totals.net)} subtitle="Consolidado anual" />
                <SummaryCard title="Descontos" value={formatCurrency(annualReport.totals.discount)} subtitle="Total concedido no ano" />
              </div>
              <ChartPanel title="Faturamento por mês">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={annualReport.months}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(value) => `R$ ${Number(value)}`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="gross" radius={[8, 8, 0, 0]} fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
              <ReportTable rows={annualRows} emptyText="Nenhum faturamento anual encontrado." />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="produto" className="mt-5">
          <RangeHeader
            from={rangeFrom}
            to={rangeTo}
            onFromChange={setRangeFrom}
            onToChange={setRangeTo}
          />
          <ReportTable rows={productRows} emptyText="Nenhum produto vendido no período." />
        </TabsContent>

        <TabsContent value="fornecedor" className="mt-5">
          <RangeHeader
            from={rangeFrom}
            to={rangeTo}
            onFromChange={setRangeFrom}
            onToChange={setRangeTo}
          />
          <ReportTable rows={supplierRows} emptyText="Nenhum fornecedor com venda no período." />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RangeHeader({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>De</Label>
          <Input type="date" value={from} onChange={(event) => onFromChange(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Até</Label>
          <Input type="date" value={to} onChange={(event) => onToChange(event.target.value)} />
        </div>
      </div>
      <ExportButtons />
    </div>
  )
}

function ReportTable({ rows, emptyText }: { rows: ExportRow[]; emptyText: string }) {
  const headers = Object.keys(rows[0] ?? {})

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <TableRow key={`row-${index}`}>
                {headers.map((header) => {
                  const value = row[header]
                  const isNumber = typeof value === "number"
                  return (
                    <TableCell key={header} className={isNumber ? "font-mono" : undefined}>
                      {isNumber && header !== "Vendas" && header !== "Produtos" && header !== "Quantidade"
                        ? formatCurrency(value)
                        : value}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={Math.max(headers.length, 1)} className="py-10 text-center text-slate-500">
                {emptyText}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
