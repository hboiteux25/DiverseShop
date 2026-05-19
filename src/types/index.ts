export type UserRole = "admin" | "operator"

export type ScreenDefaultAccess = "admin" | "operator"

export type PaymentMethod = "cash" | "pix" | "credit_card" | "debit_card"

export type StockMovementType = "in" | "out" | "adjustment"

export interface AppScreen {
  id: string
  route_path: string
  title: string
  description: string
  icon_name: string
  sort_order: number
  show_in_navigation: boolean
  default_access: ScreenDefaultAccess
  created_at: string
  updated_at: string
}

export interface RoleScreenPermission {
  role: UserRole
  screen_id: string
  can_access: boolean
  updated_by: string | null
  updated_at: string
}

export interface AppAction {
  id: string
  area: string
  title: string
  description: string
  default_access: ScreenDefaultAccess
  created_at: string
  updated_at: string
}

export interface RoleActionPermission {
  role: UserRole
  action_id: string
  can_execute: boolean
  updated_by: string | null
  updated_at: string
}

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
