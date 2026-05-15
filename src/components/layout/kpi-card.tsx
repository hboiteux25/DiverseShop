import type { ComponentType } from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type KpiTrend = "up" | "down" | "neutral"

type KpiCardProps = {
  title: string
  value: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  trend?: KpiTrend
  trendValue?: string
}

const trendStyles: Record<KpiTrend, string> = {
  up: "border-emerald-200 bg-emerald-50 text-emerald-700",
  down: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
}

const trendIcons: Record<KpiTrend, ComponentType<{ className?: string }>> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: ArrowRight,
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend = "neutral",
  trendValue,
}: KpiCardProps) {
  const TrendIcon = trendIcons[trend]

  return (
    <Card className="group rounded-xl border border-slate-200 bg-white py-0 text-slate-950 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
      <CardContent className="flex min-h-36 flex-col justify-between gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-sky-50 text-indigo-600 ring-1 ring-indigo-100 transition-colors group-hover:text-indigo-700">
            <Icon className="size-5" />
          </span>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-2xl font-bold tracking-normal text-slate-950">{value}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {trendValue ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
                  trendStyles[trend],
                )}
              >
                <TrendIcon className="size-3.5" />
                {trendValue}
              </span>
            ) : null}
            <span className="text-slate-500">{subtitle}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function KpiCardSkeleton() {
  return (
    <Card className="rounded-xl border border-slate-200 bg-white py-0 shadow-sm">
      <CardContent className="flex min-h-36 flex-col justify-between gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-4 w-28 bg-slate-200" />
          <Skeleton className="size-10 rounded-xl bg-slate-200" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-7 w-32 bg-slate-200" />
          <Skeleton className="h-4 w-40 bg-slate-200" />
        </div>
      </CardContent>
    </Card>
  )
}
