"use client"

import { Loader2, Search, UserPlus, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { getCustomers, type Customer } from "@/app/actions/customers"
import { CustomerForm } from "@/components/clientes/customer-form"
import { formatCpf, formatPhone } from "@/components/clientes/customer-formatters"
import { Badge } from "@/components/ui/badge"
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

type CustomerSaleSelectorProps = {
  selectedCustomer: Customer | null
  onSelectCustomer: (customer: Customer | null) => void
}

function matchesSelectedCustomer(customer: Customer, selectedCustomer: Customer | null) {
  return selectedCustomer?.id === customer.id
}

export function CustomerSaleSelector({
  selectedCustomer,
  onSelectCustomer,
}: CustomerSaleSelectorProps) {
  const [query, setQuery] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) {
      setCustomers([])
      setIsSearching(false)
      return
    }

    let isCurrentSearch = true
    setIsSearching(true)
    const timeoutId = window.setTimeout(async () => {
      const result = await getCustomers({ search: trimmedQuery, status: "active" })

      if (!isCurrentSearch) {
        return
      }

      if (result.error || !result.data) {
        setCustomers([])
        toast.error(result.message, { description: result.error })
      } else {
        setCustomers(result.data.slice(0, 5))
      }

      setIsSearching(false)
    }, 250)

    return () => {
      isCurrentSearch = false
      window.clearTimeout(timeoutId)
    }
  }, [query])

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor="sale-customer-search">Cliente da venda</Label>
          <p className="mt-1 text-sm text-slate-500">Opcional, a venda continua sem cliente.</p>
        </div>
        <Dialog open={isQuickCreateOpen} onOpenChange={setIsQuickCreateOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <UserPlus />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-200 bg-white sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Cadastro rápido de cliente</DialogTitle>
              <DialogDescription>
                Ao salvar, o cliente será vinculado automaticamente à venda atual.
              </DialogDescription>
            </DialogHeader>
            <CustomerForm
              submitLabel="Cadastrar e vincular"
              onSaved={(customer) => {
                onSelectCustomer(customer)
                setQuery(customer.name)
                setCustomers([])
                setIsQuickCreateOpen(false)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {selectedCustomer ? (
        <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-950">{selectedCustomer.name}</p>
            <p className="mt-1 text-sm text-indigo-800">
              {formatCpf(selectedCustomer.cpf)}
              {selectedCustomer.phone ? ` • ${formatPhone(selectedCustomer.phone)}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="border-indigo-200 bg-white text-indigo-700">
              Vinculado
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onSelectCustomer(null)}
            >
              <X />
              <span className="sr-only">Remover cliente</span>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          id="sale-customer-search"
          value={query}
          className="h-11 bg-white pl-9"
          placeholder="Buscar por CPF, nome, telefone ou e-mail"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {query.trim().length >= 2 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {isSearching ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Buscando clientes...
            </div>
          ) : customers.length > 0 ? (
            customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-indigo-50"
                onClick={() => onSelectCustomer(customer)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-950">
                    {customer.name}
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">
                    {formatCpf(customer.cpf)}
                    {customer.phone ? ` • ${formatPhone(customer.phone)}` : ""}
                    {customer.email ? ` • ${customer.email}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-indigo-700">
                  {matchesSelectedCustomer(customer, selectedCustomer) ? "Selecionado" : "Vincular"}
                </span>
              </button>
            ))
          ) : (
            <div className="flex flex-col gap-2 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Nenhum cliente encontrado.</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsQuickCreateOpen(true)}>
                <UserPlus />
                Cadastrar agora
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
