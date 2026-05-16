"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { adjustStock, type StockProduct } from "@/app/actions/stock"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  stockAdjustmentSchema,
  type StockAdjustmentFormData,
  type StockAdjustmentFormInput,
} from "@/lib/validations/stock"

type StockAdjustmentDialogProps = {
  product: StockProduct
}

export function StockAdjustmentDialog({ product }: StockAdjustmentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const form = useForm<StockAdjustmentFormInput, unknown, StockAdjustmentFormData>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      product_id: product.id,
      new_quantity: product.stock_quantity,
      reason: "",
      password: "",
    },
  })

  async function handleSubmit(data: StockAdjustmentFormData) {
    const result = await adjustStock(data.product_id, data.new_quantity, data.reason, data.password)

    if (result.error) {
      toast.error(result.message, { description: result.error })
      return
    }

    toast.success(result.message)
    setOpen(false)
    form.reset({
      product_id: product.id,
      new_quantity: data.new_quantity,
      reason: "",
      password: "",
    })
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <SlidersHorizontal />
          Ajustar
        </Button>
      </DialogTrigger>
      <DialogContent className="border-slate-200 bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajuste manual de estoque</DialogTitle>
          <DialogDescription>
            Apenas administradores podem ajustar inventário manualmente.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="font-medium text-slate-950">{product.description}</p>
            <p className="text-sm text-slate-500">Estoque atual: {product.stock_quantity}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`new-quantity-${product.id}`}>Novo estoque</Label>
            <Input
              id={`new-quantity-${product.id}`}
              type="number"
              min={0}
              step={1}
              {...form.register("new_quantity", { valueAsNumber: true })}
            />
            {form.formState.errors.new_quantity ? (
              <p className="text-sm text-red-600">{form.formState.errors.new_quantity.message}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`reason-${product.id}`}>Justificativa obrigatória</Label>
            <Input
              id={`reason-${product.id}`}
              placeholder="Ex.: contagem física do inventário"
              {...form.register("reason")}
            />
            {form.formState.errors.reason ? (
              <p className="text-sm text-red-600">{form.formState.errors.reason.message}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`password-${product.id}`}>Senha do administrador</Label>
            <Input
              id={`password-${product.id}`}
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Ajustando
                </>
              ) : (
                "Confirmar ajuste"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
