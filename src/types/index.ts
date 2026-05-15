export type UserRole = "admin" | "operator"

export type PaymentMethod = "cash" | "pix" | "credit_card" | "debit_card"

export type StockMovementType = "in" | "out" | "adjustment"

export interface Product {
  id: string
  barcode: string | null
  description: string
  box_number: number | null
  supplier_id: string
  purchase_price: number
  sale_price: number
  stock_quantity: number
  min_stock: number
  created_at: string
  updated_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  discount: number
}

export interface Sale {
  id: string
  items: SaleItem[]
  total: number
  discount: number
  payment_method: PaymentMethod
  card_fee_rate: number | null
  net_received: number
  created_by: string
  created_at: string
}
