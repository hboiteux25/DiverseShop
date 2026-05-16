"use client"

import { useCallback, useEffect, useState } from "react"

import { getLowStockProducts, getOutOfStockProducts } from "@/app/actions/stock"
import { createClient } from "@/lib/supabase/client"

export function useRealtimeStock() {
  const [criticalCount, setCriticalCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)

  const refreshCriticalCount = useCallback(async () => {
    const [lowStockResult, outOfStockResult] = await Promise.all([
      getLowStockProducts(),
      getOutOfStockProducts(),
    ])

    setCriticalCount((lowStockResult.data?.length ?? 0) + (outOfStockResult.data?.length ?? 0))
  }, [])

  useEffect(() => {
    const supabase = createClient()
    void refreshCriticalCount()

    const channel = supabase
      .channel("stock-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stock_movements",
        },
        () => {
          void refreshCriticalCount()
        },
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED")
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refreshCriticalCount])

  return {
    criticalCount,
    isConnected,
    refreshCriticalCount,
  }
}
