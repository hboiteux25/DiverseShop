"use client"

import { Printer, RotateCcw } from "lucide-react"

import type { ReceiptData } from "@/components/vendas/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ReceiptModalProps = {
  open: boolean
  receipt: ReceiptData | null
  onNewSale: () => void
  onOpenChange: (open: boolean) => void
}

const PAYMENT_LABELS = {
  cash: "Dinheiro",
  pix: "Pix",
  credit_card: "Crédito",
  debit_card: "Débito",
  mixed: "Misto",
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

function getReceiptHtml(receipt: ReceiptData) {
  const subtotal = receipt.items.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0,
  )

  return `
    <html>
      <head>
        <title>Comprovante ${receipt.sale.id}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body { width: 72mm; font-family: Arial, sans-serif; font-size: 11px; color: #111827; }
          h1 { font-size: 14px; margin: 0 0 6px; text-align: center; }
          .center { text-align: center; }
          .row { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; }
          .items { border-top: 1px dashed #94a3b8; border-bottom: 1px dashed #94a3b8; padding: 6px 0; margin: 8px 0; }
          .total { font-weight: 700; font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>Diverse Shop DF</h1>
        <p class="center">Comprovante de venda</p>
        <p>Venda: ${receipt.sale.id}</p>
        <p>Data: ${formatDateTime(receipt.sale.created_at)}</p>
        <div class="items">
          ${receipt.items
            .map(
              (item) => `
                <div>
                  <div>${item.product.description}</div>
                  <div class="row">
                    <span>${item.quantity} x ${formatCurrency(item.unitPrice)}</span>
                    <span>${formatCurrency(item.quantity * item.unitPrice - item.discount)}</span>
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
        <div class="row"><span>Desconto</span><span>${formatCurrency(receipt.sale.discount)}</span></div>
        <div class="row total"><span>Total</span><span>${formatCurrency(receipt.sale.total - receipt.sale.discount)}</span></div>
        <div class="row"><span>Pagamento</span><span>${PAYMENT_LABELS[receipt.sale.payment_method]}</span></div>
        ${receipt.sale.isOffline ? "<p class='center'>Venda pendente de sincronização</p>" : ""}
      </body>
    </html>
  `
}

export function ReceiptModal({ open, receipt, onNewSale, onOpenChange }: ReceiptModalProps) {
  if (!receipt) {
    return null
  }

  const subtotal = receipt.items.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0,
  )
  const finalTotal = receipt.sale.total - receipt.sale.discount

  function handlePrint() {
    const printWindow = window.open("", "receipt-print", "width=360,height=640")

    if (!printWindow || !receipt) {
      return
    }

    printWindow.document.write(getReceiptHtml(receipt))
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-200 bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Venda finalizada</DialogTitle>
          <DialogDescription>
            Comprovante da venda {receipt.sale.id.slice(0, 8)}
            {receipt.sale.isOffline ? " pendente de sincronização" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Data</span>
            <span className="font-medium text-slate-950">{formatDateTime(receipt.sale.created_at)}</span>
          </div>
          <div className="grid gap-2 border-y border-slate-200 py-3">
            {receipt.items.map((item) => (
              <div key={item.product.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {item.quantity}x {item.product.description}
                </span>
                <span className="font-mono">
                  {formatCurrency(item.quantity * item.unitPrice - item.discount)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Desconto</span>
            <span className="font-mono">{formatCurrency(receipt.sale.discount)}</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-mono text-2xl font-bold text-slate-950">
              {formatCurrency(finalTotal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Forma de pagamento</span>
            <span className="font-semibold">{PAYMENT_LABELS[receipt.sale.payment_method]}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handlePrint}>
            <Printer />
            Imprimir
          </Button>
          <Button type="button" className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={onNewSale}>
            <RotateCcw />
            Nova Venda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
