"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import type { User } from "@supabase/supabase-js"
import { LogOut } from "lucide-react"

import { signOut } from "@/app/actions/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"

type UserProfile = {
  name: string
  role: string
}

function getMetadataValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function getDisplayName(user: User | null, profile: UserProfile | null) {
  if (profile?.name) {
    return profile.name
  }

  const metadataName = getMetadataValue(user?.user_metadata.name)
  const metadataFullName = getMetadataValue(user?.user_metadata.full_name)

  return metadataName ?? metadataFullName ?? user?.email ?? "Usuário"
}

function getInitials(name: string) {
  const words = name
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean)

  if (words.length === 0) {
    return "US"
  }

  const firstInitial = words[0]?.charAt(0) ?? "U"
  const secondInitial = words.length > 1 ? words[1]?.charAt(0) : words[0]?.charAt(1)

  return `${firstInitial}${secondInitial ?? ""}`.toUpperCase()
}

function formatRole(role: string | null) {
  if (role === "admin") {
    return "Administrador"
  }

  if (role === "operator") {
    return "Operador"
  }

  return "Sem perfil"
}

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      setUser(session?.user ?? null)

      if (!session?.user) {
        setProfile(null)
        return
      }

      const { data } = await supabase
        .from("profiles")
        .select("name, role")
        .eq("id", session.user.id)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      setProfile(data)
    }

    void loadSession()

    return () => {
      isMounted = false
    }
  }, [])

  const displayName = useMemo(() => getDisplayName(user, profile), [profile, user])
  const initials = useMemo(() => getInitials(displayName), [displayName])

  function handleSignOut() {
    startTransition(() => {
      void signOut()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="rounded-full border-slate-200 bg-white shadow-sm hover:bg-slate-50"
          aria-label="Abrir menu do usuário"
        >
          <Avatar>
            <AvatarFallback className="bg-indigo-600 text-sm font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 border-slate-200 bg-white text-slate-950 shadow-lg">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Nome</span>
          <span className="text-sm font-semibold text-slate-950">{displayName}</span>
          <span className="mt-2 text-xs text-slate-500">Email</span>
          <span className="truncate text-sm text-slate-700">{user?.email ?? "Email indisponível"}</span>
          <span className="mt-2 text-xs text-slate-500">Perfil</span>
          <span className="text-sm text-indigo-700">{formatRole(profile?.role ?? null)}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuItem
          variant="destructive"
          disabled={isPending}
          onSelect={handleSignOut}
          className="cursor-pointer"
        >
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
