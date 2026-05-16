"use client"

import { Loader2 } from "lucide-react"
import { useMemo, useState } from "react"

import type { CartItem } from "@/components/vendas/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PaymentMethod, SaleInput } from "@/lib/validations/sale"

type PaymentModalProps = {
  open: boolean
  items: CartItem[]
  saleInput: SaleInput
  finalTotal: number
  paymentLabel: string
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

function getCardFee(paymentMethod: PaymentMethod, saleInput: SaleInput, finalTotal: number) {
  const rate = saleInput.card_fee_rate ?? 0

  if (paymentMethod === "credit_card" || paymentMethod === "debit_card") {
    return finalTotal * rate
  }

  if (paymentMethod === "mixed") {
    return (
      (saleInput.payment_details.credit_card + saleInput.payment_details.debit_card) * rate
    )
  }

  return 0
}

export function PaymentModal({
  open,
  items,
  saleInput,
  finalTotal,
  paymentLabel,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: PaymentModalProps) {
  const [cashReceived, setCashReceived] = useState("")
  const receivedValue = Number(cashReceived.replace(",", ".")) || 0
  const change = Math.max(0, receivedValue - finalTotal)
  const cardFee = useMemo(
    () => getCardFee(saleInput.payment_method, saleInput, finalTotal),
    [finalTotal, saleInput],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-200 bg-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirmar venda</DialogTitle>
          <DialogDescription>
            Revise o carrinho, pagamento e valores antes de finalizar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>Itens</span>
              <span>{items.length} produto(s)</span>
            </div>
            <div className="mt-3 grid gap-2">
              {items.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-700">
                    {item.quantity}x {item.product.description}
                  </span>
                  <span className="font-mono text-slate-950">
                    {formatCurrency(item.quantity * item.unitPrice - item.discount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex justify-between text-sm text-indigo-800">
              <span>Pagamento</span>
              <span className="font-semibold">{paymentLabel}</span>
            </div>
            <div className="flex justify-between text-sm text-indigo-800">
              <span>Desconto total</span>
              <span className="font-mono">{formatCurrency(saleInput.discount)}</span>
            </div>
            {cardFee > 0 ? (
              <div className="flex justify-between text-sm text-indigo-800">
                <span>Taxa de cartão</span>
                <span className="font-mono">{formatCurrency(cardFee)}</span>
              </div>
            ) : null}
            <div className="flex items-end justify-between border-t border-indigo-100 pt-3">
              <span className="text-sm font-medium text-indigo-800">Total</span>
              <span className="font-mono text-3xl font-bold text-slate-950">
                {formatCurrency(finalTotal)}
              </span>
            </div>
          </div>

          {saleInput.payment_method === "cash" ? (
            <div className="grid gap-2">
              <Label htmlFor="cash-received">Valor recebido</Label>
              <Input
                id="cash-received"
                type="number"
                min={0}
                step="0.01"
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
                placeholder="0,00"
              />
              <p className="text-sm text-slate-600">
                Troco: <span className="font-mono font-semibold">{formatCurrency(change)}</span>
              </p>
            </div>
          ) : null}

          {saleInput.payment_method === "pix" ? (
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
              <div className="grid size-24 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500">
                QR Pix
              </div>
              <div>
                <p className="font-semibold text-slate-950">Pagamento via Pix</p>
                <p className="text-sm text-slate-500">Integração com QR Code será conectada depois.</p>
              </div>
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
                  Finalizando
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
