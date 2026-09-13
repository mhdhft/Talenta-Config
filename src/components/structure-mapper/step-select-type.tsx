"use client"

import { useState } from "react"
import { Building2, Briefcase } from "lucide-react"
import { CircularMenuItem } from "@/components/main/circular-menu-item"
import { JobPositionUploadSheet } from "@/components/structure-mapper/job-position-upload-sheet"
import { OrganizationUploadSheet } from "@/components/structure-mapper/organization-upload-sheet"

// Catatan penamaan (2026-08-05, lihat STRUCTURE-MAPPER-SPEC.md bagian 3.1 &
// Section 10): tombol yang dulu berlabel "Organization" sekarang "Structure
// Your Excel" (Fase F1, baru aktif) dan yang dulu "Job Position" sekarang
// "Excel Your Structure" - ini MURNI ganti label tampilan, onClick/routing
// "Excel Your Structure" di bawah TIDAK diubah sama sekali.
export function StepSelectType() {
  const [jobPositionSheetOpen, setJobPositionSheetOpen] = useState(false)
  const [organizationSheetOpen, setOrganizationSheetOpen] = useState(false)

  return (
    <div className="flex flex-col items-center justify-center gap-12 py-12">
      <p className="text-sm text-muted-foreground">Pilih struktur yang ingin dipetakan.</p>

      <div className="flex flex-wrap items-start justify-center gap-16">
        <CircularMenuItem
          label="Structure Your Excel"
          icon={Building2}
          onClick={() => setOrganizationSheetOpen(true)}
        />
        <CircularMenuItem
          label="Excel Your Structure"
          icon={Briefcase}
          onClick={() => setJobPositionSheetOpen(true)}
        />
      </div>

      <JobPositionUploadSheet open={jobPositionSheetOpen} onOpenChange={setJobPositionSheetOpen} />
      <OrganizationUploadSheet open={organizationSheetOpen} onOpenChange={setOrganizationSheetOpen} />
    </div>
  )
}
