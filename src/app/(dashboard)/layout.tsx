import { DashboardShell } from "@/components/layout/dashboard-shell"
import { getDashboardShellData } from "@/lib/permissions/access"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const shellData = await getDashboardShellData()

  return (
    <DashboardShell
      userRole={shellData.userRole}
      screens={shellData.screens}
      navigationScreens={shellData.navigationScreens}
      canUseChat={shellData.canUseChat}
    >
      {children}
    </DashboardShell>
  )
}
