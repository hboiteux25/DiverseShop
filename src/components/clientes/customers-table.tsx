"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Edit, Eye, Plus, Search, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteCustomer, type Customer } from "@/app/actions/customers"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CustomersTableProps = {
  customers: Customer[]
}

const PAGE_SIZE = 20

function getCustomerStatus(customer: Customer) {
  return customer.deleted_at ? "Inativo" : "Ativo"
}

export function CustomersTable({ customers }: CustomersTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "active")
  const [page, setPage] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE))
  const pageCustomers = useMemo(
    () => customers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [customers, page],
  )

  function refreshPage() {
    startTransition(() => {
      router.refresh()
    })
  }

  function applyFilters(nextQuery = query, nextStatus = status) {
    const params = new URLSearchParams()

    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim())
    }

    if (nextStatus !== "active") {
      params.set("status", nextStatus)
    }

    setPage(1)
    router.push(`/clientes${params.size ? `?${params.toString()}` : ""}`)
  }

  async function handleDelete(customer: Customer) {
    const shouldDelete = window.confirm(
      `Inativar o cliente "${customer.name}"? Ele será ocultado das buscas principais.`,
    )

    if (!shouldDelete) {
      return
    }

    setPendingDeleteId(customer.id)
    const result = await deleteCustomer(customer.id)
    setPendingDeleteId(null)

    if (result.error) {
      toast.error(result.message, { description: result.error })
      return
    }

    toast.success(result.message)
    refreshPage()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1 sm:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyFilters()
                }
              }}
              className="h-10 bg-white pl-9"
              placeholder="Buscar por nome, CPF, telefone ou e-mail"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value)
              applyFilters(query, value)
            }}
          >
            <SelectTrigger className="h-10 bg-white sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={() => applyFilters()}>
            Buscar
          </Button>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 bg-gradient-to-r from-indigo-600 to-sky-500 text-white hover:from-indigo-700 hover:to-sky-600">
              <Plus />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-200 bg-white sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
              <DialogDescription>
                Cadastre os dados básicos para localizar e vincular o cliente nas vendas.
              </DialogDescription>
            </DialogHeader>
            <CustomerForm
              onSaved={() => {
                setIsCreateOpen(false)
                refreshPage()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
              <TableHead className="px-4 py-3 text-slate-600">Nome</TableHead>
              <TableHead className="px-4 py-3 text-slate-600">CPF</TableHead>
              <TableHead className="px-4 py-3 text-slate-600">Telefone</TableHead>
              <TableHead className="px-4 py-3 text-slate-600">E-mail</TableHead>
              <TableHead className="px-4 py-3 text-slate-600">Status</TableHead>
              <TableHead className="px-4 py-3 text-right text-slate-600">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageCustomers.length > 0 ? (
              pageCustomers.map((customer) => (
                <TableRow key={customer.id} className="border-slate-100 hover:bg-slate-50">
                  <TableCell className="px-4 py-3 font-medium text-slate-950">
                    {customer.name}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-mono text-slate-600">
                    {formatCpf(customer.cpf)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">
                    {customer.phone ? formatPhone(customer.phone) : "Não informado"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">
                    {customer.email ?? "Não informado"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        customer.deleted_at
                          ? "border-slate-200 bg-slate-50 text-slate-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }
                    >
                      {getCustomerStatus(customer)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button asChild type="button" variant="outline" size="sm">
                        <Link href={`/clientes/${customer.id}`}>
                          <Eye />
                          Ver
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingCustomer(customer)}
                      >
                        <Edit />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={Boolean(customer.deleted_at) || pendingDeleteId === customer.id || isPending}
                        onClick={() => {
                          void handleDelete(customer)
                        }}
                      >
                        <Trash2 />
                        Inativar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <span>
          Página {page} de {totalPages} • {customers.length} cliente(s)
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
          >
            Próxima
          </Button>
        </div>
      </div>

      <Dialog
        open={Boolean(editingCustomer)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCustomer(null)
          }
        }}
      >
        <DialogContent className="border-slate-200 bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Atualize os dados básicos usados no atendimento.</DialogDescription>
          </DialogHeader>
          {editingCustomer ? (
            <CustomerForm
              customer={editingCustomer}
              onSaved={() => {
                setEditingCustomer(null)
                refreshPage()
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
