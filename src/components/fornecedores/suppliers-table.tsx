"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Edit, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteSupplier, type Supplier } from "@/app/actions/suppliers"
import { SupplierForm } from "@/components/fornecedores/supplier-form"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type SuppliersTableProps = {
  suppliers: Supplier[]
}

function formatDeliveryDays(days: number | null) {
  if (!days) {
    return "Não informado"
  }

  return `${days} ${days === 1 ? "dia" : "dias"}`
}

export function SuppliersTable({ suppliers }: SuppliersTableProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return suppliers
    }

    return suppliers.filter((supplier) =>
      supplier.name.toLowerCase().includes(normalizedQuery),
    )
  }, [query, suppliers])

  function refreshPage() {
    startTransition(() => {
      router.refresh()
    })
  }

  async function handleDelete(supplier: Supplier) {
    const shouldDelete = window.confirm(
      `Excluir o fornecedor "${supplier.name}"? Esta ação não poderá ser desfeita.`,
    )

    if (!shouldDelete) {
      return
    }

    setPendingDeleteId(supplier.id)
    const result = await deleteSupplier(supplier.id)
    setPendingDeleteId(null)

    if (result.error) {
      toast.error(result.message, {
        description: result.error,
      })
      return
    }

    toast.success(result.message)
    refreshPage()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 bg-white pl-9"
            placeholder="Buscar fornecedor por nome"
          />
        </div>

        <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
          <DialogTrigger asChild>
            <Button className="h-10 bg-gradient-to-r from-indigo-600 to-sky-500 text-white hover:from-indigo-700 hover:to-sky-600">
              <Plus />
              Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent className="border-slate-200 bg-white sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo fornecedor</DialogTitle>
              <DialogDescription>
                Cadastre fornecedores para vincular produtos e acompanhar prazos de entrega.
              </DialogDescription>
            </DialogHeader>
            <SupplierForm
              onSaved={() => {
                setOpenCreateDialog(false)
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
              <TableHead className="px-4 py-3 text-slate-600">Contato</TableHead>
              <TableHead className="px-4 py-3 text-slate-600">Prazo de Entrega</TableHead>
              <TableHead className="px-4 py-3 text-slate-600">Qtd. Produtos</TableHead>
              <TableHead className="px-4 py-3 text-right text-slate-600">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="border-slate-100 hover:bg-slate-50">
                  <TableCell className="px-4 py-3 font-medium text-slate-950">
                    {supplier.name}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">
                    {supplier.contact ?? "Não informado"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">
                    {formatDeliveryDays(supplier.delivery_days)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">
                    {supplier.product_count}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingSupplier(supplier)}
                      >
                        <Edit />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={
                          pendingDeleteId === supplier.id ||
                          isPending ||
                          supplier.product_count > 0
                        }
                        title={
                          supplier.product_count > 0
                            ? "Fornecedor com produtos vinculados não pode ser excluído"
                            : "Excluir fornecedor"
                        }
                        onClick={() => {
                          void handleDelete(supplier)
                        }}
                      >
                        <Trash2 />
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Nenhum fornecedor encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(editingSupplier)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSupplier(null)
          }
        }}
      >
        <DialogContent className="border-slate-200 bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar fornecedor</DialogTitle>
            <DialogDescription>
              Atualize os dados de contato e prazo de entrega do fornecedor.
            </DialogDescription>
          </DialogHeader>
          {editingSupplier ? (
            <SupplierForm
              supplier={editingSupplier}
              onSaved={() => {
                setEditingSupplier(null)
                refreshPage()
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
