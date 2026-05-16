"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { closeCashRegister, type CashDayStatus } from "@/app/actions/cash"
import { CloseConfirmationDialog } from "@/components/caixa/close-confirmation-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CashClosingInput } from "@/lib/validations/cash"

type CashClosingPanelProps = {
  dayStatus: CashDayStatus
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0)
}

function toMoney(value: string) {
  return Number(value.replace(",", ".")) || 0
}

export function CashClosingPanel({ dayStatus }: CashClosingPanelProps) {
  const router = useRouter()
  const [countedCash, setCountedCash] = useState("")
  const [countedPix, setCountedPix] = useState(String(dayStatus.summary.paymentTotals.pix || ""))
  const [countedCards, setCountedCards] = useState(
    String(dayStatus.summary.paymentTotals.credit + dayStatus.summary.paymentTotals.debit || ""),
  )
  const [notes, setNotes] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const expectedCash = dayStatus.summary.paymentTotals.cash
  const countedCashValue = toMoney(countedCash)
  const difference = countedCashValue - expectedCash
  const countedPixDifference = toMoney(countedPix) - dayStatus.summary.paymentTotals.pix
  const countedCardsDifference =
    toMoney(countedCards) -
    (dayStatus.summary.paymentTotals.credit + dayStatus.summary.paymentTotals.debit)

  const closingPayload = useMemo<CashClosingInput>(
    () => ({
      date: dayStatus.date,
      expected_cash: expectedCash,
      counted_cash: countedCashValue,
      total_sales: dayStatus.summary.totalSales,
      total_pix: dayStatus.summary.paymentTotals.pix,
      total_credit: dayStatus.summary.paymentTotals.credit,
      total_debit: dayStatus.summary.paymentTotals.debit,
      total_discount: dayStatus.summary.totalDiscount,
      total_card_fees: dayStatus.summary.totalCardFees,
      notes,
    }),
    [countedCashValue, dayStatus, expectedCash, notes],
  )

  async function handleConfirmClose() {
    setIsSubmitting(true)
    const result = await closeCashRegister(closingPayload)
    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.message, { description: result.error })
      return
    }

    toast.success(result.message)
    setIsDialogOpen(false)
    router.refresh()
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Conferência</h2>
        <p className="text-sm text-slate-500">
          Informe os valores físicos conferidos para fechar o caixa.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="counted-cash">Dinheiro contado</Label>
          <Input
            id="counted-cash"
            type="number"
            min={0}
            step="0.01"
            value={countedCash}
            disabled={dayStatus.isClosed}
            onChange={(event) => setCountedCash(event.target.value)}
            placeholder="0,00"
          />
          <p className="text-xs text-slate-500">
            Esperado: {formatCurrency(expectedCash)}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="counted-pix">Pix conferido</Label>
          <Input
            id="counted-pix"
            type="number"
            min={0}
            step="0.01"
            value={countedPix}
            disabled={dayStatus.isClosed}
            onChange={(event) => setCountedPix(event.target.value)}
          />
          <p className={countedPixDifference === 0 ? "text-xs text-slate-500" : "text-xs text-amber-600"}>
            Diferença informativa: {formatCurrency(countedPixDifference)}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="counted-cards">Cartões conferidos</Label>
          <Input
            id="counted-cards"
            type="number"
            min={0}
            step="0.01"
            value={countedCards}
            disabled={dayStatus.isClosed}
            onChange={(event) => setCountedCards(event.target.value)}
          />
          <p className={countedCardsDifference === 0 ? "text-xs text-slate-500" : "text-xs text-amber-600"}>
            Diferença informativa: {formatCurrency(countedCardsDifference)}
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="cash-notes">Observações</Label>
        <textarea
          id="cash-notes"
          className="min-h-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          value={notes}
          disabled={dayStatus.isClosed}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ex.: diferença conferida no caixa físico, comprovantes pendentes..."
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Diferença em dinheiro</p>
          <p className={`font-mono text-3xl font-bold ${difference < 0 ? "text-red-600" : "text-emerald-600"}`}>
            {formatCurrency(difference)}
          </p>
        </div>
        <Button
          type="button"
          className="h-11 bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={dayStatus.isClosed}
          onClick={() => setIsDialogOpen(true)}
        >
          Fechar Caixa
        </Button>
      </div>

      <CloseConfirmationDialog
        open={isDialogOpen}
        closing={closingPayload}
        difference={difference}
        isSubmitting={isSubmitting}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleConfirmClose}
      />
    </section>
  )
}
