"use client"

import { useState } from "react"
import { Check, Pencil } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { productSchema, type ProductFormData } from "@/lib/validations/product"

type ProductConfirmCardProps = {
  product: ProductFormData
  onDone?: (message: string) => void
  onEdit?: () => void
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function ProductConfirmCard({ product, onDone, onEdit }: ProductConfirmCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleConfirm() {
    const parsedProduct = productSchema.safeParse(product)

    if (!parsedProduct.success) {
      toast.error(parsedProduct.error.issues[0]?.message ?? "Confira os dados do produto.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/chat/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_product",
          data: parsedProduct.data,
        }),
      })

      const result: unknown = await response.json()
      const message =
        typeof result === "object" && result !== null && "message" in result && typeof result.message === "string"
          ? result.message
          : "Ação concluída."
      const error =
        typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : null

      if (!response.ok || error) {
        toast.error(error ?? "Não foi possível criar o produto.")
        return
      }

      toast.success(message)
      onDone?.(message)
    } catch {
      toast.error("Não foi possível criar o produto agora.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="mt-3 border-indigo-100 bg-white shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-slate-950">Confirmar cadastro</CardTitle>
            <p className="text-sm text-slate-500">Revise os dados antes de salvar no Supabase.</p>
          </div>
          <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50">Produto</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Descrição</p>
            <p className="font-semibold text-slate-950">{product.description}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Código de barras</p>
            <p className="font-medium text-slate-700">{product.barcode ?? "Não informado"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Compra</p>
            <p className="font-mono font-semibold text-slate-950">{formatCurrency(product.purchase_price)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Venda</p>
            <p className="font-mono font-semibold text-emerald-700">{formatCurrency(product.sale_price)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Estoque</p>
            <p className="font-medium text-slate-700">
              {product.stock_quantity} un. / mínimo {product.min_stock}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Caixa</p>
            <p className="font-medium text-slate-700">{product.box_number ?? "Não informada"}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="gradient-primary min-h-11 flex-1 text-white shadow-sm"
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            <Check className="size-4" />
            {isSubmitting ? "Salvando..." : "Confirmar"}
          </Button>
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={onEdit}>
            <Pencil className="size-4" />
            Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
