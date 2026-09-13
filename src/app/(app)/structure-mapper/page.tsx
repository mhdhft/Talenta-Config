"use client"

import { StructureMapperStepper } from "@/components/structure-mapper/stepper"
import { StepSelectType } from "@/components/structure-mapper/step-select-type"
import { StepMappingPreview } from "@/components/structure-mapper/step-mapping-preview"
import { StepUploadTemplate } from "@/components/structure-mapper/step-upload-template"
import { StepComparisonReport } from "@/components/structure-mapper/step-comparison-report"
import { StepVacantReport } from "@/components/structure-mapper/step-vacant-report"
import { StepOrgDiagram } from "@/components/structure-mapper/step-org-diagram"
import { useStructureMapper } from "@/context/structure-mapper-context"

export default function StructureMapperPage() {
  const { step } = useStructureMapper()

  // "org-diagram" (flow "Structure Your Excel") sengaja TIDAK ikut progress
  // bar 5-step punya "Excel Your Structure" - flow-nya cuma 1 langkah (lihat
  // STRUCTURE-MAPPER-SPEC.md bagian 10.2), jadi progress bar disembunyikan
  // total di step ini supaya tidak menampilkan label step yang tidak relevan
  // ("Report Mapping"/"Upload Template"/dst untuk flow yang berbeda).
  const showStepper = step !== "org-diagram"
  // Halaman ini dipakai bergantian oleh 2 flow independen - lebar konten
  // dibatasi lebih lega untuk diagram (bisa cukup lebar), sementara flow
  // Excel Your Structure tetap pakai lebar sempit seperti sebelumnya.
  const contentMaxWidth = step === "org-diagram" ? "max-w-5xl" : "max-w-3xl"

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Structure Mapper</h1>
        <p className="text-sm text-muted-foreground">
          Petakan struktur organisasi/jabatan dari dokumen yang diupload.
        </p>
      </div>

      {showStepper && <StructureMapperStepper />}

      <div className={`mx-auto w-full ${contentMaxWidth}`}>
        {step === "select-type" && <StepSelectType />}
        {step === "mapping-preview" && <StepMappingPreview />}
        {step === "upload-template" && <StepUploadTemplate />}
        {step === "comparison-report" && <StepComparisonReport />}
        {step === "vacant-report" && <StepVacantReport />}
        {step === "org-diagram" && <StepOrgDiagram />}
      </div>
    </div>
  )
}
