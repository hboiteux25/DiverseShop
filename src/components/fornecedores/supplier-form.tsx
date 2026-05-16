"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import {
  createSupplier,
  updateSupplier,
  type Supplier,
} from "@/app/actions/suppliers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  supplierSchema,
  type SupplierFormData,
  type SupplierFormInput,
} from "@/lib/validations/supplier"

type SupplierFormProps = {
  supplier?: Supplier
  onSaved?: () => void
}

export function SupplierForm({ supplier, onSaved }: SupplierFormProps) {
  const form = useForm<SupplierFormInput, unknown, SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name ?? "",
      contact: supplier?.contact ?? "",
      delivery_days: supplier?.delivery_days ?? undefined,
    },
  })

  useEffect(() => {
    form.reset({
      name: supplier?.name ?? "",
      contact: supplier?.contact ?? "",
      delivery_days: supplier?.delivery_days ?? undefined,
    })
  }, [form, supplier])

  async function handleSubmit(data: SupplierFormData) {
    form.clearErrors("root")

    const result = supplier
      ? await updateSupplier(supplier.id, data)
      : await createSupplier(data)

    if (result.error) {
      form.setError("root", {
        message: result.error,
      })
      toast.error(result.message, {
        description: result.error,
      })
      return
    }

    toast.success(result.message)
    form.reset({
      name: "",
      contact: "",
      delivery_days: undefined,
    })
    onSaved?.()
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="supplier-name">Nome*</Label>
        <Input
          id="supplier-name"
          placeholder="Nome do fornecedor"
          aria-invalid={Boolean(form.formState.errors.name)}
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="supplier-contact">Contato</Label>
        <Input
          id="supplier-contact"
          placeholder="telefone ou email"
          aria-invalid={Boolean(form.formState.errors.contact)}
          {...form.register("contact")}
        />
        {form.formState.errors.contact ? (
          <p className="text-sm text-red-600">{form.formState.errors.contact.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="supplier-delivery-days">Prazo de entrega (dias)</Label>
        <Input
          id="supplier-delivery-days"
          type="number"
          min={1}
          step={1}
          placeholder="Ex.: 7"
          aria-invalid={Boolean(form.formState.errors.delivery_days)}
          {...form.register("delivery_days")}
        />
        {form.formState.errors.delivery_days ? (
          <p className="text-sm text-red-600">
            {form.formState.errors.delivery_days.message}
          </p>
        ) : null}
      </div>

      {form.formState.errors.root ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {form.formState.errors.root.message}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-10 bg-gradient-to-r from-indigo-600 to-sky-500 text-white hover:from-indigo-700 hover:to-sky-600"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Salvando
          </>
        ) : supplier ? (
          "Salvar alterações"
        ) : (
          "Criar fornecedor"
        )}
      </Button>
    </form>
  )
}
