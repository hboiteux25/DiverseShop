import { redirect } from "next/navigation"

import { getScreenPermissionsConfiguration } from "@/app/actions/screen-permissions"
import { getUsers } from "@/app/actions/users"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScreenPermissionsTable } from "@/components/usuarios/screen-permissions-table"
import { UsersPermissionsTable } from "@/components/usuarios/users-permissions-table"
import { ACCESS_DENIED_ROUTE } from "@/lib/permissions/shared"
import { createClient } from "@/lib/supabase/server"

async function requireAdminAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirectedFrom=/usuarios")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") {
    redirect(`${ACCESS_DENIED_ROUTE}?rota=/usuarios`)
  }
}

export default async function UsersPage() {
  await requireAdminAccess()

  const [usersResult, screenPermissionsResult] = await Promise.all([
    getUsers(),
    getScreenPermissionsConfiguration(),
  ])

  return (
    <main className="flex w-full flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-indigo-700">Administração</p>
          <h1 className="text-2xl font-bold text-slate-950">Permissões</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Cadastre usuários, defina perfis e controle quais telas cada operador pode acessar.
          </p>
        </div>
      </section>

      <Tabs defaultValue="usuarios" className="w-full gap-4">
        <TabsList className="w-full justify-start sm:w-fit">
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="telas">Acesso por tela</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios">
          {usersResult.data ? (
            <UsersPermissionsTable users={usersResult.data} />
          ) : (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
              <h2 className="text-lg font-semibold">Usuários indisponíveis</h2>
              <p className="mt-2 max-w-3xl">
                {usersResult.error ?? "Não foi possível carregar os usuários agora."}
              </p>
              <p className="mt-2 max-w-3xl">
                Confirme se as migrations de perfis e permissões foram aplicadas no Supabase.
              </p>
            </section>
          )}
        </TabsContent>
        <TabsContent value="telas">
          {screenPermissionsResult.data ? (
            <ScreenPermissionsTable configuration={screenPermissionsResult.data} />
          ) : (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
              <h2 className="text-lg font-semibold">Acesso por tela indisponível</h2>
              <p className="mt-2 max-w-3xl">
                {screenPermissionsResult.error ??
                  "Não foi possível carregar as permissões por tela agora."}
              </p>
              <p className="mt-2 max-w-3xl">
                Verifique se a migration de permissões por tela foi aplicada no Supabase.
              </p>
            </section>
          )}
        </TabsContent>
      </Tabs>
    </main>
  )
}
