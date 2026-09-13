import { cn } from "@/lib/utils"
import type { MappingConfidence } from "@/lib/api"

const confidenceConfig: Record<MappingConfidence, { label: string; className: string }> = {
  high: {
    label: "Yakin",
    className: "bg-gray-100 text-gray-600 border-gray-300",
  },
  medium: {
    label: "Perlu Dicek",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  low: {
    label: "Perlu Dicek",
    className: "bg-red-100 text-red-700 border-red-300",
  },
}

export function ConfidenceBadge({ confidence }: { confidence: MappingConfidence }) {
  const config = confidenceConfig[confidence]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  )
}
