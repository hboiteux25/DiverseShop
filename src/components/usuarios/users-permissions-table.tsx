"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ShieldCheck, UserPlus, UserRound } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { createUser, updateUserRole, type AppUser, type UserRole } from "@/app/actions/users"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { userCreateSchema, type UserCreateInput } from "@/lib/validations/permissions"

type UsersPermissionsTableProps = {
  users: AppUser[]
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  operator: "Operador",
}

function normalizeRole(role: string): UserRole {
  return role === "admin" ? "admin" : "operator"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

export function UsersPermissionsTable({ users }: UsersPermissionsTableProps) {
  const [currentUsers, setCurrentUsers] = useState(users)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const form = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "operator",
    },
  })

  async function handleRoleChange(user: AppUser, role: UserRole) {
    if (normalizeRole(user.role) === role) {
      return
    }

    setPendingUserId(user.id)
    const result = await updateUserRole(user.id, role)
    setPendingUserId(null)

    if (result.error) {
      toast.error(result.message, {
        description: result.error,
      })
      return
    }

    if (result.data) {
      setCurrentUsers((current) =>
        current.map((currentUser) =>
          currentUser.id === user.id ? result.data : currentUser,
        ),
      )
    }

    toast.success(result.message)
  }

  async function handleCreateUser(data: UserCreateInput) {
    form.clearErrors("root")

    const result = await createUser(data)

    if (result.error || !result.data) {
      form.setError("root", {
        message: result.error ?? "Não foi possível cadastrar o usuário.",
      })
      return
    }

    setCurrentUsers((current) =>
      [result.data, ...current].sort((first, second) =>
        first.name.localeCompare(second.name, "pt-BR"),
      ),
    )
    form.reset({
      name: "",
      email: "",
      password: "",
      role: "operator",
    })
    toast.success(result.message)
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-2xl border border-slate-200 bg-white py-0 text-slate-950 shadow-sm">
        <CardHeader className="border-b border-slate-200 px-4 py-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus className="size-5 text-indigo-600" />
            Cadastrar usuário
          </CardTitle>
          <CardDescription>
            O primeiro acesso exige troca obrigatória da senha antes de liberar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 py-4">
          <form
            className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_170px_auto] lg:items-start"
            onSubmit={form.handleSubmit(handleCreateUser)}
          >
            <div className="grid gap-2">
              <Label htmlFor="new-user-name">Nome</Label>
              <Input
                id="new-user-name"
                placeholder="Nome do usuário"
                autoComplete="off"
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-user-email">E-mail</Label>
              <Input
                id="new-user-email"
                type="email"
                placeholder="usuario@diverseshopdf.com"
                autoComplete="off"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-user-password">Senha</Label>
              <Input
                id="new-user-password"
                type="password"
                placeholder="Senha inicial"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.password)}
                {...form.register("password")}
              />
              {form.formState.errors.password ? (
                <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Tipo de perfil</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(value) => {
                  form.setValue("role", normalizeRole(value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }}
              >
                <SelectTrigger className="h-10 bg-white text-left">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.role ? (
                <p className="text-sm text-red-600">{form.formState.errors.role.message}</p>
              ) : null}
            </div>

            <Button
              type="submit"
              className="mt-7 bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Salvando
                </>
              ) : (
                "Cadastrar"
              )}
            </Button>

            {form.formState.errors.root ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-5">
                {form.formState.errors.root.message}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white py-0 text-slate-950 shadow-sm">
        <CardHeader className="border-b border-slate-200 px-4 py-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="size-5 text-indigo-600" />
            Usuários cadastrados
          </CardTitle>
          <CardDescription>
            Administradores acessam todo o sistema. Operadores acessam as telas liberadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                <TableHead className="px-4 text-slate-500">Usuário</TableHead>
                <TableHead className="text-slate-500">Email</TableHead>
                <TableHead className="text-slate-500">Cadastro</TableHead>
                <TableHead className="text-slate-500">Status</TableHead>
                <TableHead className="px-4 text-right text-slate-500">Permissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentUsers.length > 0 ? (
                currentUsers.map((user) => {
                  const role = normalizeRole(user.role)
                  const isPending = pendingUserId === user.id

                  return (
                    <TableRow key={user.id} className="border-slate-100 hover:bg-indigo-50/40">
                      <TableCell className="px-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                            <UserRound className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-950">{user.name}</p>
                            <Badge
                              variant="outline"
                              className={
                                role === "admin"
                                  ? "mt-1 border-indigo-200 bg-indigo-50 text-indigo-700"
                                  : "mt-1 border-slate-200 bg-slate-50 text-slate-700"
                              }
                            >
                              {ROLE_LABELS[role]}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {user.email ?? "Email não registrado"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-600">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell>
                        {user.must_change_password ? (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700"
                          >
                            Troca pendente
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            Ativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <div className="ml-auto flex max-w-52 items-center justify-end gap-2">
                          {isPending ? (
                            <Loader2 className="size-4 animate-spin text-indigo-600" />
                          ) : null}
                          <Select
                            value={role}
                            disabled={isPending}
                            onValueChange={(value) => {
                              const nextRole = normalizeRole(value)
                              void handleRoleChange(user, nextRole)
                            }}
                          >
                            <SelectTrigger className="h-10 w-40 bg-white text-left">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="operator">Operador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
