"use client"

import { Camera, Loader2, Minus, Plus, Search, Trash2, Wifi, WifiOff } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { getProductByBarcode, getProducts } from "@/app/actions/products"
import { createSale } from "@/app/actions/sales"
import { PaymentModal } from "@/components/vendas/payment-modal"
import { ReceiptModal } from "@/components/vendas/receipt-modal"
import type { CartItem, PosProduct, ReceiptData } from "@/components/vendas/types"
import { Badge } from "@/components/ui/badge"
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

type OfflineSale = {
  id: string
  saleInput: SaleInput
  receipt: ReceiptData
  createdAt: string
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

const OFFLINE_DB_NAME = "diverse-shop-pos"
const OFFLINE_STORE_NAME = "pending-sales"
const CARD_FEE_RATE = Number(process.env.NEXT_PUBLIC_CARD_FEE_DEFAULT ?? "0.0299")

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Dinheiro", symbol: "💵" },
  { value: "pix", label: "Pix", symbol: "📱" },
  { value: "credit_card", label: "Crédito", symbol: "💳" },
  { value: "debit_card", label: "Débito", symbol: "💳" },
  { value: "mixed", label: "Misto", symbol: "➕" },
] satisfies Array<{ value: PaymentMethod; label: string; symbol: string }>

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0)
}

function toMoney(value: string) {
  return Number(value.replace(",", ".")) || 0
}

function isBarcode(value: string) {
  return /^\d{6,}$/.test(value.trim())
}

function toPosProduct(product: {
  id: string
  barcode: string | null
  description: string
  sale_price: number
  stock_quantity: number
  status: string
}): PosProduct {
  return {
    id: product.id,
    barcode: product.barcode,
    description: product.description,
    sale_price: product.sale_price,
    stock_quantity: product.stock_quantity,
    status: product.status,
  }
}

function isOfflineSale(value: unknown): value is OfflineSale {
  if (typeof value !== "object" || value === null) {
    return false
  }

  return "id" in value && "saleInput" in value && "receipt" in value && "createdAt" in value
}

function openOfflineDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
        database.createObjectStore(OFFLINE_STORE_NAME, { keyPath: "id" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readOfflineSales() {
  const database = await openOfflineDb()

  return new Promise<OfflineSale[]>((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORE_NAME, "readonly")
    const request = transaction.objectStore(OFFLINE_STORE_NAME).getAll()

    request.onsuccess = () => {
      const result: unknown = request.result
      resolve(Array.isArray(result) ? result.filter(isOfflineSale) : [])
    }
    request.onerror = () => reject(request.error)
  }).finally(() => database.close())
}

async function saveOfflineSale(offlineSale: OfflineSale) {
  const database = await openOfflineDb()

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORE_NAME, "readwrite")
    transaction.objectStore(OFFLINE_STORE_NAME).put(offlineSale)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  }).finally(() => database.close())
}

async function deleteOfflineSale(id: string) {
  const database = await openOfflineDb()

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORE_NAME, "readwrite")
    transaction.objectStore(OFFLINE_STORE_NAME).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  }).finally(() => database.close())
}

export default function SalesPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [query, setQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<PosProduct | null>(null)
  const [suggestions, setSuggestions] = useState<PosProduct[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [isSuggestionListOpen, setIsSuggestionListOpen] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [discountValue, setDiscountValue] = useState("")
  const [discountMode, setDiscountMode] = useState<"currency" | "percent">("currency")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [mixedPayment, setMixedPayment] = useState({
    cash: "",
    pix: "",
    credit_card: "",
    debit_card: "",
  })
  const [isSearching, setIsSearching] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

  const subtotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0),
    [cartItems],
  )
  const discountAmount = useMemo(() => {
    const rawDiscount = toMoney(discountValue)
    const calculatedDiscount = discountMode === "percent" ? subtotal * (rawDiscount / 100) : rawDiscount

    return Math.min(subtotal, Math.max(0, calculatedDiscount))
  }, [discountMode, discountValue, subtotal])
  const finalTotal = Math.max(0, subtotal - discountAmount)
  const paymentDetails = useMemo(
    () => ({
      cash: paymentMethod === "cash" ? finalTotal : toMoney(mixedPayment.cash),
      pix: paymentMethod === "pix" ? finalTotal : toMoney(mixedPayment.pix),
      credit_card: paymentMethod === "credit_card" ? finalTotal : toMoney(mixedPayment.credit_card),
      debit_card: paymentMethod === "debit_card" ? finalTotal : toMoney(mixedPayment.debit_card),
    }),
    [finalTotal, mixedPayment, paymentMethod],
  )
  const cardBase =
    paymentMethod === "credit_card" || paymentMethod === "debit_card"
      ? finalTotal
      : paymentDetails.credit_card + paymentDetails.debit_card
  const cardFee = cardBase * CARD_FEE_RATE
  const netReceived = finalTotal - cardFee
  const saleInput = useMemo<SaleInput>(
    () => ({
      items: cartItems.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount: item.discount,
      })),
      payment_method: paymentMethod,
      discount: discountAmount,
      card_fee_rate: cardBase > 0 ? CARD_FEE_RATE : null,
      payment_details: paymentDetails,
    }),
    [cardBase, cartItems, discountAmount, paymentDetails, paymentMethod],
  )
  const paymentLabel =
    PAYMENT_OPTIONS.find((option) => option.value === paymentMethod)?.label ?? "Pagamento"

  const refreshOfflineCount = useCallback(async () => {
    try {
      const pendingSales = await readOfflineSales()
      setPendingOfflineCount(pendingSales.length)
    } catch {
      setPendingOfflineCount(0)
    }
  }, [])

  const syncOfflineSales = useCallback(async () => {
    try {
      const pendingSales = await readOfflineSales()

      for (const pendingSale of pendingSales) {
        const result = await createSale(pendingSale.saleInput)

        if (!result.error) {
          await deleteOfflineSale(pendingSale.id)
        }
      }

      await refreshOfflineCount()
      if (pendingSales.length > 0) {
        toast.success("Vendas offline sincronizadas.")
      }
    } catch {
      toast.error("Não foi possível sincronizar as vendas offline agora.")
    }
  }, [refreshOfflineCount])

  useEffect(() => {
    setIsOnline(navigator.onLine)

    function handleOnline() {
      setIsOnline(true)
      void syncOfflineSales()
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    void refreshOfflineCount()

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [refreshOfflineCount, syncOfflineSales])

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

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2 || selectedProduct?.description === query) {
      setSuggestions([])
      setIsSuggestionListOpen(false)
      setIsSuggesting(false)
      return
    }

    let isCurrentSearch = true
    setIsSuggesting(true)
    const timeoutId = window.setTimeout(async () => {
      const result = await getProducts({ search: trimmedQuery })

      if (!isCurrentSearch) {
        return
      }

      if (result.error || !result.data) {
        setSuggestions([])
        setIsSuggestionListOpen(false)
      } else {
        setSuggestions(result.data.slice(0, 6).map(toPosProduct))
        setIsSuggestionListOpen(true)
      }

      setIsSuggesting(false)
    }, 250)

    return () => {
      isCurrentSearch = false
      window.clearTimeout(timeoutId)
    }
  }, [query, selectedProduct?.description])

  function handleQueryChange(value: string) {
    setQuery(value)
    setSelectedProduct(null)
    setIsSuggestionListOpen(value.trim().length >= 2)
  }

  function selectSuggestedProduct(product: PosProduct) {
    setSelectedProduct(product)
    setQuery(product.description)
    setSuggestions([])
    setIsSuggestionListOpen(false)
  }

  async function handleSearch() {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      return
    }

    setIsSearching(true)
    const result = isBarcode(trimmedQuery)
      ? await getProductByBarcode(trimmedQuery)
      : await getProducts({ search: trimmedQuery })
    setIsSearching(false)

    if (result.error || !result.data) {
      setSelectedProduct(null)
      toast.error(result.message, { description: result.error })
      return
    }

    const product = Array.isArray(result.data) ? result.data[0] : result.data

    if (!product) {
      setSelectedProduct(null)
      toast.warning("Nenhum produto encontrado.")
      return
    }

    setSelectedProduct(toPosProduct(product))
    setSuggestions([])
    setIsSuggestionListOpen(false)
  }

  function addToCart(product: PosProduct) {
    if (product.stock_quantity <= 0) {
      toast.error("Produto sem estoque disponível.")
      return
    }

    setCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.product.id === product.id)

      if (existingItem) {
        return currentItems.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: Math.min(item.quantity + 1, product.stock_quantity),
              }
            : item,
        )
      }

      return [
        ...currentItems,
        {
          product,
          quantity: 1,
          unitPrice: product.sale_price,
          discount: 0,
        },
      ]
    })
    setQuery("")
    setSelectedProduct(null)
    setSuggestions([])
    setIsSuggestionListOpen(false)
  }

  function updateQuantity(productId: string, quantity: number) {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity: Math.min(Math.max(1, quantity), item.product.stock_quantity),
            }
          : item,
      ),
    )
  }

  function removeItem(productId: string) {
    setCartItems((currentItems) => currentItems.filter((item) => item.product.id !== productId))
  }

  function resetSale() {
    setCartItems([])
    setDiscountValue("")
    setDiscountMode("currency")
    setPaymentMethod("cash")
    setMixedPayment({
      cash: "",
      pix: "",
      credit_card: "",
      debit_card: "",
    })
    setReceipt(null)
    setIsReceiptModalOpen(false)
  }

  function buildReceipt(sale: ReceiptData["sale"]): ReceiptData {
    return {
      sale,
      items: cartItems,
    }
  }

  async function handleConfirmSale() {
    if (cartItems.length === 0) {
      toast.error("Adicione produtos ao carrinho antes de finalizar.")
      return
    }

    if (paymentMethod === "mixed") {
      const mixedTotal =
        paymentDetails.cash +
        paymentDetails.pix +
        paymentDetails.credit_card +
        paymentDetails.debit_card

      if (Math.abs(mixedTotal - finalTotal) > 0.01) {
        toast.error("Os valores do pagamento misto precisam fechar com o total.")
        return
      }
    }

    setIsSubmitting(true)

    if (!navigator.onLine) {
      const offlineSale: OfflineSale = {
        id: crypto.randomUUID(),
        saleInput,
        receipt: buildReceipt({
          id: `offline-${Date.now()}`,
          created_at: new Date().toISOString(),
          total: subtotal,
          discount: discountAmount,
          net_received: netReceived,
          payment_method: paymentMethod,
          card_fee_rate: cardBase > 0 ? CARD_FEE_RATE : null,
          payment_details: paymentDetails,
          isOffline: true,
        }),
        createdAt: new Date().toISOString(),
      }

      await saveOfflineSale(offlineSale)
      await refreshOfflineCount()
      setReceipt(offlineSale.receipt)
      setIsPaymentModalOpen(false)
      setIsReceiptModalOpen(true)
      setIsSubmitting(false)
      toast.success("Venda salva offline. Ela será sincronizada quando a conexão voltar.")
      return
    }

    const result = await createSale(saleInput)
    setIsSubmitting(false)

    if (result.error || !result.data) {
      toast.error(result.message, { description: result.error })
      return
    }

    setReceipt(
      buildReceipt({
        ...result.data,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
      }),
    )
    setIsPaymentModalOpen(false)
    setIsReceiptModalOpen(true)
    toast.success(result.message)
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
    const BarcodeDetector = window.BarcodeDetector ?? null

    if (!video || !BarcodeDetector) {
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

      setQuery(barcode)
      closeScanner()
      const result = await getProductByBarcode(barcode)

      if (result.error || !result.data) {
        toast.error(result.message, { description: result.error })
        return
      }

      setSelectedProduct(toPosProduct(result.data))
    } catch {
      toast.error("Não foi possível ler o código de barras.")
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
      <section className="grid gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Busca de produto</h2>
              <p className="text-sm text-slate-500">Digite nome, descrição ou código de barras.</p>
            </div>
            <Badge
              variant="outline"
              className={
                isOnline
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }
            >
              {isOnline ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              {isOnline ? "Online" : "Offline"}
              {pendingOfflineCount > 0 ? ` • ${pendingOfflineCount} pendente(s)` : ""}
            </Badge>
          </div>

          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-14 pl-10 text-base"
                value={query}
                placeholder="Buscar produto ou bipar código"
                onChange={(event) => handleQueryChange(event.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setIsSuggestionListOpen(true)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void handleSearch()
                  } else if (event.key === "Escape") {
                    setIsSuggestionListOpen(false)
                  }
                }}
              />
              {isSuggestionListOpen ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/80">
                  {isSuggesting ? (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                      <Loader2 className="size-4 animate-spin" />
                      Buscando produtos...
                    </div>
                  ) : suggestions.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto">
                      {suggestions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-indigo-50"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectSuggestedProduct(product)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-950">
                              {product.description}
                            </span>
                            <span className="mt-1 block truncate text-xs text-slate-500">
                              Código: {product.barcode ?? "não informado"} • Estoque:{" "}
                              {product.stock_quantity}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block font-mono text-sm font-semibold text-emerald-700">
                              {formatCurrency(product.sale_price)}
                            </span>
                            <span className="text-xs text-slate-400">Selecionar</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : query.trim().length >= 2 ? (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      Nenhum produto encontrado.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              className="h-14 bg-indigo-600 px-5 text-white hover:bg-indigo-700"
              disabled={isSearching}
              onClick={() => {
                void handleSearch()
              }}
            >
              {isSearching ? <Loader2 className="animate-spin" /> : "Buscar"}
            </Button>
            <Button type="button" variant="outline" size="icon-lg" className="h-14 w-14" onClick={openScanner}>
              <Camera />
              <span className="sr-only">Ler código de barras</span>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {selectedProduct ? (
            <div className="grid gap-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center">
              <div className="grid aspect-square place-items-center rounded-xl bg-slate-100 text-sm font-bold text-slate-400">
                Foto
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-slate-950">
                  {selectedProduct.description}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Código: {selectedProduct.barcode ?? "não informado"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                    {formatCurrency(selectedProduct.sale_price)}
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                    Estoque: {selectedProduct.stock_quantity}
                  </Badge>
                </div>
              </div>
              <Button
                type="button"
                className="h-12 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => addToCart(selectedProduct)}
              >
                <Plus />
                Adicionar ao Carrinho
              </Button>
            </div>
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
              Busque um produto para ver preço, estoque e adicionar ao carrinho.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-950">Carrinho</h2>
          <p className="text-sm text-slate-500">{cartItems.length} item(ns) na venda atual</p>
        </div>

        <div className="grid gap-4 p-4">
          <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
            {cartItems.length > 0 ? (
              cartItems.map((item) => (
                <div key={item.product.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-950">{item.product.description}</p>
                      <p className="font-mono text-sm text-slate-500">{formatCurrency(item.unitPrice)}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.product.id)}>
                      <Trash2 className="text-red-600" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center rounded-lg border border-slate-200">
                      <Button type="button" variant="ghost" size="icon" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                        <Minus />
                      </Button>
                      <Input
                        className="h-9 w-16 border-0 text-center"
                        type="number"
                        min={1}
                        max={item.product.stock_quantity}
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.product.id, Number(event.target.value))}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                        <Plus />
                      </Button>
                    </div>
                    <span className="font-mono font-semibold text-slate-950">
                      {formatCurrency(item.quantity * item.unitPrice - item.discount)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                O carrinho está vazio.
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-xl bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div>
                <Label htmlFor="discount">Desconto geral</Label>
                <Input
                  id="discount"
                  className="mt-1"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="flex items-end gap-1">
                <Button
                  type="button"
                  variant={discountMode === "currency" ? "default" : "outline"}
                  onClick={() => setDiscountMode("currency")}
                >
                  R$
                </Button>
                <Button
                  type="button"
                  variant={discountMode === "percent" ? "default" : "outline"}
                  onClick={() => setDiscountMode("percent")}
                >
                  %
                </Button>
              </div>
            </div>

            <div>
              <Label>Forma de pagamento</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {PAYMENT_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={paymentMethod === option.value ? "default" : "outline"}
                    className="h-16 flex-col gap-1"
                    onClick={() => setPaymentMethod(option.value)}
                  >
                    <span className="text-xl">{option.symbol}</span>
                    <span>{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {paymentMethod === "mixed" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {PAYMENT_OPTIONS.filter((option) => option.value !== "mixed").map((option) => (
                  <div key={option.value}>
                    <Label>{option.label}</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min={0}
                      step="0.01"
                      value={mixedPayment[option.value]}
                      onChange={(event) =>
                        setMixedPayment((currentPayment) => ({
                          ...currentPayment,
                          [option.value]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 p-4">
            <div className="grid gap-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Desconto</span>
                <span className="font-mono">{formatCurrency(discountAmount)}</span>
              </div>
              {cardFee > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span>Taxa de cartão</span>
                    <span className="font-mono">{formatCurrency(cardFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor líquido</span>
                    <span className="font-mono">{formatCurrency(netReceived)}</span>
                  </div>
                </>
              ) : null}
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <span className="text-sm font-semibold text-indigo-700">Total</span>
              <span className="font-mono text-4xl font-bold text-slate-950">
                {formatCurrency(finalTotal)}
              </span>
            </div>
          </div>

          <Button
            type="button"
            className="h-16 bg-emerald-600 text-lg font-bold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
            disabled={cartItems.length === 0}
            onClick={() => setIsPaymentModalOpen(true)}
          >
            FINALIZAR VENDA
          </Button>
        </div>
      </section>

      <PaymentModal
        open={isPaymentModalOpen}
        items={cartItems}
        saleInput={saleInput}
        finalTotal={finalTotal}
        paymentLabel={paymentLabel}
        isSubmitting={isSubmitting}
        onOpenChange={setIsPaymentModalOpen}
        onConfirm={handleConfirmSale}
      />
      <ReceiptModal
        open={isReceiptModalOpen}
        receipt={receipt}
        onOpenChange={setIsReceiptModalOpen}
        onNewSale={resetSale}
      />

      <Dialog open={isScannerOpen} onOpenChange={(open) => (!open ? closeScanner() : null)}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ler código de barras</DialogTitle>
            <DialogDescription>Aponte a câmera para o código e toque em capturar.</DialogDescription>
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
    </div>
  )
}
