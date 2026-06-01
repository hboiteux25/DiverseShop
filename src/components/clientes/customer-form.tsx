"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import {
  createCustomer,
  updateCustomer,
  type Customer,
} from "@/app/actions/customers"
import { formatCpf, formatPhone } from "@/components/clientes/customer-formatters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  customerSchema,
  type CustomerFormData,
  type CustomerFormInput,
} from "@/lib/validations/customer"

type CustomerFormProps = {
  customer?: Customer
  submitLabel?: string
  onSaved?: (customer: Customer) => void
}

export function CustomerForm({ customer, submitLabel, onSaved }: CustomerFormProps) {
  const router = useRouter()
  const form = useForm<CustomerFormInput, unknown, CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? "",
      cpf: customer?.cpf ? formatCpf(customer.cpf) : "",
      phone: customer?.phone ? formatPhone(customer.phone) : "",
      email: customer?.email ?? "",
    },
  })

  async function handleSubmit(data: CustomerFormData) {
    form.clearErrors("root")
    const result = customer
      ? await updateCustomer(customer.id, data)
      : await createCustomer(data)

    if (result.error || !result.data) {
      form.setError("root", { message: result.error })
      toast.error(result.message, { description: result.error })
      return
    }

    toast.success(result.message)
    if (onSaved) {
      onSaved(result.data)
      return
    }

    router.refresh()
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
      <div className="grid gap-2">
        <Label htmlFor="customer-name">Nome*</Label>
        <Input
          id="customer-name"
          placeholder="Nome do cliente"
          aria-invalid={Boolean(form.formState.errors.name)}
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="customer-cpf">CPF*</Label>
        <Input
          id="customer-cpf"
          inputMode="numeric"
          placeholder="000.000.000-00"
          aria-invalid={Boolean(form.formState.errors.cpf)}
          {...form.register("cpf", {
            onChange: (event) => {
              form.setValue("cpf", formatCpf(event.target.value), {
                shouldDirty: true,
                shouldValidate: false,
              })
            },
          })}
        />
        {form.formState.errors.cpf ? (
          <p className="text-sm text-red-600">{form.formState.errors.cpf.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="customer-phone">Telefone</Label>
        <Input
          id="customer-phone"
          inputMode="tel"
          placeholder="(61) 99999-9999"
          aria-invalid={Boolean(form.formState.errors.phone)}
          {...form.register("phone", {
            onChange: (event) => {
              form.setValue("phone", formatPhone(event.target.value), {
                shouldDirty: true,
                shouldValidate: false,
              })
            },
          })}
        />
        {form.formState.errors.phone ? (
          <p className="text-sm text-red-600">{form.formState.errors.phone.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="customer-email">E-mail</Label>
        <Input
          id="customer-email"
          type="email"
          placeholder="cliente@email.com"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
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
        ) : (
          submitLabel ?? (customer ? "Salvar alterações" : "Criar cliente")
        )}
      </Button>
    </form>
  )
}
