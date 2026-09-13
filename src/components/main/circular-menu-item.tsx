"use client"

import type { LucideIcon } from "lucide-react"

interface CircularMenuItemProps {
  label: string
  icon: LucideIcon
  onClick: () => void
}

export function CircularMenuItem({ label, icon: Icon, onClick }: CircularMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-3 focus:outline-none"
    >
      <span className="flex h-28 w-28 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-105 group-hover:shadow-lg">
        <Icon className="h-10 w-10" />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  )
}
