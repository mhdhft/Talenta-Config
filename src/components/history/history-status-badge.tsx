import { cn } from "@/lib/utils"

const statusStyles: Record<string, string> = {
  Selesai: "bg-green-100 text-green-700 border-green-300",
  Diproses: "bg-blue-100 text-blue-700 border-blue-300",
  Gagal: "bg-red-100 text-red-700 border-red-300",
}

export function HistoryStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status] ?? "bg-gray-100 text-gray-600 border-gray-300"
      )}
    >
      {status}
    </span>
  )
}
