"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Camera, Loader2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { createProduct, updateProduct, type Product } from "@/app/actions/products"
import type { Supplier } from "@/app/actions/suppliers"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  productSchema,
  type ProductFormData,
  type ProductFormInput,
} from "@/lib/validations/product"

type ProductFormProps = {
  suppliers: Supplier[]
  product?: Product
}

type BarcodeDetectorResult = {
  rawValue: string
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[]
}) => {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
}

function getMargin(purchasePrice: number, salePrice: number) {
  if (salePrice <= 0) {
    return 0
  }

  return ((salePrice - purchasePrice) / salePrice) * 100
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0)
}

export function ProductForm({ suppliers, product }: ProductFormProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

  const form = useForm<ProductFormInput, unknown, ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      description: product?.description ?? "",
      barcode: product?.barcode ?? "",
      box_number: product?.box_number ?? undefined,
      purchase_price: product?.purchase_price ?? 0,
      sale_price: product?.sale_price ?? 0,
      stock_quantity: product?.stock_quantity ?? 0,
      min_stock: product?.min_stock ?? 2,
      supplier_id: product?.supplier_id ?? "",
    },
  })

  const purchasePrice = Number(form.watch("purchase_price") ?? 0)
  const salePrice = Number(form.watch("sale_price") ?? 0)
  const unitProfit = salePrice - purchasePrice
  const margin = useMemo(() => getMargin(purchasePrice, salePrice), [purchasePrice, salePrice])

  useEffect(() => {
    if (!isScannerOpen || !videoRef.current || !mediaStream) {
      return
    }

    videoRef.current.srcObject = mediaStream
  }, [isScannerOpen, mediaStream])

  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((track) => track.stop())
    }
  }, [mediaStream])

  async function handleSubmit(data: ProductFormData) {
    form.clearErrors("root")

    const result = product
      ? await updateProduct(product.id, data)
      : await createProduct(data)

    if (result.error) {
      form.setError("root", {
        message: result.error,
      })
      toast.error(result.message, {
        description: result.error,
      })
      return
    }

    toast.success(result.message)

    if (!product) {
      router.push("/produtos")
      return
    }

    router.refresh()
  }

  async function openScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Câmera indisponível neste navegador.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      })
      setMediaStream(stream)
      setIsScannerOpen(true)
    } catch {
      toast.error("Não foi possível abrir a câmera.")
    }
  }

  function closeScanner() {
    mediaStream?.getTracks().forEach((track) => track.stop())
    setMediaStream(null)
    setIsScannerOpen(false)
  }

  async function captureBarcode() {
    const video = videoRef.current

    if (!video) {
      return
    }

    const BarcodeDetector = window.BarcodeDetector ?? null

    if (!BarcodeDetector) {
      toast.error("Leitura automática não suportada. Digite o código manualmente.")
      closeScanner()
      return
    }

    try {
      const detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
      })
      const results = await detector.detect(video)
      const barcode = results[0]?.rawValue

      if (!barcode) {
        toast.warning("Nenhum código foi encontrado. Aproxime a câmera e tente novamente.")
        return
      }

      form.setValue("barcode", barcode, {
        shouldDirty: true,
        shouldValidate: true,
      })
      toast.success("Código de barras lido com sucesso.")
      closeScanner()
    } catch {
      toast.error("Não foi possível ler o código de barras.")
    }
  }

  return (
    <>
      <form
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="product-description">Descrição*</Label>
          <Input
            id="product-description"
            placeholder="Nome do produto"
            aria-invalid={Boolean(form.formState.errors.description)}
            {...form.register("description")}
          />
          {form.formState.errors.description ? (
            <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="product-barcode">Código de barras</Label>
          <div className="flex gap-2">
            <Input
              id="product-barcode"
              placeholder="Opcional"
              aria-invalid={Boolean(form.formState.errors.barcode)}
              {...form.register("barcode")}
            />
            <Button type="button" variant="outline" size="icon-lg" onClick={openScanner}>
              <Camera />
              <span className="sr-only">Ler código de barras</span>
            </Button>
          </div>
          {form.formState.errors.barcode ? (
            <p className="text-sm text-red-600">{form.formState.errors.barcode.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Fornecedor*</Label>
          <Select
            value={form.watch("supplier_id")}
            onValueChange={(value) =>
              form.setValue("supplier_id", value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="h-10 w-full bg-white">
              <SelectValue placeholder="Selecione um fornecedor" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.supplier_id ? (
            <p className="text-sm text-red-600">{form.formState.errors.supplier_id.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="purchase-price">Preço de compra*</Label>
          <Input
            id="purchase-price"
            type="number"
            min={0}
            step="0.01"
            aria-invalid={Boolean(form.formState.errors.purchase_price)}
            {...form.register("purchase_price", { valueAsNumber: true })}
          />
          {form.formState.errors.purchase_price ? (
            <p className="text-sm text-red-600">{form.formState.errors.purchase_price.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sale-price">Preço de venda*</Label>
          <Input
            id="sale-price"
            type="number"
            min={0}
            step="0.01"
            aria-invalid={Boolean(form.formState.errors.sale_price)}
            {...form.register("sale_price", { valueAsNumber: true })}
          />
          {form.formState.errors.sale_price ? (
            <p className="text-sm text-red-600">{form.formState.errors.sale_price.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="stock-quantity">Quantidade em estoque</Label>
          <Input
            id="stock-quantity"
            type="number"
            min={0}
            step={1}
            aria-invalid={Boolean(form.formState.errors.stock_quantity)}
            {...form.register("stock_quantity", { valueAsNumber: true })}
          />
          {form.formState.errors.stock_quantity ? (
            <p className="text-sm text-red-600">{form.formState.errors.stock_quantity.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="min-stock">Estoque mínimo</Label>
          <Input
            id="min-stock"
            type="number"
            min={0}
            step={1}
            aria-invalid={Boolean(form.formState.errors.min_stock)}
            {...form.register("min_stock", { valueAsNumber: true })}
          />
          {form.formState.errors.min_stock ? (
            <p className="text-sm text-red-600">{form.formState.errors.min_stock.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="box-number">Número da caixa</Label>
          <Input
            id="box-number"
            type="number"
            min={1}
            step={1}
            placeholder="Opcional"
            aria-invalid={Boolean(form.formState.errors.box_number)}
            {...form.register("box_number", { valueAsNumber: true })}
          />
          {form.formState.errors.box_number ? (
            <p className="text-sm text-red-600">{form.formState.errors.box_number.message}</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 md:col-span-2">
          <p className="text-sm font-medium text-indigo-700">Prévia de lucro</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Lucro unitário</p>
              <p className="font-mono text-xl font-semibold text-slate-950">
                {formatCurrency(unitProfit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Margem</p>
              <p className="font-mono text-xl font-semibold text-slate-950">
                {margin.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {form.formState.errors.root ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <div className="md:col-span-2">
          <Button
            type="submit"
            className="h-10 bg-gradient-to-r from-indigo-600 to-sky-500 text-white hover:from-indigo-700 hover:to-sky-600"
            disabled={form.formState.isSubmitting || suppliers.length === 0}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="animate-spin" />
                Salvando
              </>
            ) : product ? (
              "Salvar alterações"
            ) : (
              "Criar produto"
            )}
          </Button>
        </div>
      </form>

      <Dialog open={isScannerOpen} onOpenChange={(open) => (!open ? closeScanner() : null)}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ler código de barras</DialogTitle>
            <DialogDescription>
              Aponte a câmera para o código e toque em capturar.
            </DialogDescription>
          </DialogHeader>
          <video
            ref={videoRef}
            className="aspect-video w-full rounded-xl bg-slate-950 object-cover"
            autoPlay
            muted
            playsInline
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeScanner}>
              Cancelar
            </Button>
            <Button type="button" onClick={captureBarcode}>
              Capturar código
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
