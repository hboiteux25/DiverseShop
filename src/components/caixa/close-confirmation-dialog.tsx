"use client"

import { AlertTriangle, Loader2 } from "lucide-react"

import type { CashClosingInput } from "@/lib/validations/cash"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type CloseConfirmationDialogProps = {
  open: boolean
  closing: CashClosingInput
  difference: number
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0)
}

export function CloseConfirmationDialog({
  open,
  closing,
  difference,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: CloseConfirmationDialogProps) {
  const hasLargeDifference = Math.abs(difference) > 10

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-200 bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar fechamento</DialogTitle>
          <DialogDescription>
            Revise os valores finais antes de fechar o caixa do dia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span>Data</span>
            <span className="font-medium">{closing.date}</span>
          </div>
          <div className="flex justify-between">
            <span>Total em vendas</span>
            <span className="font-mono">{formatCurrency(closing.total_sales)}</span>
          </div>
          <div className="flex justify-between">
            <span>Dinheiro esperado</span>
            <span className="font-mono">{formatCurrency(closing.expected_cash)}</span>
          </div>
          <div className="flex justify-between">
            <span>Dinheiro contado</span>
            <span className="font-mono">{formatCurrency(closing.counted_cash)}</span>
          </div>
          <div className="flex items-end justify-between border-t border-slate-200 pt-3">
            <span className="font-semibold">Diferença</span>
            <span className={`font-mono text-2xl font-bold ${difference < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(difference)}
            </span>
          </div>
        </div>

        {hasLargeDifference ? (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              A diferença é maior que R$ 10,00. Confirme a contagem física antes de concluir.
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Revisar
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={isSubmitting}
            onClick={() => {
              void onConfirm()
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" />
                Fechando
              </>
            ) : (
              "Confirmar Fechamento"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
