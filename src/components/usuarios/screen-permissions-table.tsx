"use client"

import { Loader2, MonitorCog, ShieldCheck } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  updateRoleScreenPermission,
  type ScreenPermissionsConfiguration,
} from "@/app/actions/screen-permissions"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ScreenAccessItem } from "@/lib/permissions/shared"
import { screenPermissionUpdateSchema } from "@/lib/validations/permissions"

type ScreenPermissionsTableProps = {
  configuration: ScreenPermissionsConfiguration
}

function getPermissionStateKey(role: string, screenId: string) {
  return `${role}:${screenId}`
}

function countAccessibleScreens(screens: ScreenAccessItem[]) {
  return screens.filter((screen) => screen.canAccess).length
}

export function ScreenPermissionsTable({ configuration }: ScreenPermissionsTableProps) {
  const [screens, setScreens] = useState(configuration.screens)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const accessibleCount = useMemo(() => countAccessibleScreens(screens), [screens])

  function handlePermissionChange(screen: ScreenAccessItem, checked: boolean) {
    const payload = {
      role: configuration.role,
      screenId: screen.id,
      canAccess: checked,
    }

    const parsedPayload = screenPermissionUpdateSchema.safeParse(payload)

    if (!parsedPayload.success) {
      toast.error("Permissão inválida.", {
        description: "Confira a tela antes de salvar.",
      })
      return
    }

    const stateKey = getPermissionStateKey(configuration.role, screen.id)
    setPendingKey(stateKey)
    setScreens((currentScreens) =>
      currentScreens.map((currentScreen) =>
        currentScreen.id === screen.id
          ? { ...currentScreen, canAccess: checked }
          : currentScreen,
      ),
    )

    startTransition(async () => {
      const result = await updateRoleScreenPermission(parsedPayload.data)
      setPendingKey(null)

      if (result.error) {
        setScreens((currentScreens) =>
          currentScreens.map((currentScreen) =>
            currentScreen.id === screen.id
              ? { ...currentScreen, canAccess: screen.canAccess }
              : currentScreen,
          ),
        )
        toast.error(result.message, {
          description: result.error,
        })
        return
      }

      toast.success(result.message)
    })
  }

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white py-0 text-slate-950 shadow-sm">
      <CardHeader className="border-b border-slate-200 px-4 py-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <MonitorCog className="size-5 text-indigo-600" />
          Permissões por tela
        </CardTitle>
        <CardDescription>
          Configure quais telas ficam disponíveis para o perfil {configuration.roleLabel}.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Badge variant="secondary" className="bg-white text-slate-700">
            {screens.length} telas detectadas
          </Badge>
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
            {accessibleCount} liberadas para operador
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
              <TableHead className="px-4 text-slate-500">Tela</TableHead>
              <TableHead className="text-slate-500">Rota</TableHead>
              <TableHead className="text-center text-slate-500">Administrador</TableHead>
              <TableHead className="px-4 text-center text-slate-500">
                {configuration.roleLabel}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {screens.map((screen) => {
              const stateKey = getPermissionStateKey(configuration.role, screen.id)
              const isSaving = pendingKey === stateKey && isPending

              return (
                <TableRow key={screen.id} className="border-slate-100 hover:bg-indigo-50/40">
                  <TableCell className="px-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-slate-950">{screen.title}</span>
                      <span className="max-w-xl text-sm text-slate-500">
                        {screen.description}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-slate-600">
                    {screen.routePath}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      <ShieldCheck className="size-3.5" />
                      Total
                    </span>
                  </TableCell>
                  <TableCell className="px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {isSaving ? <Loader2 className="size-4 animate-spin text-indigo-600" /> : null}
                      <Checkbox
                        checked={screen.canAccess}
                        disabled={isSaving}
                        aria-label={`Permitir acesso de ${configuration.roleLabel} a ${screen.title}`}
                        onCheckedChange={(value) => {
                          handlePermissionChange(screen, value === true)
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
