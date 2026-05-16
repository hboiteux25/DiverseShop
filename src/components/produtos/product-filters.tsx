"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"

import type { Supplier } from "@/app/actions/suppliers"
import { Input } from "@/components/ui/input"

type ProductFiltersProps = {
  suppliers: Supplier[]
}

export function ProductFilters({ suppliers }: ProductFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (!value || value === "all") {
      params.delete(key)
    } else {
      params.set(key, value)
    }

    router.push(`/produtos?${params.toString()}`)
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_220px_180px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          defaultValue={searchParams.get("q") ?? ""}
          className="h-10 bg-white pl-9"
          placeholder="Buscar por descrição ou código de barras"
          onChange={(event) => updateParam("q", event.target.value)}
        />
      </div>

      <select
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        defaultValue={searchParams.get("supplier") ?? "all"}
        onChange={(event) => updateParam("supplier", event.target.value)}
      >
        <option value="all">Todos os fornecedores</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>

      <select
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        defaultValue={searchParams.get("status") ?? "all"}
        onChange={(event) => updateParam("status", event.target.value)}
      >
        <option value="all">Todos os status</option>
        <option value="in_stock">Em estoque</option>
        <option value="low_stock">Estoque baixo</option>
        <option value="out_of_stock">Sem estoque</option>
      </select>
    </div>
  )
}
