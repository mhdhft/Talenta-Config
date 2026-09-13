import { cn } from "@/lib/utils"
import type { MappingStatus } from "@/lib/api"

const statusStyles: Record<MappingStatus, string> = {
  Changed: "bg-amber-100 text-amber-800 border-amber-300",
  Unchanged: "bg-gray-100 text-gray-600 border-gray-300",
  "Need Confirmation": "bg-red-100 text-red-700 border-red-300",
  "Not Found": "bg-purple-100 text-purple-700 border-purple-300",
}

export function StatusBadge({ status }: { status: MappingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status]
      )}
    >
      {status}
    </span>
  )
}
