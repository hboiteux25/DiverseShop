export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      cash_closings: {
        Row: {
          closed_by: string | null
          counted_cash: number | null
          created_at: string
          date: string
          difference: number | null
          expected_cash: number | null
          id: string
          notes: string | null
          total_card_fees: number | null
          total_credit: number | null
          total_debit: number | null
          total_discount: number | null
          total_pix: number | null
          total_sales: number | null
        }
        Insert: {
          closed_by?: string | null
          counted_cash?: number | null
          created_at?: string
          date: string
          difference?: never
          expected_cash?: number | null
          id?: string
          notes?: string | null
          total_card_fees?: number | null
          total_credit?: number | null
          total_debit?: number | null
          total_discount?: number | null
          total_pix?: number | null
          total_sales?: number | null
        }
        Update: {
          closed_by?: string | null
          counted_cash?: number | null
          created_at?: string
          date?: string
          difference?: never
          expected_cash?: number | null
          id?: string
          notes?: string | null
          total_card_fees?: number | null
          total_credit?: number | null
          total_debit?: number | null
          total_discount?: number | null
          total_pix?: number | null
          total_sales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_closings_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_purchase_price: number | null
          new_sale_price: number | null
          old_purchase_price: number | null
          old_sale_price: number | null
          product_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_purchase_price?: number | null
          new_sale_price?: number | null
          old_purchase_price?: number | null
          old_sale_price?: number | null
          product_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_purchase_price?: number | null
          new_sale_price?: number | null
          old_purchase_price?: number | null
          old_sale_price?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          box_number: number | null
          created_at: string
          description: string
          id: string
          min_stock: number
          purchase_price: number
          sale_price: number
          status: string
          stock_quantity: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          box_number?: number | null
          created_at?: string
          description: string
          id?: string
          min_stock?: number
          purchase_price: number
          sale_price: number
          status?: never
          stock_quantity?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          box_number?: number | null
          created_at?: string
          description?: string
          id?: string
          min_stock?: number
          purchase_price?: number
          sale_price?: number
          status?: never
          stock_quantity?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          discount: number
          id: string
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          discount?: number
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Update: {
          discount?: number
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cancel_reason: string | null
          card_fee_rate: number | null
          created_at: string
          created_by: string | null
          discount: number
          id: string
          net_received: number
          payment_method: string
          status: string
          total: number
        }
        Insert: {
          cancel_reason?: string | null
          card_fee_rate?: number | null
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          net_received: number
          payment_method: string
          status?: string
          total: number
        }
        Update: {
          cancel_reason?: string | null
          card_fee_rate?: number | null
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          net_received?: number
          payment_method?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          reason: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string
          delivery_days: number | null
          id: string
          name: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          delivery_days?: number | null
          id?: string
          name: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          delivery_days?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_daily_summary: {
        Args: {
          p_summary_date: string
        }
        Returns: {
          summary_date: string
          total_sales: number
          total_discount: number
          total_card_fees: number
          total_net_received: number
          cash_total: number
          pix_total: number
          credit_card_total: number
          debit_card_total: number
          mixed_total: number
          sales_count: number
          cancelled_sales_count: number
        }[]
      }
      get_low_stock_products: {
        Args: Record<string, never>
        Returns: {
          id: string
          barcode: string | null
          description: string
          box_number: number | null
          supplier_id: string | null
          supplier_name: string | null
          sale_price: number
          stock_quantity: number
          min_stock: number
          status: string
        }[]
      }
      get_monthly_summary: {
        Args: {
          p_summary_year: number
          p_summary_month: number
        }
        Returns: {
          summary_year: number
          summary_month: number
          total_sales: number
          total_discount: number
          total_card_fees: number
          total_net_received: number
          cash_total: number
          pix_total: number
          credit_card_total: number
          debit_card_total: number
          mixed_total: number
          sales_count: number
          cancelled_sales_count: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<
  TableName extends keyof PublicSchema["Tables"] | keyof PublicSchema["Views"],
> = TableName extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][TableName]["Row"]
  : TableName extends keyof PublicSchema["Views"]
    ? PublicSchema["Views"][TableName]
    : never

export type TablesInsert<TableName extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][TableName]["Insert"]

export type TablesUpdate<TableName extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][TableName]["Update"]

export type Enums<EnumName extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][EnumName]
