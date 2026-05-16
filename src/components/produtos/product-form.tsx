"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import type { Supplier } from "@/app/actions/suppliers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  productSchema,
  type ProductFormData,
  type ProductFormInput,
} from "@/lib/validations/product"

type ProductFormProps = {
  suppliers: Supplier[]
}

export function ProductForm({ suppliers }: ProductFormProps) {
  const form = useForm<ProductFormInput, unknown, ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      description: "",
      barcode: "",
      purchase_price: 0,
      sale_price: 0,
      min_stock: 2,
      supplier_id: "",
    },
  })

  return (
    <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor="product-description">Descrição</Label>
        <Input
          id="product-description"
          placeholder="Nome do produto"
          {...form.register("description")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="product-barcode">Código de barras</Label>
        <Input
          id="product-barcode"
          placeholder="Opcional"
          {...form.register("barcode")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Fornecedor</Label>
        <Select
          value={form.watch("supplier_id")}
          onValueChange={(value) => form.setValue("supplier_id", value)}
        >
          <SelectTrigger className="h-10 w-full bg-white">
            <SelectValue placeholder="Selecione um fornecedor" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {suppliers.length === 0 ? (
          <p className="text-sm text-amber-600">
            Cadastre um fornecedor antes de criar produtos.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="purchase-price">Preço de compra</Label>
        <Input
          id="purchase-price"
          type="number"
          min={0}
          step="0.01"
          {...form.register("purchase_price", { valueAsNumber: true })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sale-price">Preço de venda</Label>
        <Input
          id="sale-price"
          type="number"
          min={0}
          step="0.01"
          {...form.register("sale_price", { valueAsNumber: true })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="min-stock">Estoque mínimo</Label>
        <Input
          id="min-stock"
          type="number"
          min={0}
          step={1}
          {...form.register("min_stock", { valueAsNumber: true })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="box-number">Número da caixa</Label>
        <Input
          id="box-number"
          type="number"
          min={1}
          step={1}
          placeholder="Opcional"
          {...form.register("box_number", { valueAsNumber: true })}
        />
      </div>

      <div className="md:col-span-2">
        <Button type="button" disabled className="h-10">
          Salvar produto
        </Button>
      </div>
    </form>
  )
}
