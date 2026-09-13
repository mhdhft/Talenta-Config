"use client"

import { useRouter } from "next/navigation"
import { UploadCloud, History, Settings } from "lucide-react"
import { CircularMenuItem } from "@/components/main/circular-menu-item"
import { useStage } from "@/context/stage-context"

export default function MainPage() {
  const router = useRouter()
  const stage = useStage()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Talenta Sync Config AI
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Otomasi pemetaan perpindahan posisi karyawan
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-16">
        <CircularMenuItem
          label="Upload Documents"
          icon={UploadCloud}
          onClick={() => {
            stage.reset()
            router.push("/stage")
          }}
        />
        <CircularMenuItem
          label="History"
          icon={History}
          onClick={() => router.push("/history")}
        />
        <CircularMenuItem
          label="Settings"
          icon={Settings}
          onClick={() => router.push("/settings")}
        />
      </div>
    </div>
  )
}
