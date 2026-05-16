"use client"

import * as XLSX from "xlsx"
import { FileSpreadsheet, Upload } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { importProducts, type ProductImportMapping } from "@/app/actions/products"
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
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type PreviewRow = Record<string, unknown>

const DEFAULT_MAPPING = {
  description: "Descrição dos Produto",
  barcode: "Codigo de Barras",
  supplier_name: "Fornecedor",
  purchase_price: "Valor de Compra",
  sale_price: "Valor de Venda",
  stock_quantity: "Quantidade em Estoque",
  box_number: "Numero da Caixa",
} satisfies ProductImportMapping

const FIELD_LABELS: Record<keyof ProductImportMapping, string> = {
  description: "Descrição",
  barcode: "Código de barras",
  supplier_name: "Fornecedor",
  purchase_price: "Valor de compra",
  sale_price: "Valor de venda",
  stock_quantity: "Quantidade em estoque",
  box_number: "Número da caixa",
}

const PRODUCT_IMPORT_FIELDS = [
  "description",
  "barcode",
  "supplier_name",
  "purchase_price",
  "sale_price",
  "stock_quantity",
  "box_number",
] satisfies Array<keyof ProductImportMapping>

function stringifyCell(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return ""
  }

  return String(value)
}

export function ImportDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [mapping, setMapping] = useState<ProductImportMapping>(DEFAULT_MAPPING)
  const [progress, setProgress] = useState(0)
  const [rowErrors, setRowErrors] = useState<Array<{ row: number; message: string }>>([])
  const [isPending, startTransition] = useTransition()

  const previewColumns = useMemo(() => columns.slice(0, 8), [columns])

  async function handleFileChange(selectedFile: File | null) {
    setFile(selectedFile)
    setPreviewRows([])
    setColumns([])
    setRowErrors([])
    setProgress(0)

    if (!selectedFile) {
      return
    }

    const buffer = await selectedFile.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const firstSheetName = workbook.SheetNames[0]

    if (!firstSheetName) {
      toast.error("Arquivo sem planilhas para importar.")
      return
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<PreviewRow>(worksheet, {
      defval: "",
    })
    const detectedColumns = Object.keys(rows[0] ?? {})

    setPreviewRows(rows.slice(0, 5))
    setColumns(detectedColumns)
    setMapping((currentMapping) => {
      const nextMapping: ProductImportMapping = { ...currentMapping }

      for (const field of PRODUCT_IMPORT_FIELDS) {
        const defaultColumn = DEFAULT_MAPPING[field]
        nextMapping[field] = detectedColumns.includes(defaultColumn)
          ? defaultColumn
          : currentMapping[field]
      }

      return nextMapping
    })
  }

  async function handleImport() {
    if (!file) {
      toast.error("Selecione um arquivo para importar.")
      return
    }

    setProgress(30)
    setRowErrors([])
    const result = await importProducts(file, mapping)
    setProgress(100)

    if (result.error) {
      toast.error(result.message, {
        description: result.error,
      })
      return
    }

    if (!result.data) {
      toast.error("Importação sem retorno do servidor.")
      return
    }

    setRowErrors(result.data.errors)
    toast.success(result.message, {
      description: `${result.data.inserted} produto(s) importado(s).`,
    })

    startTransition(() => {
      router.refresh()
    })
  }

  function resetDialog(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      setFile(null)
      setColumns([])
      setPreviewRows([])
      setRowErrors([])
      setProgress(0)
      setMapping(DEFAULT_MAPPING)
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10">
          <FileSpreadsheet />
          Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-200 bg-white sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar produtos</DialogTitle>
          <DialogDescription>
            Envie uma planilha Excel ou CSV, revise o mapeamento e importe os produtos em lote.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="product-import-file">Arquivo</Label>
            <Input
              id="product-import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => {
                void handleFileChange(event.target.files?.[0] ?? null)
              }}
            />
          </div>

          {columns.length > 0 ? (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              {PRODUCT_IMPORT_FIELDS.map((field) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <Label>{FIELD_LABELS[field]}</Label>
                  <select
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    value={mapping[field]}
                    onChange={(event) =>
                      setMapping((currentMapping) => ({
                        ...currentMapping,
                        [field]: event.target.value,
                      }))
                    }
                  >
                    {columns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : null}

          {previewRows.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    {previewColumns.map((column) => (
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, index) => (
                    <TableRow key={`preview-${index}`}>
                      {previewColumns.map((column) => (
                        <TableCell key={column}>{stringifyCell(row[column])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {progress > 0 ? <Progress value={progress} /> : null}

          {rowErrors.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Erros encontrados por linha</p>
              <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5">
                {rowErrors.map((error) => (
                  <li key={`${error.row}-${error.message}`}>
                    Linha {error.row}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => resetDialog(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              className="bg-gradient-to-r from-indigo-600 to-sky-500 text-white"
              disabled={!file || isPending}
              onClick={handleImport}
            >
              <Upload />
              Importar produtos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
