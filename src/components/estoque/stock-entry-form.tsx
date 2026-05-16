"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, PackagePlus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { addStockEntry, type StockProduct } from "@/app/actions/stock"
import type { Supplier } from "@/app/actions/suppliers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  stockEntrySchema,
  type StockEntryFormData,
  type StockEntryFormInput,
} from "@/lib/validations/stock"

type StockEntryFormProps = {
  products: StockProduct[]
  suppliers: Supplier[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function StockEntryForm({ products, suppliers }: StockEntryFormProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(null)
  const filteredProducts = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase()

    if (!trimmedQuery) {
      return products.slice(0, 8)
    }

    return products
      .filter((product) => {
        const barcode = product.barcode?.toLowerCase() ?? ""
        return (
          product.description.toLowerCase().includes(trimmedQuery) ||
          barcode.includes(trimmedQuery)
        )
      })
      .slice(0, 8)
  }, [products, query])

  const form = useForm<StockEntryFormInput, unknown, StockEntryFormData>({
    resolver: zodResolver(stockEntrySchema),
    defaultValues: {
      product_id: "",
      quantity: 1,
      reason: "Entrada de mercadoria",
      box_number: undefined,
      supplier_id: undefined,
      purchase_price: undefined,
    },
  })

  function selectProduct(product: StockProduct) {
    setSelectedProduct(product)
    setQuery(product.description)
    form.setValue("product_id", product.id, { shouldValidate: true, shouldDirty: true })
    form.setValue("box_number", product.box_number ?? undefined)
    form.setValue("supplier_id", product.supplier_id ?? undefined)
    form.setValue("purchase_price", product.purchase_price)
  }

  async function handleSubmit(data: StockEntryFormData) {
    const result = await addStockEntry(data.product_id, data.quantity, data.reason, {
      box_number: data.box_number,
      supplier_id: data.supplier_id,
      purchase_price: data.purchase_price,
    })

    if (result.error) {
      toast.error(result.message, { description: result.error })
      return
    }

    toast.success(result.message)
    form.reset({
      product_id: "",
      quantity: 1,
      reason: "Entrada de mercadoria",
      box_number: undefined,
      supplier_id: undefined,
      purchase_price: undefined,
    })
    setSelectedProduct(null)
    setQuery("")
    router.refresh()
  }

  return (
    <form
      className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <div>
        <h3 className="text-lg font-semibold text-slate-950">Entrada de mercadoria</h3>
        <p className="text-sm text-slate-500">
          Registre chegada de produtos e atualize dados operacionais em uma etapa.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="stock-product-search">Produto</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="stock-product-search"
            className="pl-9"
            value={query}
            placeholder="Busque por nome ou código de barras"
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedProduct(null)
              form.setValue("product_id", "")
            }}
          />
        </div>
        {query && !selectedProduct ? (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                  onClick={() => selectProduct(product)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-950">
                      {product.description}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Estoque atual: {product.stock_quantity}
                    </span>
                  </span>
                  <span className="font-mono text-sm text-slate-600">
                    {formatCurrency(product.purchase_price)}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-slate-500">Nenhum produto encontrado.</p>
            )}
          </div>
        ) : null}
        {form.formState.errors.product_id ? (
          <p className="text-sm text-red-600">{form.formState.errors.product_id.message}</p>
        ) : null}
      </div>

      {selectedProduct ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
          <p className="font-semibold">{selectedProduct.description}</p>
          <p>
            Último valor de compra:{" "}
            <span className="font-mono">{formatCurrency(selectedProduct.purchase_price)}</span>
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="stock-quantity">Quantidade recebida</Label>
          <Input
            id="stock-quantity"
            type="number"
            min={1}
            step={1}
            {...form.register("quantity", { valueAsNumber: true })}
          />
          {form.formState.errors.quantity ? (
            <p className="text-sm text-red-600">{form.formState.errors.quantity.message}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="stock-box">Número da caixa</Label>
          <Input
            id="stock-box"
            type="number"
            min={1}
            step={1}
            placeholder="Opcional"
            {...form.register("box_number", { valueAsNumber: true })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="stock-supplier">Fornecedor</Label>
          <select
            id="stock-supplier"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            {...form.register("supplier_id")}
          >
            <option value="">Manter fornecedor atual</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="stock-purchase-price">Valor de compra</Label>
          <Input
            id="stock-purchase-price"
            type="number"
            min={0}
            step="0.01"
            placeholder="Opcional"
            {...form.register("purchase_price", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="stock-reason">Observação</Label>
        <Input
          id="stock-reason"
          placeholder="Ex.: pedido entregue pela Papelandia"
          {...form.register("reason")}
        />
      </div>

      <Button
        type="submit"
        className="h-11 justify-self-start bg-emerald-600 text-white hover:bg-emerald-700"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Registrando
          </>
        ) : (
          <>
            <PackagePlus />
            Registrar entrada
          </>
        )}
      </Button>
    </form>
  )
}
