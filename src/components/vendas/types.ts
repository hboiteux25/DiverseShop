import type { SaleInput, PaymentMethod } from "@/lib/validations/sale"

export type PosProduct = {
  id: string
  barcode: string | null
  description: string
  sale_price: number
  stock_quantity: number
  status: string
}

export type CartItem = {
  product: PosProduct
  quantity: number
  unitPrice: number
  discount: number
}

export type ReceiptSale = {
  id: string
  created_at: string
  total: number
  discount: number
  net_received: number
  payment_method: PaymentMethod
  card_fee_rate: number | null
  payment_details: SaleInput["payment_details"]
  customer: {
    id: string
    name: string
    cpf: string
  } | null
  isOffline?: boolean
}

export type ReceiptData = {
  sale: ReceiptSale
  items: CartItem[]
}
