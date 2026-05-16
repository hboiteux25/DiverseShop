import { Banknote, CalendarDays, CreditCard, Landmark, ReceiptText, Smartphone } from "lucide-react"

import { getCashHistory, getDayStatus } from "@/app/actions/cash"
import { CashClosingPanel } from "@/components/caixa/cash-closing-panel"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function getTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function formatCurrency(value: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value ?? 0) ? value ?? 0 : 0)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
  }).format(new Date(`${value}T00:00:00`))
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
  icon: typeof Banknote
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

export default async function CashPage() {
  const today = getTodayDate()
  const [dayStatusResult, historyResult] = await Promise.all([
    getDayStatus(today),
    getCashHistory(2),
  ])
  const dayStatus = dayStatusResult.data
  const history = historyResult.data ?? []
  const cardTotal = dayStatus
    ? dayStatus.summary.paymentTotals.credit + dayStatus.summary.paymentTotals.debit
    : 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays className="size-4" />
            {formatDate(today)}
          </div>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Fechamento de Caixa</h2>
          <p className="text-sm text-slate-500">
            Confira recebimentos, diferenças e histórico de fechamentos.
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            dayStatus?.isClosed
              ? "border-slate-200 bg-slate-100 text-slate-600"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }
        >
          {dayStatus?.isClosed ? "Caixa Fechado" : "Caixa Aberto"}
        </Badge>
      </div>

      {!dayStatus ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {dayStatusResult.error ?? "Não foi possível carregar os dados do caixa."}
        </div>
      ) : (
        <Tabs defaultValue="fechamento" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
            <TabsTrigger value="fechamento">Fechamento</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="fechamento" className="mt-5">
            <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                title="Dinheiro"
                value={formatCurrency(dayStatus.summary.paymentTotals.cash)}
                subtitle="Valor esperado em caixa"
                icon={Banknote}
              />
              <SummaryCard
                title="Pix"
                value={formatCurrency(dayStatus.summary.paymentTotals.pix)}
                subtitle="Recebimentos confirmados"
                icon={Smartphone}
              />
              <SummaryCard
                title="Cartões"
                value={formatCurrency(cardTotal)}
                subtitle="Crédito + débito"
                icon={CreditCard}
              />
              <SummaryCard
                title="Taxas"
                value={formatCurrency(dayStatus.summary.totalCardFees)}
                subtitle="Custos de cartão estimados"
                icon={Landmark}
              />
              <SummaryCard
                title="Total do dia"
                value={formatCurrency(dayStatus.summary.totalSales)}
                subtitle={`${dayStatus.summary.salesCount} venda(s) concluída(s)`}
                icon={ReceiptText}
              />
            </div>

            {dayStatus.isClosed ? (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-950">
                  Este caixa já foi fechado em {formatDate(dayStatus.closing?.date ?? today)}.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Diferença registrada: {formatCurrency(dayStatus.closing?.difference ?? 0)}
                </p>
              </div>
            ) : null}

            <CashClosingPanel dayStatus={dayStatus} />
          </TabsContent>

          <TabsContent value="historico" className="mt-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Data</TableHead>
                    <TableHead>Total Vendas</TableHead>
                    <TableHead>Dinheiro</TableHead>
                    <TableHead>Pix</TableHead>
                    <TableHead>Cartões</TableHead>
                    <TableHead>Diferença</TableHead>
                    <TableHead>Fechado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length > 0 ? (
                    history.map((closing) => (
                      <TableRow key={closing.id}>
                        <TableCell>{formatDate(closing.date)}</TableCell>
                        <TableCell className="font-mono">{formatCurrency(closing.total_sales)}</TableCell>
                        <TableCell className="font-mono">{formatCurrency(closing.counted_cash)}</TableCell>
                        <TableCell className="font-mono">{formatCurrency(closing.total_pix)}</TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency((closing.total_credit ?? 0) + (closing.total_debit ?? 0))}
                        </TableCell>
                        <TableCell
                          className={`font-mono font-semibold ${
                            (closing.difference ?? 0) < 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {formatCurrency(closing.difference)}
                        </TableCell>
                        <TableCell>{closing.closed_by_name ?? "Não informado"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                        Nenhum fechamento encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
