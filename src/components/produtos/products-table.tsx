"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { ArrowUpDown, Edit, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { deleteProduct, type Product, type ProductSortKey, type ProductStatus } from "@/app/actions/products"
import { ImportDialog } from "@/components/produtos/import-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ProductsTableProps = {
  products: Product[]
}

type SortDirection = "asc" | "desc"

const PAGE_SIZE = 20

const STATUS_LABELS: Record<ProductStatus, string> = {
  in_stock: "Em estoque",
  low_stock: "Estoque baixo",
  out_of_stock: "Sem estoque",
}

const STATUS_CLASS_NAMES: Record<ProductStatus, string> = {
  in_stock: "border-emerald-200 bg-emerald-50 text-emerald-700",
  low_stock: "border-amber-200 bg-amber-50 text-amber-700",
  out_of_stock: "border-red-200 bg-red-50 text-red-700",
}

function getProductStatus(status: string): ProductStatus {
  if (status === "low_stock" || status === "out_of_stock") {
    return status
  }

  return "in_stock"
}

function getProfitMargin(product: Product) {
  if (product.sale_price <= 0) {
    return 0
  }

  return ((product.sale_price - product.purchase_price) / product.sale_price) * 100
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function compareText(left: string | null, right: string | null) {
  return (left ?? "").localeCompare(right ?? "", "pt-BR")
}

function getSortValue(product: Product, key: ProductSortKey) {
  switch (key) {
    case "description":
      return product.description
    case "barcode":
      return product.barcode
    case "supplier":
      return product.supplier_name
    case "box_number":
      return product.box_number ?? 0
    case "purchase_price":
      return product.purchase_price
    case "sale_price":
      return product.sale_price
    case "profit":
      return getProfitMargin(product)
    case "stock_quantity":
      return product.stock_quantity
    case "status":
      return product.status
  }
}

function SortButton({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
}: {
  label: string
  sortKey: ProductSortKey
  activeSortKey: ProductSortKey
  direction: SortDirection
  onSort: (key: ProductSortKey) => void
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-950"
      onClick={() => onSort(sortKey)}
    >
      {label}
      <ArrowUpDown
        className={`size-3.5 ${activeSortKey === sortKey ? "text-indigo-600" : "text-slate-400"}`}
      />
      <span className="sr-only">
        {activeSortKey === sortKey ? `Ordenado ${direction}` : "Ordenar coluna"}
      </span>
    </button>
  )
}

export function ProductsTable({ products }: ProductsTableProps) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<ProductSortKey>("description")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [page, setPage] = useState(1)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sortedProducts = useMemo(() => {
    return [...products].sort((left, right) => {
      const leftValue = getSortValue(left, sortKey)
      const rightValue = getSortValue(right, sortKey)
      const directionMultiplier = sortDirection === "asc" ? 1 : -1

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * directionMultiplier
      }

      return compareText(String(leftValue ?? ""), String(rightValue ?? "")) * directionMultiplier
    })
  }, [products, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE))
  const pageProducts = sortedProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSort(nextSortKey: ProductSortKey) {
    setPage(1)
    setSortKey((currentSortKey) => {
      if (currentSortKey === nextSortKey) {
        setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"))
        return currentSortKey
      }

      setSortDirection("asc")
      return nextSortKey
    })
  }

  async function handleDelete(product: Product) {
    const shouldDelete = window.confirm(
      `Excluir o produto "${product.description}"? Ele será ocultado das listagens.`,
    )

    if (!shouldDelete) {
      return
    }

    setPendingDeleteId(product.id)
    const result = await deleteProduct(product.id)
    setPendingDeleteId(null)

    if (result.error) {
      toast.error(result.message, {
        description: result.error,
      })
      return
    }

    toast.success(result.message)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <ImportDialog />
        <Button asChild className="h-10 bg-gradient-to-r from-indigo-600 to-sky-500 text-white">
          <Link href="/produtos/novo">
            <Plus />
            Novo Produto
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="px-4 py-3">
                <SortButton
                  label="Descrição"
                  sortKey="description"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="px-4 py-3">
                <SortButton
                  label="Código de Barras"
                  sortKey="barcode"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="px-4 py-3">
                <SortButton
                  label="Fornecedor"
                  sortKey="supplier"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="px-4 py-3">
                <SortButton
                  label="Nº Caixa"
                  sortKey="box_number"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="px-4 py-3">
                <SortButton
                  label="Compra"
                  sortKey="purchase_price"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="px-4 py-3">
                <SortButton
                  label="Venda"
                  sortKey="sale_price"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="px-4 py-3">
                <SortButton
                  label="Lucro (%)"
                  sortKey="profit"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="px-4 py-3">
                <SortButton
                  label="Estoque"
                  sortKey="stock_quantity"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="px-4 py-3">
                <SortButton
                  label="Status"
                  sortKey="status"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="px-4 py-3 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageProducts.length > 0 ? (
              pageProducts.map((product) => {
                const status = getProductStatus(product.status)

                return (
                  <TableRow key={product.id} className="border-slate-100 hover:bg-slate-50">
                    <TableCell className="px-4 py-3 font-medium text-slate-950">
                      {product.description}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-600">
                      {product.barcode ?? "Não informado"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-600">
                      {product.supplier_name ?? "Não informado"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-600">
                      {product.box_number ?? "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono text-slate-600">
                      {formatCurrency(product.purchase_price)}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono text-slate-600">
                      {formatCurrency(product.sale_price)}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono text-slate-600">
                      {getProfitMargin(product).toFixed(1)}%
                    </TableCell>
                    <TableCell className="px-4 py-3 text-slate-600">
                      {product.stock_quantity}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className={STATUS_CLASS_NAMES[status]}>
                        {STATUS_LABELS[status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button asChild type="button" variant="outline" size="sm">
                          <Link href={`/produtos/${product.id}`}>
                            <Edit />
                            Editar
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={pendingDeleteId === product.id || isPending}
                          onClick={() => {
                            void handleDelete(product)
                          }}
                        >
                          <Trash2 />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="px-4 py-10 text-center text-slate-500">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <span>
          Página {page} de {totalPages} • {sortedProducts.length} produto(s)
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
    </div>
  )
}
